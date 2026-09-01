import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { previewEnabled } from "@/lib/preview";
import { PreviewBar } from "./preview-bar";
import { TabBar } from "./nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Curfew",
  description: "A group accountability contract engine.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0a09" },
    { media: "(prefers-color-scheme: light)", color: "#e8e6e1" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Default dark. Read the cookie server-side so SSR stamps the chosen theme and
  // there is no flash on load. The switch itself lives in Settings.
  const theme =
    (await cookies()).get("theme")?.value === "light" ? "light" : "dark";

  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <body>
        {children}
        <TabBar />
        {previewEnabled() ? <PreviewBar /> : null}
      </body>
    </html>
  );
}
