import { describe, expect, it } from 'vitest';
import { localeToHtmlLang, resolveLocale, translations } from '@/lib/i18n';

const mojibakeMarkers = ['鈥', '鈫', '锟', 'Ã', 'Â', '�'];

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

  it('normalizes request locale values for the server-rendered document', () => {
    expect(resolveLocale('zh')).toBe('zh');
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('fr')).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
    expect(localeToHtmlLang('zh')).toBe('zh-CN');
    expect(localeToHtmlLang('en')).toBe('en');
  });

  it('covers the main admin and error surfaces in both languages', () => {
    const requiredKeys = [
      'adminNavAnalytics',
      'adminNavAiProviders',
      'adminAiProvidersTitle',
      'adminDiaryTitle',
      'adminSubscriptionsTitle',
      'adminBlogAnalyticsTitle',
      'adminSkillsTitle',
      'notFoundTitle',
      'errorTitle',
      'retry',
    ] as const;

    for (const key of requiredKeys) {
      expect(translations.en[key]).toBeTruthy();
      expect(translations.zh[key]).toBeTruthy();
      expect(translations.en[key]).not.toBe(translations.zh[key]);
    }
  });

  it('defines localized client-safe API error messages', () => {
    const errorKeys = [
      'apiErrorGeneric',
      'apiErrorUnauthorized',
      'apiErrorRateLimited',
      'apiErrorProviderForbidden',
      'apiErrorProviderInvalidResponse',
      'apiErrorProviderUnavailable',
      'apiErrorImagePermission',
      'apiErrorWorkerFailed',
    ] as const;

    for (const key of errorKeys) {
      expect(translations.en[key]).toMatch(/[A-Za-z]/);
      expect(translations.zh[key]).toMatch(/[\u4e00-\u9fff]/);
    }
  });
});
