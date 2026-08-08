import { describe, expect, it } from 'vitest';
import {
  isSubscriptionFetchCategory,
  isSubscriptionTopic,
  SUBSCRIPTION_TOPICS,
} from '@/lib/subscription-topics';

describe('subscription topic classification', () => {
  it('keeps the supported source topics without generation-skill routing', () => {
    expect(SUBSCRIPTION_TOPICS).toEqual(['ai', 'security']);
    expect(isSubscriptionTopic('ai')).toBe(true);
    expect(isSubscriptionTopic('security')).toBe(true);
    expect(isSubscriptionTopic('daily')).toBe(false);
  });

  it('accepts structured JSON sources alongside RSS and X sources', () => {
    expect(isSubscriptionFetchCategory('json')).toBe(true);
    expect(isSubscriptionFetchCategory('rss')).toBe(true);
    expect(isSubscriptionFetchCategory('x')).toBe(true);
  });
});
