'use client';

import { useLocale } from '@/components/useLocale';

export default function SiteFooter() {
  const { locale } = useLocale();
  const currentYear = new Date().getFullYear();
  const isZh = locale === 'zh';

  return (
    <footer className="mt-16 border-t border-slate-200 bg-slate-50/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 text-sm text-slate-600 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            {isZh ? '版权与联系' : 'Rights & Contact'}
          </p>
          <p className="mt-3 font-semibold text-slate-900">{`Copyright © ${currentYear} ThomasLee`}</p>
          <p className="mt-2 leading-7">
            {isZh
              ? '除非另有说明，站内原创内容归 ThomasLee 所有。第三方链接、名称与商标归其各自权利人所有。'
              : 'Unless otherwise stated, original content on this site belongs to ThomasLee. Third-party links, names, and marks belong to their respective owners.'}
          </p>
          <p className="mt-2 leading-7">
            {isZh
              ? '如有版权、署名、隐私或内容删除请求，请通过邮箱联系。'
              : 'For copyright, attribution, privacy, or content removal requests, please contact by email.'}
          </p>
        </div>

        <div className="grid gap-2 text-sm">
          <a
            href="mailto:zhichenli6@gmail.com"
            className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 transition hover:text-sky-700"
          >
            {isZh ? '邮件联系 ThomasLee' : 'Email ThomasLee'}
          </a>
          <a
            href="https://thomaslee.site"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-slate-300 underline-offset-4 transition hover:text-sky-700"
          >
            {isZh ? '访问主站' : 'Visit primary site'}
          </a>
          <a
            href="https://github.com/helloworld575"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-slate-300 underline-offset-4 transition hover:text-sky-700"
          >
            {isZh ? '查看 GitHub 主页' : 'View GitHub profile'}
          </a>
        </div>
      </div>
    </footer>
  );
}
