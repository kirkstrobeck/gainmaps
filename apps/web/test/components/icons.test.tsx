import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  BoltIcon,
  CheckIcon,
  CloseIcon,
  ArrowDownwardIcon,
  ArrowUpwardIcon,
  BookmarkIcon,
  ScheduleIcon,
  DarkModeIcon,
  LightModeIcon,
  ContentCopyIcon,
  DescriptionIcon,
  ForumIcon,
  PhotoIcon,
  LayersIcon,
  LockIcon,
  OpenInNewIcon,
  PaletteIcon,
  VerifiedUserIcon,
  AutoAwesomeIcon,
  TerminalIcon,
  TextFieldsIcon,
  ThumbUpIcon,
  SwapHorizIcon,
  UploadFileIcon,
  StarsIcon,
  RefreshIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GitHubIcon,
  ProductHuntIcon,
  ArrowBackIcon,
  ArrowForwardIcon,
} from "@/components/icons";

const ALL_ICONS = [
  BoltIcon, CheckIcon, CloseIcon, ArrowDownwardIcon, ArrowUpwardIcon, ArrowBackIcon, ArrowForwardIcon,
  BookmarkIcon, ScheduleIcon, DarkModeIcon, LightModeIcon, ContentCopyIcon, DescriptionIcon,
  ForumIcon, PhotoIcon, LayersIcon, LockIcon, OpenInNewIcon, PaletteIcon, VerifiedUserIcon,
  AutoAwesomeIcon, TerminalIcon, TextFieldsIcon, ThumbUpIcon, SwapHorizIcon, UploadFileIcon,
  StarsIcon, RefreshIcon, ChevronLeftIcon, ChevronRightIcon, ProductHuntIcon,
];

describe("Icon components", () => {
  it.each(ALL_ICONS)("%s renders an SVG element", (Icon) => {
    const { container } = render(<Icon />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("accepts size prop", () => {
    const { container } = render(<CheckIcon size={32} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("32");
    expect(svg?.getAttribute("height")).toBe("32");
  });

  it("accepts color prop", () => {
    const { container } = render(<CheckIcon color="red" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("fill")).toBe("red");
  });

  it("passes className to svg", () => {
    const { container } = render(<CheckIcon className="my-class" />);
    expect(container.querySelector("svg.my-class")).not.toBeNull();
  });
});

describe("GitHubIcon", () => {
  it("renders an SVG", () => {
    const { container } = render(<GitHubIcon />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("uses 16x16 viewBox", () => {
    const { container } = render(<GitHubIcon />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 16 16");
  });
});


describe("ProductHuntIcon", () => {
  it("uses the official Product Hunt SVG mark geometry", () => {
    const { container } = render(<ProductHuntIcon />);
    const svg = container.querySelector("svg");
    const circle = container.querySelector("circle");
    const path = container.querySelector("path");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(circle?.getAttribute("fill")).toBe("#ffffff");
    expect(path?.getAttribute("fill")).toBe("#DA552F");
    expect(path?.getAttribute("d")).toBe("M13.604 8.4h-3.405V12h3.405c.995 0 1.801-.806 1.801-1.801 0-.993-.805-1.799-1.801-1.799zM12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm1.604 14.4h-3.405V18H7.801V6h5.804c2.319 0 4.2 1.88 4.2 4.199 0 2.321-1.881 4.201-4.201 4.201z");
  });
});
