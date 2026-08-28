import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LogoPair } from "@/components/logo-pair";
import { COMPANIES } from "@/lib/logos/companies";

const company = COMPANIES[0]!;

describe("LogoPair", () => {
  it("renders sdr jpeg and gainmap tiles at card size", () => {
    render(<LogoPair company={company} size="card" />);
    expect(screen.getByAltText(`${company.name} logo — SDR JPEG`)).toBeInTheDocument();
    const gain = screen.getByAltText(`${company.name} logo — Ultra HDR JPEG gain map`);
    expect(gain).toHaveAttribute("sizes");
    expect(gain.getAttribute("srcset")).toContain("128w");
  });

  it("renders detail size with larger sizes attribute on the gainmap tile", () => {
    render(<LogoPair company={company} size="detail" />);
    const gain = screen.getByAltText(`${company.name} logo — Ultra HDR JPEG gain map`);
    expect(gain).toHaveAttribute("sizes", expect.stringContaining("512px"));
  });

  it("sdr slot uses sdrPath and sdrSrcset", () => {
    render(<LogoPair company={company} size="card" />);
    const sdr = screen.getByAltText(`${company.name} logo — SDR JPEG`);
    expect(sdr.getAttribute("src")).toContain("logo-sdr");
    expect(sdr.getAttribute("srcset")).toContain("logo-sdr-128.jpg");
  });
});
