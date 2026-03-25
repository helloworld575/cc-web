---
name: audit-fix-plan
description: Full audit fix plan for atlas-scope (my-site) — security, stability, architecture, algorithm correctness
type: project
---

# Audit Fix Plan: atlas-scope (my-site)

**Status: ALL PHASES COMPLETE** (2026-03-24)
**Project path:** `/Users/bytedance/claude_place/my-site`

---

## Phase 1: CRITICAL Security Fixes ✅

| Task | File | Fix |
|------|------|-----|
| 1A. Path traversal in uploads | `app/api/uploads/[...path]/route.ts` | `path.resolve()` + `startsWith` check, `X-Content-Type-Options: nosniff`, SVG CSP header |
| 1B. Path traversal in skills/[id] | `app/api/skills/[id]/route.ts` | Added `/^[a-z0-9-]+$/` validation to GET, PUT, DELETE |
| 1C. Remove SVG from uploads | `app/api/files/route.ts` | Removed `.svg` from `ALLOWED_EXTS` |

## Phase 2: HIGH Security Fixes ✅

| Task | File | Fix |
|------|------|-----|
| 2A. Auth for fortune/bazi | `app/api/fortune/route.ts`, `app/api/bazi/route.ts` | Added `getServerSession` check |
| 2B. Auth for GET endpoints | `todos/route.ts`, `todos/[id]/route.ts`, `files/route.ts`, `skills/[id]/route.ts` | Added session check to GET |
| 2C. Rate limiter | `lib/rateLimit.ts` (NEW) | In-memory IP-based, 10/min for fortune/bazi/ai |
| 2C. Auth rate limit | `middleware.ts` | 5/min POST to `/api/auth` |
| 2D. Error boundaries | `app/error.tsx`, `app/global-error.tsx` (NEW) | User-friendly error + retry button |

## Phase 3: Stability Fixes ✅

| Task | File | Fix |
|------|------|-----|
| 3A. SQLite WAL + busy timeout | `lib/db.ts` | `pragma journal_mode=WAL`, `busy_timeout=5000` |
| 3B. MongoDB error handling | `lib/mongo.ts` | `.catch()` on connect, timeout options, global cache in prod |
| 3C. Shared Response fix | `fortune/history/route.ts`, `fortune/history/[id]/route.ts` | `const NO_MONGO` → `function noMongo()` |
| 3D. Stream cancel() | `fortune/route.ts`, `bazi/route.ts`, `ai/route.ts` | Added `cancel()` to ReadableStream |
| 3E. res.body null check | `FortuneTool.tsx`, `BaziTool.tsx`, `admin/blog/[slug]/page.tsx` | `res.body!` → `res.body?.getReader()` + null check |
| 3F. fetch .catch() | 9 files (tools, admin/blog, diary, tools, skills, files, DeadlineAlert) | `.then(r => r.ok ? r.json() : Promise.reject()).catch(() => {})` |
| 3G. Admin error handling | 6 admin pages | Check `res.ok` before updating local state |
| 3H. req.json() try/catch | All POST/PUT API routes | Wrapped in try/catch, return 400 on parse failure |

## Phase 4: Algorithm Correctness Fixes ✅

| Task | File | Fix |
|------|------|-----|
| 4A. Hour stem calc | `lib/bazi.ts:98` | `dayIdx % 5` → `(dayIdx % 10) % 5` |
| 4B. timeToHexagram | `lib/yijing.ts:164-172` | Use 7/8 for non-moving lines, 9/6 only for moving line |
| 4C. formatLines display | `lib/yijing.ts:191-198` | Old yang(9)=solid ○, old yin(6)=broken × |
| 4D. NAYIN_ELEMENTS[16-17] | `lib/ziwei.ts:9` | `'日月'` → `'金'` (白蜡金), removed `'日月'` from JU_BY_NAYIN |
| 4E. Palace direction | `lib/ziwei.ts:96` | `(mingGongBranchIdx + i)` → `(mingGongBranchIdx - i)` (counter-clockwise) |
| 4F. Lichun date | `lib/bazi.ts:66` | Hardcoded Feb 4 → year-dependent approximation |
| 4G. Solar term boundary | `lib/bazi.ts:76` | Hardcoded `day < 6` → month-specific lookup array |

## Phase 5: Minor Fixes ✅

| Task | File | Fix |
|------|------|-----|
| 5A. YAML escaping | `lib/markdown.ts:41` | Title/brief wrapped in quotes with `"` escaping |
| 5B. Upstream JSON parse | `fortune/route.ts`, `bazi/route.ts`, `ai/route.ts` | `await upstream.json()` wrapped in try/catch |

## Verification

- `npx tsc --noEmit` — **0 errors** ✅
- All changes are local, not committed yet
