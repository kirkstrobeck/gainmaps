import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ImageProofSection } from "@/components/image-proof-section";
import { COMPANIES } from "@/lib/logos/companies";
import { PHOTOS } from "@/lib/photos/catalog";

describe("ImageProofSection", () => {
  it("renders logo section and photo section with browse-all links", () => {
    render(
      <ImageProofSection
        photoPeek={PHOTOS.slice(0, 2)}
      />,
    );
    expect(screen.getByText(new RegExp(`${COMPANIES.length} brand logos`))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${PHOTOS.length} photographs`))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: new RegExp(`Browse all ${COMPANIES.length} logos`) })).toHaveAttribute("href", "/logos");
    expect(screen.getByRole("link", { name: new RegExp(`Browse all ${PHOTOS.length} photos`) })).toHaveAttribute("href", "/photos");
    expect(screen.getByRole("link", { name: PHOTOS[0]!.alt })).toHaveAttribute(
      "href",
      `/photos/${PHOTOS[0]!.slug}`,
    );
  });

  it("renders three logo comparison pairs (SDR vs Ultra)", () => {
    render(<ImageProofSection photoPeek={PHOTOS.slice(0, 1)} />);
    const standardImgs = screen.getAllByAltText(/logo gain map image, Standard/);
    const ultraImgs = screen.getAllByAltText(/logo gain map image, Ultra/);
    expect(standardImgs.length).toBe(3);
    expect(ultraImgs.length).toBe(3);
    // Verify SDR and Ultra use different src paths
    const firstStd = standardImgs[0]!;
    const firstUltra = ultraImgs[0]!;
    expect(firstStd.getAttribute("src")).toContain("logo-sdr");
    expect(firstUltra.getAttribute("src")).toContain("logo-gainmap");
    expect(firstStd.getAttribute("src")).not.toBe(firstUltra.getAttribute("src"));
  });
});
