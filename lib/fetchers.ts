/**
 * Re-exports from the subscription skill's standalone fetch script.
 * The skill owns the fetcher logic; this file makes it importable by Next.js API routes.
 */
export { fetchByCategory, fetchGeneric } from '../.codex/skills/subscription/scripts/fetch-content';
export type { FetchedContent, FetchedItem } from '../.codex/skills/subscription/scripts/fetch-content';
