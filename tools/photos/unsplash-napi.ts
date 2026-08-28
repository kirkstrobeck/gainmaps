/**
 * Unsplash napi search — same approach as tools/photos/curate-photos.ts.
 */
const USER_AGENT = "gainmaps-photos/1.0 (https://gainmaps.com)";

export type UnsplashUser = {
  readonly name?: string;
  readonly username?: string;
};

export type UnsplashHit = {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly alt_description: string | null;
  readonly description: string | null;
  readonly slug?: string;
  readonly urls: { readonly raw?: string };
  readonly user?: UnsplashUser;
};

export type CatalogFields = {
  readonly id: string;
  readonly slug: string;
  readonly unsplashPhotoId: string;
  readonly photographer: string;
  readonly photographerUrl: string;
  readonly photoUrl: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
};

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 63)
    .replace(/-$/, "");
}

export function photoIdFromRaw(rawUrl: string): string | null {
  const m = rawUrl.match(/images\.unsplash\.com\/(photo-[a-z0-9-]+)/);
  if (!m) return null;
  return m[1] ?? null;
}

export async function fetchSearchPage(query: string, page: number): Promise<readonly UnsplashHit[]> {
  const url =
    `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}` +
    `&per_page=30&page=${page}&orientation=landscape`;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for "${query}" p${page}`);
  const body = (await response.json()) as { readonly results?: readonly UnsplashHit[] };
  return body.results ?? [];
}

export function toCatalogFields(hit: UnsplashHit, photoId: string, existingSlugs?: ReadonlySet<string>): CatalogFields {
  const alt = (hit.alt_description ?? hit.description ?? "").trim();
  const fromAlt = slugify(alt);
  let slug = fromAlt || slugify(hit.id);
  // Deduplicate: if the base slug already exists, append the photo id.
  if (existingSlugs && existingSlugs.has(slug)) {
    slug = `${slug}-${hit.id}`;
  }
  const username = hit.user?.username ?? "";
  const unsplashSlug = hit.slug ?? hit.id;
  return {
    id: hit.id,
    slug,
    unsplashPhotoId: photoId,
    photographer: (hit.user?.name ?? "").trim(),
    photographerUrl: `https://unsplash.com/@${username}`,
    photoUrl: `https://unsplash.com/photos/${unsplashSlug}`,
    width: hit.width,
    height: hit.height,
    alt,
  };
}

export async function downloadRendition(photoId: string, longEdge: number): Promise<Buffer> {
  const url = `https://images.unsplash.com/${photoId}?auto=format&fit=max&w=${longEdge}&q=80`;
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "image/jpeg,image/*,*/*" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} downloading ${photoId}`);
  return Buffer.from(await response.arrayBuffer());
}
