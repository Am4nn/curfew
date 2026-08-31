import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { ThemeToggle } from "./theme-toggle";

export const metadata: Metadata = {
  title: "Curfew",
  description: "A group accountability contract engine.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Default dark. Read the cookie server-side so SSR stamps the chosen theme
  // and there is no flash on load.
  const theme =
    (await cookies()).get("theme")?.value === "light" ? "light" : "dark";

  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <body>
        <ThemeToggle initial={theme} />
        {children}
      </body>
    </html>
  );
}
