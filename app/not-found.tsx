import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">404</p>
      <h1 className="mt-4 text-4xl font-semibold text-slate-950">Page not found</h1>
      <p className="mt-4 max-w-md text-sm leading-7 text-slate-600">
        The page you requested does not exist or is no longer available.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Back home
      </Link>
    </main>
  );
}
