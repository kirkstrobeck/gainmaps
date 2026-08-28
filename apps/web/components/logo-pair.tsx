"use client";

import { logoGainmapSrcset, logoSdrSrcset, type Company } from "@/lib/logos/companies";
import { SeamInstrument } from "@/components/seam-instrument";
import { SeamLayerImg } from "@/components/seam-layer-img";

type LogoPairSize = "card" | "detail";

const LOGO_SIZES: Record<LogoPairSize, string> = {
  card: "(max-width: 640px) 128px, 256px",
  detail: "(max-width: 640px) 256px, 512px",
};

const HEIGHT_CLS: Record<LogoPairSize, string> = {
  card: "h-40",
  detail: "h-64",
};

/**
 * SeamInstrument slider: SDR JPEG base (left/SDR) vs Ultra HDR JPEG gain map (right/Ultra).
 *
 * Plain <img>, not next/image — optimizer would strip the gain map layer.
 */
export function LogoPair({ company, size }: { company: Company; size: LogoPairSize }) {
  return (
    <figure className="m-0 w-full">
      <SeamInstrument
        width="100%"
        className={`checkerboard ${HEIGHT_CLS[size]} rounded-[var(--radius)]`}
        sdr={
          <SeamLayerImg
            src={company.sdrPath}
            srcSet={logoSdrSrcset(company)}
            sizes={LOGO_SIZES[size]}
            alt={`${company.name} logo — SDR JPEG`}
            width={512}
            height={512}
            className="inst-img size-full object-contain p-4"
            loading="lazy"
            fetchPriority="low"
          />
        }
        ultra={
          <SeamLayerImg
            src={company.gainmapPath}
            srcSet={logoGainmapSrcset(company)}
            sizes={LOGO_SIZES[size]}
            alt={`${company.name} logo — Ultra HDR JPEG gain map`}
            width={512}
            height={512}
            className="inst-img size-full object-contain p-4 gainmap-image"
            loading="lazy"
            fetchPriority="low"
          />
        }
      />
      <figcaption className="mt-2 flex justify-between text-center text-xs font-medium uppercase tracking-[0.1em] text-[var(--muted)]">
        <span>SDR JPEG</span>
        <span>Ultra HDR JPEG</span>
      </figcaption>
    </figure>
  );
}
