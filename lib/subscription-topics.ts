export const SUBSCRIPTION_TOPICS = ['ai', 'security'] as const;
export type SubscriptionTopic = (typeof SUBSCRIPTION_TOPICS)[number];

const SUBSCRIPTION_GENERATION_SKILLS = {
  ai: 'subscription-ai',
  security: 'subscription-security',
} as const satisfies Record<SubscriptionTopic, string>;

export type SubscriptionGenerationSkillId = (
  typeof SUBSCRIPTION_GENERATION_SKILLS
)[SubscriptionTopic];

export function getSubscriptionGenerationSkillId(topic: SubscriptionTopic) {
  return SUBSCRIPTION_GENERATION_SKILLS[topic];
}

export const SUBSCRIPTION_FETCH_CATEGORIES = [
  'github',
  'x',
  'blog',
  'selfblog',
  'rss',
  'json',
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
