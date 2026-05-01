# DMED Portal Implementation Phases

## Phase 1: Client UX

- Portal module filters: all, needs action, review, accepted.
- Quick links from urgent actions to the target module.
- Clear current file, version history, SLA, and timeline views.

## Phase 2: Telegram Auth

- Clear Telegram linking instructions in the login flow.
- Rate limit code verification attempts.
- Better production errors when a phone exists but Telegram is not linked.

## Phase 3: Drive And Files

- Surface the actual files folder in the portal/admin handoff.
- Track failed Drive operations for retry.
- Make accepted-file copying visible in integration monitoring.

## Phase 4: SLA

- Log SLA start/reset/overdue events.
- Add an SLA-focused admin report.
- Add scheduled checks for overdue review/SLA items.

## Phase 5: Integration Reliability

- Add Telegram notification delivery tracking.
- Add retry for failed Telegram notifications.
- Add integration health/debug checks for Telegram, Drive, amoCRM, and Slack.

## Phase 6: Hardening

- Move integration settings into a dedicated settings table.
- Add focused tests for auth, uploads, portal activity, and integration retries.
- Add stronger session/security controls such as global logout.

Initial hardening now includes `integration_settings` for DB-backed integration configuration and a small `node --test` suite for settings parsing.
