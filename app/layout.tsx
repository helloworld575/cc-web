import type { Metadata, Viewport } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import Nav from "@/components/Nav";
import DeadlineAlert from "@/components/DeadlineAlert";

export const metadata: Metadata = { title: "My Site" };
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
