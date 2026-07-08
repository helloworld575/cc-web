export interface MarkdownHeading {
  depth: 2 | 3;
  text: string;
  id: string;
}

function stripInlineMarkdown(text: string) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .trim();
}

export function slugifyHeading(text: string) {
  let slug = '';

  for (const char of stripInlineMarkdown(text).toLowerCase().normalize('NFKC')) {
    if (/[a-z0-9]/.test(char)) {
      slug += char;
      continue;
    }

    if (char === '-' || /\s/.test(char)) {
      slug += '-';
      continue;
    }

    if (char.charCodeAt(0) > 127 && !/[，。！？、：；“”‘’（）【】《》]/.test(char)) {
      slug += char;
    }
  }

  slug = slug
    .trim()
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  return slug || 'section';
}

export function extractMarkdownHeadings(markdown: string): MarkdownHeading[] {
  const usedIds = new Map<string, number>();
  const headings: MarkdownHeading[] = [];
  let inFence = false;

  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }

    if (inFence) continue;

    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;

    const text = stripInlineMarkdown(match[2]);
    if (!text) continue;

    const baseId = slugifyHeading(text);
    const count = usedIds.get(baseId) ?? 0;
    usedIds.set(baseId, count + 1);
    const id = count === 0 ? baseId : `${baseId}-${count + 1}`;

    headings.push({
      depth: match[1].length as 2 | 3,
      text,
      id,
    });
  }

  return headings;
}
