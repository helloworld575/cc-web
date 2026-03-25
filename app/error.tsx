'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-semibold">出错了</h2>
      <p className="text-gray-500">{error.message || '发生了意外错误'}</p>
      <button onClick={reset} className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
        重试
      </button>
    </div>
  );
}
