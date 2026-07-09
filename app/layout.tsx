import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@toast-ui/editor/dist/toastui-editor.css";
import SessionProvider from "@/components/SessionProvider";
import Nav from "@/components/Nav";
import SiteFooter from "@/components/SiteFooter";
import dynamic from 'next/dynamic';

const DeadlineAlert = dynamic(() => import('@/components/DeadlineAlert'), { ssr: false });
const siteUrl = 'https://thomaslee.site';
const currentYear = new Date().getFullYear();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ThomasLee's Blog",
    template: "%s | ThomasLee's Blog",
  },
  description: "ThomasLee's personal blog for tech notes, tools, AI workflows, and long-form thoughts.",
  applicationName: "ThomasLee's Blog",
  authors: [{ name: 'ThomasLee', url: siteUrl }],
  creator: 'ThomasLee',
  publisher: 'ThomasLee',
  alternates: { canonical: '/' },
  keywords: ['ThomasLee', 'thomaslee', 'blog', 'AI tools', 'Next.js', 'SQLite'],
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: "ThomasLee's Blog",
    title: "ThomasLee's Blog",
    description: "ThomasLee's personal blog for tech notes, tools, AI workflows, and long-form thoughts.",
  },
  other: {
    copyright: `Copyright © ${currentYear} ThomasLee`,
    'contact:email': 'zhichenli6@gmail.com',
    'contact:url': siteUrl,
    'contact:github': 'https://github.com/helloworld575',
  },
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col antialiased">
        <SessionProvider>
          <Nav />
          <DeadlineAlert />
          <div className="flex-1">
            {children}
          </div>
          <SiteFooter />
        </SessionProvider>
      </body>
    </html>
  );
}
