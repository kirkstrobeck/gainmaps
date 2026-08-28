import Foundation
import CoreGraphics
import ImageIO
import AppKit

/// Fit a linear HDR transform: window.jpeg (SDR) → window-gain.HEIC (HDR),
/// then write fixtures/window/calibration.json for the TypeScript encoder.

struct Pix { var r: Float; var g: Float; var b: Float }

let repo = URL(fileURLWithPath: #filePath)
  .deletingLastPathComponent() // tools/window-gain
  .deletingLastPathComponent() // tools
  .deletingLastPathComponent() // repo root
let windowURL = repo.appendingPathComponent("fixtures/window/window.jpeg")
let refURL = repo.appendingPathComponent("fixtures/window/window-gain.HEIC")
let outJSON = repo.appendingPathComponent("fixtures/window/calibration.json")

func log(_ s: String) { fputs(s + "\n", stderr); fflush(stderr) }

func loadCG(_ url: URL, hdr: Bool) -> CGImage {
  guard let src = CGImageSourceCreateWithURL(url as CFURL, nil) else { fatalError("open \(url.path)") }
  var opts: [CFString: Any] = [:]
  if hdr { opts[kCGImageSourceDecodeRequest] = kCGImageSourceDecodeToHDR }
  guard let img = CGImageSourceCreateImageAtIndex(src, 0, opts as CFDictionary) else {
    fatalError("decode \(url.path) hdr=\(hdr)")
  }
  return img
}

func toFloatRGB(_ image: CGImage, label: String) -> (w: Int, h: Int, pix: [Float]) {
  let w = image.width, h = image.height
  log("toFloat \(label) \(w)x\(h) headroom=\(image.contentHeadroom)")
  var pix = [Float](repeating: 0, count: w * h * 4)
  let cs = CGColorSpace(name: CGColorSpace.extendedLinearDisplayP3)!
  let info = CGBitmapInfo(rawValue: CGBitmapInfo.floatComponents.rawValue | CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue)
  guard let ctx = CGContext(data: &pix, width: w, height: h, bitsPerComponent: 32, bytesPerRow: w * 16, space: cs, bitmapInfo: info.rawValue) else {
    fatalError("no float context")
  }
  ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
  return (w, h, pix)
}

func at(_ pix: [Float], w: Int, h: Int, x: Int, yTop: Int) -> Pix {
  let y = h - 1 - yTop
  let o = (y * w + x) * 4
  return Pix(r: pix[o], g: pix[o + 1], b: pix[o + 2])
}

func points(w: Int, h: Int, n: Int) -> [(Int, Int)] {
  let side = Int(ceil(sqrt(Double(n))))
  var p: [(Int, Int)] = []
  for iy in 0..<side {
    for ix in 0..<side {
      if p.count >= n { return p }
      p.append((
        min(w - 1, Int((Double(ix) + 0.5) / Double(side) * Double(w))),
        min(h - 1, Int((Double(iy) + 0.5) / Double(side) * Double(h)))
      ))
    }
  }
  return p
}

func luma(_ p: Pix) -> Float { 0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b }
func sat(_ p: Pix) -> Float {
  let mx = max(p.r, max(p.g, p.b)), mn = min(p.r, min(p.g, p.b))
  return mx <= 1e-8 ? 0 : (mx - mn) / mx
}

func apply(_ p: Pix, ev: Float, sc: (Float, Float, Float), off: (Float, Float, Float), satG: Float) -> Pix {
  let m = pow(2 as Float, ev)
  var r = p.r * m * sc.0 + off.0
  var g = p.g * m * sc.1 + off.1
  var b = p.b * m * sc.2 + off.2
  if abs(satG - 1) > 1e-4 {
    let y = luma(Pix(r: r, g: g, b: b))
    r = y + (r - y) * satG
    g = y + (g - y) * satG
    b = y + (b - y) * satG
  }
  return Pix(r: max(0, r), g: max(0, g), b: max(0, b))
}

log("load images")
let refCG = loadCG(refURL, hdr: true)
let winCG = loadCG(windowURL, hdr: false)
let headroom = max(refCG.contentHeadroom, 1)
log("reference headroom \(headroom)")
let refF = toFloatRGB(refCG, label: "ref-heic")
let winF = toFloatRGB(winCG, label: "window-jpeg")
guard refF.w == winF.w, refF.h == winF.h else {
  fatalError("size mismatch \(winF.w)x\(winF.h) vs \(refF.w)x\(refF.h)")
}
let pts = points(w: refF.w, h: refF.h, n: 2000)
log("points \(pts.count)")
let refS = pts.map { at(refF.pix, w: refF.w, h: refF.h, x: $0.0, yTop: $0.1) }
let winS = pts.map { at(winF.pix, w: winF.w, h: winF.h, x: $0.0, yTop: $0.1) }

func stats(_ man: [Pix]) -> (meanAbs: Double, refL: Double, manL: Double, refS: Double, manS: Double) {
  var meanAbs = 0.0, refL = 0.0, manL = 0.0, refSat = 0.0, manSat = 0.0
  let n = Double(man.count)
  for i in 0..<man.count {
    meanAbs += (abs(Double(man[i].r - refS[i].r)) + abs(Double(man[i].g - refS[i].g)) + abs(Double(man[i].b - refS[i].b))) / 3
    refL += Double(luma(refS[i])); manL += Double(luma(man[i]))
    refSat += Double(sat(refS[i])); manSat += Double(sat(man[i]))
  }
  return (meanAbs / n, refL / n, manL / n, refSat / n, manSat / n)
}

var ev: Float = log2(headroom)
var sc: (Float, Float, Float) = (1, 1, 1)
var off: (Float, Float, Float) = (0, 0, 0)
var satG: Float = 1
var man = winS.map { apply($0, ev: ev, sc: sc, off: off, satG: satG) }
var st = stats(man)
log(String(format: "iter0 meanAbs=%.5f luma %.4f vs %.4f", st.meanAbs, st.refL, st.manL))

for round in 1...24 {
  var nR = 0.0, dR = 0.0, nG = 0.0, dG = 0.0, nB = 0.0, dB = 0.0, eR = 0.0, eG = 0.0, eB = 0.0
  let n = Double(man.count)
  for i in 0..<man.count {
    nR += Double(man[i].r * refS[i].r); dR += Double(man[i].r * man[i].r)
    nG += Double(man[i].g * refS[i].g); dG += Double(man[i].g * man[i].g)
    nB += Double(man[i].b * refS[i].b); dB += Double(man[i].b * man[i].b)
  }
  let sR = Float(nR / max(dR, 1e-12)), sG = Float(nG / max(dG, 1e-12)), sB = Float(nB / max(dB, 1e-12))
  for i in 0..<man.count {
    eR += Double(refS[i].r - man[i].r * sR)
    eG += Double(refS[i].g - man[i].g * sG)
    eB += Double(refS[i].b - man[i].b * sB)
  }
  sc = (sc.0 * sR, sc.1 * sG, sc.2 * sB)
  off = (sR * off.0 + Float(eR / n), sG * off.1 + Float(eG / n), sB * off.2 + Float(eB / n))
  man = winS.map { apply($0, ev: ev, sc: sc, off: off, satG: satG) }
  st = stats(man)
  if st.manS > 1e-6 { satG *= (0.25 + 0.75 * min(max(Float(st.refS / st.manS), 0.7), 1.6)) }
  if st.manL > 1e-6 {
    let ratio = Float(st.refL / st.manL)
    let geo = pow(max(sc.0 * sc.1 * sc.2, 1e-12), 1 / 3)
    ev += 0.35 * log2(max(ratio * geo, 1e-6))
    sc = (sc.0 / geo, sc.1 / geo, sc.2 / geo)
    off = (off.0 / geo, off.1 / geo, off.2 / geo)
  }
  man = winS.map { apply($0, ev: ev, sc: sc, off: off, satG: satG) }
  st = stats(man)
  log(String(format: "iter%d meanAbs=%.5f luma %.4f vs %.4f ev=%.4f sat=%.4f", round, st.meanAbs, st.refL, st.manL, ev, satG))
}

let payload: [String: Any] = [
  "source": "fixtures/window/window.jpeg",
  "reference": "fixtures/window/window-gain.HEIC",
  "colorSpace": "extendedLinearDisplayP3",
  "headroom": headroom,
  "ev": ev,
  "saturation": satG,
  "scale": [sc.0, sc.1, sc.2],
  "offset": [off.0, off.1, off.2],
  "fit": [
    "points": pts.count,
    "meanAbs": st.meanAbs,
    "refLuma": st.refL,
    "manLuma": st.manL,
    "refSat": st.refS,
    "manSat": st.manS,
  ],
  "formula": "rgb' = rgb * 2^ev * scale + offset; then luma + (rgb'-luma)*saturation",
]
let data = try! JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .sortedKeys])
try! data.write(to: outJSON)
log("wrote \(outJSON.path)")
print(String(data: data, encoding: .utf8)!)
