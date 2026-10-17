import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Lumiere Clinic", template: "%s · Lumiere Clinic" },
  description: "Patient intake and appointments for Lumiere Clinic.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#efeeec" };

const TEXT_SIZES = new Set(["normal", "large", "xlarge"]);

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const saved = (await cookies()).get("fy_text")?.value;
  const textSize = saved && TEXT_SIZES.has(saved) ? saved : "normal";
  return (
    <html lang="en" data-text={textSize}>
      <body className="min-h-screen">
        <a href="#main" className="skip-link">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}
