// Accepts only a reasonably sized PNG data URL from the signature pad.
export function validSignature(value: string | undefined): value is string {
  if (!value || !value.startsWith("data:image/png;base64,") || value.length > 400_000) return false;
  const bytes = Buffer.from(value.slice(22), "base64");
  return bytes.length > 100 && bytes.subarray(1, 4).toString() === "PNG";
}
