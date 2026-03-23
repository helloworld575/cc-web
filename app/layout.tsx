import type { Metadata, Viewport } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import Nav from "@/components/Nav";
import DeadlineAlert from "@/components/DeadlineAlert";

export const metadata: Metadata = {
  title: "ThomasLee's Blog",
  description: "ThomasLee's personal blog — tech, tools, and thoughts.",
  icons: { icon: '/icon.svg' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SessionProvider>
          <Nav />
          <DeadlineAlert />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
