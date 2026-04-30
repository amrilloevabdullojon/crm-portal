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

## Telegram linking

Production login requires `telegram_chat_id` on the user record. Users can link Telegram through the bot:

1. Open the Telegram bot.
2. Send `/start`.
3. Send the same phone number that exists in `users.phone`, for example `+998...`, or share the Telegram contact.
4. The Telegram webhook stores `message.chat.id` in `users.telegram_chat_id`.

If Telegram is not linked, `POST /api/auth/start` does not create a usable production login step. It returns `telegram_not_linked`, and the login form points the user to the bot configured by `TELEGRAM_BOT_USERNAME`.

Webhook endpoint:

```text
POST /api/webhooks/telegram
```

The route validates Telegram's `x-telegram-bot-api-secret-token` header against:

```text
TELEGRAM_WEBHOOK_SECRET=
```

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
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=
```

`AUTH_SESSION_SECRET` must be a long random string. It signs session cookies and challenge code hashes.
