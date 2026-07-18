import { describe, expect, it } from 'vitest';
import {
  getSubscriptionGenerationSkillId,
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
});
