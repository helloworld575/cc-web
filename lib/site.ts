export const SITE_URL = 'https://thomaslee.site';
export const SITE_NAME = "ThomasLee's Blog";
export const SITE_AUTHOR = 'ThomasLee';

export function absoluteUrl(pathname: string) {
  return new URL(pathname, `${SITE_URL}/`).toString();
}

export function blogUrl(slug: string) {
  return absoluteUrl(`/blog/${encodeURIComponent(slug)}`);
}
