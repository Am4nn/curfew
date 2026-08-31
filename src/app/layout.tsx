import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Curfew",
  description: "A group accountability contract engine.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
