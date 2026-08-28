export type BrandNameRow = {
  name: string;
  fullName: string;
  platform: string;
  meaning: string;
};

export const BRAND_NAMES: BrandNameRow[] = [
  {
    name: "EDR",
    fullName: "Extended Dynamic Range",
    platform: "Apple",
    meaning: "Apple's system for displaying brightness above normal SDR white",
  },
  {
    name: "XDR",
    fullName: "Extreme Dynamic Range",
    platform: "Apple",
    meaning: "Apple branding for displays with high HDR brightness and contrast",
  },
  {
    name: "Adaptive HDR",
    fullName: "Adaptive High Dynamic Range",
    platform: "Apple",
    meaning: "Gain map image system that supports both SDR and HDR display",
  },
  {
    name: "Ultra HDR",
    fullName: "Ultra High Dynamic Range",
    platform: "Google and Android",
    meaning: "Gain map JPEG format and the closest Android equivalent to an EDR JPEG",
  },
  {
    name: "Super HDR",
    fullName: "Super High Dynamic Range",
    platform: "Samsung",
    meaning: "Samsung branding for HDR photo capture and display",
  },
  {
    name: "ProXDR",
    fullName: "Pro Extreme Dynamic Range",
    platform: "OPPO and OnePlus",
    meaning: "Branding for HDR photo capture and display",
  },
  {
    name: "Pro HDR",
    fullName: "Pro High Dynamic Range",
    platform: "Xiaomi",
    meaning: "Branding for brighter HDR photo display",
  },
  {
    name: "Advanced Color",
    fullName: "Advanced Color",
    platform: "Microsoft Windows",
    meaning: "Windows system covering HDR, wide color gamut, and higher color precision",
  },
  {
    name: "HDR",
    fullName: "High Dynamic Range",
    platform: "Industry standard",
    meaning: "Content with a wider brightness range than SDR",
  },
  {
    name: "SDR",
    fullName: "Standard Dynamic Range",
    platform: "Industry standard",
    meaning: "Traditional display brightness range",
  },
  {
    name: "WCG",
    fullName: "Wide Color Gamut",
    platform: "Industry standard",
    meaning: "A broader range of reproducible colors",
  },
  {
    name: "HDR10",
    fullName: "High Dynamic Range, 10 bit",
    platform: "Industry standard",
    meaning: "Static metadata HDR format using 10 bit color",
  },
  {
    name: "HDR10+",
    fullName: "High Dynamic Range, 10 bit Plus",
    platform: "Samsung and others",
    meaning: "Dynamic metadata HDR format",
  },
  {
    name: "HLG",
    fullName: "Hybrid Log Gamma",
    platform: "BBC and NHK",
    meaning: "HDR format commonly used for broadcast television",
  },
  {
    name: "PQ",
    fullName: "Perceptual Quantizer",
    platform: "SMPTE",
    meaning: "HDR brightness transfer function used by HDR10 and Dolby Vision",
  },
  {
    name: "DV",
    fullName: "Dolby Vision",
    platform: "Dolby",
    meaning: "Dynamic metadata HDR format",
  },
  {
    name: "DisplayHDR",
    fullName: "VESA Certified DisplayHDR",
    platform: "VESA",
    meaning: "Display performance certification rather than an image format",
  },
  {
    name: "HDR gain map",
    fullName: "High Dynamic Range gain map",
    platform: "Cross platform",
    meaning:
      "General technical term for an image containing SDR data plus additional HDR brightness information",
  },
];
