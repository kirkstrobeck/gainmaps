/** Append a token to `Vary` without duplicating one that is already present. */
export function appendVary(headers: Headers, token: string): void {
  const existing = headers.get("vary");
  if (!existing) {
    headers.set("vary", token);
    return;
  }
  const already = existing.split(",").some(
    (part) => part.trim().toLowerCase() === token.toLowerCase(),
  );
  if (already) return;
  headers.set("vary", `${existing}, ${token}`);
}
