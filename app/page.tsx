'use client';
import Link from "next/link";
import { useLocale } from "@/components/useLocale";

export default function Home() {
  const { t } = useLocale();
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 fade-in">
      <h1 className="text-4xl font-bold mb-4">{t('homeTitle')}</h1>
      <p className="text-gray-600 mb-8">{t('homeDesc')}</p>
      <div className="flex gap-4">
        <Link href="/blog" className="underline">{t('blog')}</Link>
        <Link href="/tools" className="underline">{t('tools')}</Link>
        <Link href="/files" className="underline">{t('files')}</Link>
      </div>
    </main>
  );
}
