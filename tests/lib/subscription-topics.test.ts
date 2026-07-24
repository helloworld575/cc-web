import { describe, expect, it } from 'vitest';
import {
  getSubscriptionGenerationSkillId,
  isSubscriptionFetchCategory,
  SUBSCRIPTION_TOPICS,
} from '@/lib/subscription-topics';

describe('subscription topic skill routing', () => {
  it('maps every supported topic to a dedicated generation skill', () => {
    expect(SUBSCRIPTION_TOPICS.map(topic => [topic, getSubscriptionGenerationSkillId(topic)]))
      .toEqual([
        ['ai', 'subscription-ai'],
        ['security', 'subscription-security'],
      ]);
  });

  it('accepts structured JSON sources alongside RSS and X sources', () => {
    expect(isSubscriptionFetchCategory('json')).toBe(true);
    expect(isSubscriptionFetchCategory('rss')).toBe(true);
    expect(isSubscriptionFetchCategory('x')).toBe(true);
  });
});
