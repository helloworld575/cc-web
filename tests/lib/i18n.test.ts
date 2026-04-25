import { describe, expect, it } from 'vitest';
import { translations } from '@/lib/i18n';

const mojibakeMarkers = ['鈥', '鈫', '漏', '路', 'б', '�'];

describe('i18n translations', () => {
  it('keeps English and Chinese dictionaries in sync', () => {
    expect(Object.keys(translations.zh).sort()).toEqual(Object.keys(translations.en).sort());
  });

  it('does not contain common mojibake markers', () => {
    const allText = Object.values(translations)
      .flatMap(locale => Object.values(locale))
      .join('\n');

    for (const marker of mojibakeMarkers) {
      expect(allText).not.toContain(marker);
    }
  });

  it('includes Chinese labels for image and chat tools', () => {
    expect(translations.zh.imageGenerate).toBe('生成图片');
    expect(translations.zh.aiChatMarkdownSupport).toContain('Markdown');
  });
});
