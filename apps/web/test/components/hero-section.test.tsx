import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroSection } from "@/components/hero-section";
import { PHOTOS } from "@/lib/photos/catalog";

const photo = PHOTOS[0]!;

describe("HeroSection", () => {
  it("renders the compare photo credit and convert action", () => {
    render(<HeroSection comparePhoto={photo} rotationPhotos={PHOTOS.slice(0, 3)} id="main-content" />);
    expect(document.getElementById("main-content")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Convert an image" })).toHaveAttribute("href", "/convert");
    expect(screen.getByText(photo.photographer)).toBeInTheDocument();
    expect(screen.getByLabelText("Photo rotation progress")).toBeInTheDocument();
    expect(screen.getByAltText(`${photo.alt}, Standard`)).toBeInTheDocument();
    expect(screen.getByAltText(`${photo.alt}, Ultra`)).toBeInTheDocument();
  });
});
