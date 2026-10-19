import { z } from "zod";

// Staff report problems with the app to the developer. Nothing from the page
// itself is captured: only which screen it was, with record IDs and the query
// string taken out, so neither the report nor its email points at a patient.

export const problemSchema = z.object({
  whatHappened: z.string().trim().min(1, "Please say what went wrong.").max(2000, "Please keep this under 2000 characters."),
  expected: z.string().trim().max(2000, "Please keep this under 2000 characters.").optional().transform((v) => v || undefined),
  path: z.string().optional(),
  screen: z.string().max(40).optional(),
});

export type ProblemDetails = { whatHappened: string; expected?: string };

// A path segment that isn't a plain word (a cuid, token, number or ID)
// becomes ":id".
const PLAIN_SEGMENT = /^[a-z]+(-[a-z]+)*$/;
const SAFE_BRACKET = /^\(.*\)$/;

export function screenPath(raw: string | undefined | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  const path = raw.split(/[?#]/)[0];
  const parts = path
    .split("/")
    .filter(Boolean)
    .slice(0, 6)
    .map((seg) => (PLAIN_SEGMENT.test(seg) || SAFE_BRACKET.test(seg) ? seg : ":id"));
  return `/${parts.join("/")}`;
}

const BROWSERS: [RegExp, string][] = [
  [/Edg\/(\d+)/, "Edge"],
  [/SamsungBrowser\/(\d+)/, "Samsung Internet"],
  [/Chrome\/(\d+)/, "Chrome"],
  [/Firefox\/(\d+)/, "Firefox"],
  [/Version\/(\d+).*Safari/, "Safari"],
];
const SYSTEMS: [RegExp, string][] = [
  [/Android/, "Android"],
  [/iPad/, "iPad"],
  [/iPhone/, "iPhone"],
  [/Windows/, "Windows"],
  [/Mac OS X/, "Mac"],
  [/Linux/, "Linux"],
];

// A short browser and device label, e.g. "Chrome 141 on Android · 1280×800".
export function deviceLabel(userAgent: string | null | undefined, screen?: string): string | undefined {
  const ua = userAgent ?? "";
  let browser: string | undefined;
  for (const [re, name] of BROWSERS) {
    const m = re.exec(ua);
    if (m) { browser = `${name} ${m[1]}`; break; }
  }
  const os = SYSTEMS.find(([re]) => re.test(ua))?.[1];
  const size = screen && /^\d{2,5}×\d{2,5}$/.test(screen) ? screen : undefined;
  return [[browser, os].filter(Boolean).join(" on "), size].filter(Boolean).join(" · ") || undefined;
}
