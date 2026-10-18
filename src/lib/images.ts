import "server-only";

// ID photos and signatures are stored as data: URLs. Pages link to them by
// URL instead of putting the image inside the page, so a page that refreshes
// every few seconds doesn't resend them, and an image in a closed section is
// only downloaded when someone opens it.
export function imageResponse(dataUrl: string | undefined | null) {
  const match = dataUrl ? /^data:(image\/(?:png|jpeg));base64,(.+)$/.exec(dataUrl) : null;
  if (!match) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(Buffer.from(match[2], "base64")), {
    headers: { "Content-Type": match[1], "Cache-Control": "private, no-store" },
  });
}
