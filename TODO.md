# TODO

## sec-ai-tools NAS and cc-web integration

Status snapshot: 2026-09-29. These observations describe the checks performed that day; recheck before the next deployment. The sanitized log query was `npm run nas:logs -- --service app --since 1h --grep security-bff --no-save`; no matching output does not demonstrate successful authenticated forwarding.

Last read-only NAS checks confirmed that the sec-ai Compose services are healthy: `/health` returns 200 with container attestation, egress policy, toolchains, and network assessments ready; the runner has no restarts, and `/app/` returns 200. The runner, gateway, and egress proxy have the expected network memberships. The older 503 is no longer current, and its exact cause is not in the recent health history.

The cc-web integration is still unconfigured. `SECURITY_API_URL` and `SECURITY_API_KEY` are empty or missing in the local `.env.local`, the NAS cc-web environment file, and the running app container. Unauthenticated BFF requests return the expected 401, but authenticated forwarding has not been tested. Sanitized NAS logs for the last hour had no `security-bff` matches.

- [ ] Confirm and record the exact `sec_ai_tool` source revision behind the running `0.2.0-current` image digest. The source worktree was four commits ahead of its remote and had uncommitted changes during the last check; run lint, tests, and build on the reviewed revision before treating its image provenance as complete.
- [ ] Securely verify that the NAS and cc-web API keys are configured and match without printing either value. Confirm `SEC_AI_SCAN_ROOT` is a dedicated read-only path, synchronize `SEC_AI_ALLOWED_TARGETS` with `runner/egress/allowlist.txt`, and keep active scans disabled until the policy has been reviewed.
- [ ] Finish operational security checks: confirm the gateway publishes only on loopback, inspect bounded logs and resource limits, and test that allowlisted egress succeeds while direct and unlisted destinations are denied.
- [ ] Configure `SECURITY_API_URL` and `SECURITY_API_KEY` for the NAS cc-web app. The URL must be reachable from inside the app container through a reviewed NAS endpoint or reverse proxy; do not use `127.0.0.1:3001` from that container.
- [ ] After the cc-web configuration is deployed, verify an authenticated `/api/security/health` request and a read-only `/api/security/v1/projects` request, then confirm the security workbench loads without exposing the service key to the browser.
- [ ] If the runner returns 503 again, capture sanitized logs and the failing `/v1/toolchains` item statuses before restarting anything; the prior failure's root cause remains unconfirmed.
