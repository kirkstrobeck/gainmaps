import { vi } from "vitest";

export const navState = {
  pathname: "/",
  push: vi.fn(),
  replace: vi.fn(),
  searchGet: vi.fn((): string | null => null),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
};

export const headerState = {
  heroSlug: null as string | null,
  cookie: {} as Record<string, string>,
};

export function resetNavState(): void {
  navState.pathname = "/";
  navState.push.mockReset();
  navState.replace.mockReset();
  navState.searchGet.mockReset();
  navState.searchGet.mockReturnValue(null);
  navState.notFound.mockReset();
  navState.notFound.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
  headerState.heroSlug = null;
  headerState.cookie = {};
}
