export const SUBSCRIPTION_TOPICS = ['ai', 'security'] as const;
export type SubscriptionTopic = (typeof SUBSCRIPTION_TOPICS)[number];

export const SUBSCRIPTION_FETCH_CATEGORIES = [
  'github',
  'x',
  'blog',
  'selfblog',
  'rss',
  'newsletter',
  'reddit',
  'general',
  'other',
] as const;

export function isSubscriptionTopic(value: unknown): value is SubscriptionTopic {
  return typeof value === 'string'
    && (SUBSCRIPTION_TOPICS as readonly string[]).includes(value);
}

export function isSubscriptionFetchCategory(value: unknown): value is string {
  return typeof value === 'string'
    && (SUBSCRIPTION_FETCH_CATEGORIES as readonly string[]).includes(value);
}
