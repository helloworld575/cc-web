import type { Metadata, Viewport } from "next";
import { cookies } from 'next/headers';
import "./globals.css";
import "@toast-ui/editor/dist/toastui-editor.css";
import SessionProvider from "@/components/SessionProvider";
import Nav from "@/components/Nav";
import SiteFooter from "@/components/SiteFooter";
import DeadlineAlert from '@/components/DeadlineAlert';
import HydrationReady from '@/components/HydrationReady';
import LocaleProvider from '@/components/LocaleProvider';
import { localeToHtmlLang, resolveLocale } from '@/lib/i18n';

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get('locale')?.value);

  return (
    <html lang={localeToHtmlLang(locale)}>
      <body inert className="min-h-screen flex flex-col antialiased">
        <LocaleProvider initialLocale={locale}>
          <SessionProvider>
            <HydrationReady />
            <Nav />
            <DeadlineAlert />
            <div className="flex-1">
              {children}
            </div>
            <SiteFooter />
          </SessionProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
