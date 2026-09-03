import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { previewEnabled } from "@/lib/preview";
import { getSessionUser } from "@/lib/session";
import { listInvitesForEmail } from "@/server/groups";
import { NoticeOverlay } from "./notice-overlay";
import { ConsentGate } from "./consent-gate";
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

  // The tab bar's own pending-invite dot (decision 33). A signed-out or
  // pending-approval visitor never has one, and the bar itself is hidden on
  // their routes anyway.
  const user = await getSessionUser();
  const invites = user ? await listInvitesForEmail(user.email) : [];

  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <body>
        {children}
        <TabBar hasPendingInvite={invites.length > 0} />
        <ConsentGate />
        <NoticeOverlay />
        {previewEnabled() ? <PreviewBar /> : null}
      </body>
    </html>
  );
}
