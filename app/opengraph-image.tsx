import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = "ThomasLee's Blog";
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };

export default function OpenGraphImage({ searchParams }: { searchParams?: { title?: string } }) {
  const title = typeof searchParams?.title === 'string' && searchParams.title.trim()
    ? searchParams.title.trim().slice(0, 80)
    : '技术、工具与 AI 工作流';
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0f172a',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          justifyContent: 'space-between',
          padding: '72px',
          width: '100%',
        }}
      >
        <div style={{ color: '#7dd3fc', display: 'flex', fontSize: 30, fontWeight: 700 }}>
          THOMASLEE / BLOG
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: -2 }}>
            {title}
          </div>
          <div style={{ color: '#cbd5e1', fontSize: 32 }}>
            Practical notes for building useful systems.
          </div>
        </div>
        <div style={{ color: '#94a3b8', display: 'flex', fontSize: 24 }}>
          thomaslee.site
        </div>
      </div>
    ),
    { ...size },
  );
}
