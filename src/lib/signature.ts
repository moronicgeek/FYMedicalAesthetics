// Accepts only a reasonably sized PNG data URL from the signature pad.
export function validSignature(value: string | undefined): value is string {
  if (!value || !value.startsWith("data:image/png;base64,") || value.length > 400_000) return false;
  const bytes = Buffer.from(value.slice(22), "base64");
  return bytes.length > 100 && bytes.subarray(1, 4).toString() === "PNG";
}

// Accepts a JPEG data URL of an ID document, as produced by the ID photo field
// (resized on the tablet before upload).
export function validIdPhoto(value: string | undefined): value is string {
  if (!value || !value.startsWith("data:image/jpeg;base64,") || value.length > 1_500_000) return false;
  const bytes = Buffer.from(value.slice(23), "base64");
  return bytes.length > 1000 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
