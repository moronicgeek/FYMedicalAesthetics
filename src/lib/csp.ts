// Content Security Policy for pages (set in src/middleware.ts). Scripts only run if they carry this
// request's nonce (Next.js adds it to its own scripts), so injected inline
// script can't run. 'strict-dynamic' lets those scripts load the app's chunks.
// Styles keep 'unsafe-inline' for React style attributes.
export function contentSecurityPolicy(nonce: string, dev = process.env.NODE_ENV === "development") {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
  ].join("; ");
}
