# Auth flow

The first auth version uses phone-based one-time codes.

## Flow

1. User enters a phone number on `/login`.
2. `POST /api/auth/start` normalizes the phone and finds an active user.
3. The backend creates a six-digit code, stores only `code_hash` in `auth_challenges`, and expires it after 10 minutes.
4. If the user has `telegram_chat_id` and `TELEGRAM_BOT_TOKEN` is configured, the code is sent through Telegram.
5. In local development, if Telegram delivery is unavailable, the API returns `devCode`.
6. `POST /api/auth/verify` validates the code and sets an httpOnly signed session cookie.
7. `/portal`, `/admin`, portal API, upload API, and admin APIs require this cookie.

## Demo users

When Supabase env vars are missing, the app uses in-memory demo users:

```text
+998000000001 -> admin
+998000000002 -> client
```

## Required env vars for production

```text
AUTH_SESSION_SECRET=
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
TELEGRAM_BOT_TOKEN=
```

`AUTH_SESSION_SECRET` must be a long random string. It signs session cookies and challenge code hashes.

