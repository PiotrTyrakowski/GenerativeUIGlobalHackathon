import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Infinite Canvas + Claude",
  description: "AI-driven infinite canvas powered by Claude and AG-UI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="h-screen overflow-hidden bg-neutral-950 text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
}
