import Foundation
import CoreGraphics
import ImageIO
import AppKit

#if canImport(Darwin)
#endif

struct Pix { var r: Float; var g: Float; var b: Float }

let args = CommandLine.arguments
guard args.count >= 3 else {
  fputs("""
  usage: compare-hdr <candidate.(jpeg|heic)> <reference.(jpeg|heic)> [--points N] [--max-mean ABS]
  exits 0 when meanAbs RGB <= max-mean (default 0.08)

  """, stderr)
  exit(2)
}

let candidateURL = URL(fileURLWithPath: args[1])
let referenceURL = URL(fileURLWithPath: args[2])
var pointCount = 2000
var maxMean = 0.08
var i = 3
while i < args.count {
  if args[i] == "--points", i + 1 < args.count { pointCount = Int(args[i+1]) ?? pointCount; i += 2; continue }
  if args[i] == "--max-mean", i + 1 < args.count { maxMean = Double(args[i+1]) ?? maxMean; i += 2; continue }
  i += 1
}

func loadCG(_ url: URL, hdr: Bool) -> CGImage {
  guard let src = CGImageSourceCreateWithURL(url as CFURL, nil) else {
    fputs("failed to open \(url.path)\n", stderr); exit(1)
  }
  var opts: [CFString: Any] = [:]
  if hdr { opts[kCGImageSourceDecodeRequest] = kCGImageSourceDecodeToHDR }
  guard let img = CGImageSourceCreateImageAtIndex(src, 0, opts as CFDictionary) else {
    fputs("failed to decode \(url.path) hdr=\(hdr)\n", stderr); exit(1)
  }
  return img
}

func toFloatRGB(_ image: CGImage) -> (w: Int, h: Int, pix: [Float]) {
  let w = image.width, h = image.height
  var pix = [Float](repeating: 0, count: w * h * 4)
  let cs = CGColorSpace(name: CGColorSpace.extendedLinearDisplayP3)!
  let info = CGBitmapInfo(rawValue: CGBitmapInfo.floatComponents.rawValue | CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue)
  guard let ctx = CGContext(data: &pix, width: w, height: h, bitsPerComponent: 32, bytesPerRow: w * 16, space: cs, bitmapInfo: info.rawValue) else {
    fputs("no float context\n", stderr); exit(1)
  }
  ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
  return (w, h, pix)
}

func at(_ pix: [Float], w: Int, h: Int, x: Int, yTop: Int) -> Pix {
  let y = h - 1 - yTop
  let o = (y * w + x) * 4
  return Pix(r: pix[o], g: pix[o+1], b: pix[o+2])
}

func gridPoints(w: Int, h: Int, n: Int) -> [(Int, Int)] {
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

let candCG = loadCG(candidateURL, hdr: true)
let refCG = loadCG(referenceURL, hdr: true)
let cand = toFloatRGB(candCG)
let ref = toFloatRGB(refCG)
guard cand.w == ref.w, cand.h == ref.h else {
  fputs("size mismatch candidate \(cand.w)x\(cand.h) vs reference \(ref.w)x\(ref.h)\n", stderr)
  exit(1)
}

let pts = gridPoints(w: ref.w, h: ref.h, n: pointCount)
var meanAbs = 0.0
var refL = 0.0
var candL = 0.0
var absList: [Double] = []
for (x, y) in pts {
  let a = at(cand.pix, w: cand.w, h: cand.h, x: x, yTop: y)
  let b = at(ref.pix, w: ref.w, h: ref.h, x: x, yTop: y)
  let d = (abs(Double(a.r - b.r)) + abs(Double(a.g - b.g)) + abs(Double(a.b - b.b))) / 3
  meanAbs += d
  absList.append(d)
  refL += Double(luma(b))
  candL += Double(luma(a))
}
let n = Double(pts.count)
meanAbs /= n
refL /= n
candL /= n
absList.sort()
func pct(_ p: Double) -> Double {
  let idx = min(absList.count - 1, Int((p / 100) * Double(absList.count - 1)))
  return absList[idx]
}

let report: [String: Any] = [
  "candidate": candidateURL.path,
  "reference": referenceURL.path,
  "points": pts.count,
  "meanAbs": meanAbs,
  "p50": pct(50),
  "p90": pct(90),
  "p99": pct(99),
  "refLuma": refL,
  "candLuma": candL,
  "candHeadroom": candCG.contentHeadroom,
  "refHeadroom": refCG.contentHeadroom,
  "pass": meanAbs <= maxMean,
  "maxMean": maxMean,
]
let data = try! JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write("\n".data(using: .utf8)!)
exit(meanAbs <= maxMean ? 0 : 1)
