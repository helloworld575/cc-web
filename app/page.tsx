'use client';

import Link from "next/link";
import { useLocale } from "@/components/useLocale";

export default function Home() {
  const { locale, t } = useLocale();
  const isZh = locale === 'zh';
  const currentYear = new Date().getFullYear();

  return (
    <main className="mx-auto max-w-5xl px-6 py-16 fade-in">
      <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] px-8 py-10 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          {isZh ? '个人站点' : 'Personal site'}
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950">{t('homeTitle')}</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">{t('homeDesc')}</p>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
          {isZh
            ? '这里记录技术笔记、AI 工作流、个人工具与长期写作，也公开提供基础联系与版权信息。'
            : 'This is where I publish tech notes, AI workflows, personal tools, and long-form writing, with public identity and rights information kept easy to find.'}
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link href="/blog" className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
            {t('blog')}
          </Link>
          <Link href="/tools" className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white">
            {t('tools')}
          </Link>
          <Link href="/files" className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white">
            {t('files')}
          </Link>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <article className="rounded-[26px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            {isZh ? '公开资料' : 'Public profile'}
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950">
            {isZh ? '关于 ThomasLee' : 'About ThomasLee'}
          </h2>
          <div className="mt-5 space-y-4 text-sm text-slate-600">
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Identity</p>
              <p className="mt-2 font-mono text-base text-slate-900">ID · thomaslee</p>
            </div>
            <div className="grid gap-3">
              <div className="rounded-2xl border border-slate-200 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Email</p>
                <a
                  href="mailto:zhichenli6@gmail.com"
                  className="mt-2 inline-block text-base font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 transition hover:text-sky-700"
                >
                  zhichenli6@gmail.com
                </a>
              </div>
              <div className="rounded-2xl border border-slate-200 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Blog</p>
                <a
                  href="https://thomaslee.site"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-base font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 transition hover:text-sky-700"
                >
                  thomaslee.site
                </a>
              </div>
              <div className="rounded-2xl border border-slate-200 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">GitHub</p>
                <a
                  href="https://github.com/helloworld575"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-base font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 transition hover:text-sky-700"
                >
                  helloworld575
                </a>
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-[26px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            {isZh ? '版权与合规' : 'Rights & compliance'}
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950">
            {isZh ? '基础公开说明' : 'Basic public notice'}
          </h2>
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
            <p className="rounded-2xl bg-slate-50 px-4 py-4 text-slate-900">
              {`Copyright © ${currentYear} ThomasLee. `}
              {isZh
                ? '除非另有说明，站内原创内容版权归 ThomasLee 所有。'
                : 'All original content on this site is owned by ThomasLee unless otherwise stated.'}
            </p>
            <p>
              {isZh
                ? '如涉及转载、署名修正、隐私处理或内容删除，请通过公开邮箱联系。'
                : 'For copyright, attribution, privacy, or content removal requests, email the public contact address listed on this page.'}
            </p>
            <p>
              {isZh
                ? '本站内容代表个人观点；涉及的第三方产品、链接、名称与商标归其各自权利人所有。'
                : 'Content on this site reflects personal views. Third-party products, links, names, and marks remain the property of their respective owners.'}
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}
