import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeamComparePhoto } from "@/components/seam-compare";
import { PhotoPair } from "@/components/photo-pair";
import { ImageComparePair } from "@/components/compare-pair";
import { PHOTOS } from "@/lib/photos/catalog";
import { assertPairParity } from "@/test/helpers/pair-parity";

const photo = PHOTOS[0]!;

describe("pair-rendering resolution parity", () => {
  it("SeamComparePhoto: both <img> share sizes and srcset width descriptors", () => {
    render(<SeamComparePhoto photo={photo} sizes="33vw" />);
    const sdr = screen.getByAltText(`${photo.alt}, Standard`);
    const ultra = screen.getByAltText(`${photo.alt}, Ultra`);
    assertPairParity(sdr, ultra);
  });

  it("SeamComparePhoto default sizes are identical on both layers", () => {
    render(<SeamComparePhoto photo={photo} />);
    const sdr = screen.getByAltText(`${photo.alt}, Standard`);
    const ultra = screen.getByAltText(`${photo.alt}, Ultra`);
    assertPairParity(sdr, ultra);
  });

  it("PhotoPair card: both <img> share sizes and srcset width descriptors", () => {
    render(<PhotoPair photo={photo} size="card" />);
    const sdr = screen.getByAltText(`${photo.alt}, Standard`);
    const ultra = screen.getByAltText(`${photo.alt}, Ultra`);
    assertPairParity(sdr, ultra);
  });

  it("PhotoPair detail: both <img> share sizes and srcset width descriptors", () => {
    render(<PhotoPair photo={photo} size="detail" priority />);
    const sdr = screen.getByAltText(`${photo.alt}, Standard`);
    const ultra = screen.getByAltText(`${photo.alt}, Ultra`);
    assertPairParity(sdr, ultra);
    expect(sdr).toHaveAttribute("loading", "eager");
    expect(ultra).toHaveAttribute("loading", "eager");
  });

  it("ImageComparePair: both columns share sizes and srcset width descriptors", () => {
    render(
      <ImageComparePair
        src="/logos/lego/logo-gainmap.jpg"
        srcSet="/logos/lego/logo-gainmap-128.jpg 128w, /logos/lego/logo-gainmap-256.jpg 256w"
        sizes="256px"
        alt="LEGO logo"
        caption={<span>caption</span>}
      />,
    );
    const sdr = screen.getByAltText("LEGO logo, Standard");
    const ultra = screen.getByAltText("LEGO logo, Ultra");
    assertPairParity(sdr, ultra);
  });

  it("ImageComparePair without caption still pairs sizes", () => {
    render(<ImageComparePair src="/x.jpg" alt="pair" />);
    const sdr = screen.getByAltText("pair, Standard");
    const ultra = screen.getByAltText("pair, Ultra");
    assertPairParity(sdr, ultra);
  });
});
