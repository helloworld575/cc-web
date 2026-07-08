import { describe, expect, it } from 'vitest';
import { extractMarkdownHeadings, slugifyHeading } from '@/lib/markdown-headings';

describe('markdown headings', () => {
  it('creates stable ids for English, Chinese, and duplicate headings', () => {
    expect(slugifyHeading('Small tricks from the workbench')).toBe('small-tricks-from-the-workbench');
    expect(slugifyHeading('工作台里的小技巧')).toBe('工作台里的小技巧');

    const headings = extractMarkdownHeadings([
      '# Post title',
      '## 工作台里的小技巧',
      '### Direct CSRF login',
      '## 工作台里的小技巧',
    ].join('\n'));

    expect(headings).toEqual([
      { depth: 2, text: '工作台里的小技巧', id: '工作台里的小技巧' },
      { depth: 3, text: 'Direct CSRF login', id: 'direct-csrf-login' },
      { depth: 2, text: '工作台里的小技巧', id: '工作台里的小技巧-2' },
    ]);
  });

  it('ignores fenced code headings', () => {
    const headings = extractMarkdownHeadings([
      '## Visible',
      '```ts',
      '## Not a heading',
      '```',
      '### Also visible',
    ].join('\n'));

    expect(headings.map(heading => heading.text)).toEqual(['Visible', 'Also visible']);
  });
});
