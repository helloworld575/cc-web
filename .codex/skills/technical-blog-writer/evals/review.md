# Blog skill review — 2026-11-09

Scope: evidence, data provenance and technical security depth in the blog writer.
No article publication, subscription scheduler change or production deployment.

## Previous article review

The local Nov 5 article artifact was reviewed as existing prose, not revalidated as
current news. It already attributed vendor claims and distinguished several dates.
The review found gaps the new contract specifically addresses:

| Observed gap | New requirement |
| --- | --- |
| Three benchmark percentages lack denominator, dataset version, budget and prior-version baseline | Record measurement conditions or mark missing; constrain conclusions and comparisons |
| Chemistry tooling example leads to a security workflow recommendation | Make cross-domain inference explicit and require direct security mechanism evidence for capability claims |
| Agent visibility versus authorization is discussed without protocol/component detail | Identify software, interfaces, data flow, permissions and trust boundaries |
| Vulnerability advice leaves patch mechanism and version validation underspecified | Explain affected scope, preconditions, patch evidence and concrete proposed checks |
| No GitHub implementation or linux.do practitioner investigation | Investigate both where tools permit, record access limits, and cross-check relevant observations |

## Automated validation

- Test-first: the on-disk contract and Anthropic/Responses forwarding tests failed
  before the skill edit (3 failures: absent system instructions). After adding the
  contract and removing the unsupported topic placeholder, the focused suite passed.
- `npm run codex:skills` and `npm run codex:cache` completed.
- `npm run lint` passed (format, architecture, TypeScript).
- `npm test`: 72 files, 436 tests passed.
- Existing admin skill finder e2e passed. The new blog skill e2e passed after fixing
  test selectors, explicitly opening the chat tab and checking input/stream completion
  instead of expecting an empty composer to enable Send. It checks real skill
  metadata and selection with the existing mock stream; it does not grade model prose.

## Behavioral evaluation status

Four offline cases in `cases.md` cover missing benchmark context, a read-to-write
capability change, corrected community claims, and vulnerability chronology.
Baseline/runtime comparisons were prepared for cases 1 and 3. Full skill plus
research reference inputs were prepared for cases 2 and 4. No evaluator received
the reviewer rubric in its generation input.

**Generation evaluation remains uncompleted.** The configured provider returned
HTTP 400 for baseline inputs and HTTP 502 for revised inputs in both non-streaming
and streaming attempts. No reviewable model output was produced. These failures
do not establish a prompt defect or a provider root cause. No quality score,
baseline improvement percentage, or factual-accuracy pass is claimed.

Local diagnostic artifacts: `log/automation/blog-skill-eval/run-metadata.json` and
managed `blog-skill-behavior` logs (ignored by Git). The latest attempt ended at
2026-11-09T03:00:47Z. Headers, credentials and raw upstream error bodies were not
included in the report. Rerun the cases with a working provider, retain outputs,
and grade against the rubric before claiming behavioral improvement.

## Applicability

The essential instructions are in YAML `system`, because web calls do not consume
the Markdown body or linked references. Tool-enabled agents can conduct research;
plain text calls can only assess supplied evidence. Existing production containers
still require deployment to pick up the changed skill. Prompt rules support
editorial review; they are not a programmatic factual-accuracy or publishing gate.
