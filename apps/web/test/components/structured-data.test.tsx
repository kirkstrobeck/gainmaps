import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StructuredData } from "@/components/structured-data";

describe("StructuredData", () => {
  it("renders a script tag with ld+json type", () => {
    const { container } = render(<StructuredData />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
  });

  it("JSON is valid and contains @context", () => {
    const { container } = render(<StructuredData />);
    const script = container.querySelector('script[type="application/ld+json"]');
    const json = JSON.parse(script!.textContent ?? "{}");
    expect(json["@context"]).toBe("https://schema.org");
  });

  it("includes an Organization graph node", () => {
    const { container } = render(<StructuredData />);
    const script = container.querySelector('script[type="application/ld+json"]');
    const json = JSON.parse(script!.textContent ?? "{}");
    const org = json["@graph"].find((n: { "@type": string }) => n["@type"] === "Organization");
    expect(org).toBeDefined();
    expect(org.name).toBe("Gainmaps");
  });

  it("includes a SoftwareApplication graph node", () => {
    const { container } = render(<StructuredData />);
    const script = container.querySelector('script[type="application/ld+json"]');
    const json = JSON.parse(script!.textContent ?? "{}");
    const app = json["@graph"].find((n: { "@type": string }) => n["@type"] === "SoftwareApplication");
    expect(app).toBeDefined();
    expect(app.name).toBe("gainmap");
  });

  it("Organization has contactPoint with email", () => {
    const { container } = render(<StructuredData />);
    const script = container.querySelector('script[type="application/ld+json"]');
    const json = JSON.parse(script!.textContent ?? "{}");
    const org = json["@graph"].find((n: { "@type": string }) => n["@type"] === "Organization");
    expect(org.contactPoint).toBeDefined();
    expect(org.contactPoint.email).toBe("kirk@strobeck.com");
  });
});
