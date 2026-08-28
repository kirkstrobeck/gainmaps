/** Format-agnostic contract shared by the JPEG and PNG implementations. */

export interface ImageFacts {
  width: number;
  height: number;
  /** Format-specific structure summary, e.g. segment or chunk list. */
  structure: string;
  /** Extra quality notes shown by `inspect`, e.g. chroma sampling. */
  notes: string[];
}

export interface ImageCodec {
  name: string;
  matches(data: Buffer): boolean;
  facts(data: Buffer): ImageFacts;
  /** Embedded ICC profile, or null when the file carries none. */
  getProfile(data: Buffer): Buffer | null;
  /** Re-encode metadata only, leaving compressed pixel data byte-identical. */
  setProfile(data: Buffer, profile: Buffer, name: string): Buffer;
  /** The compressed pixel bytes, hashed to prove an assignment changed nothing. */
  pixelPayload(data: Buffer): Buffer;
}
