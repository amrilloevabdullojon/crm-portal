# DMED Portal

Next.js service that replaces the legacy Google Apps Script flow for clinic onboarding.

## What It Does

- receives amoCRM lead status webhooks;
- creates clinics, client users, and onboarding modules in Supabase;
- creates clinic folders in Google Drive;
- lets clients upload module files;
- lets admins accept modules or request revisions.

Production is deployed on Vercel:

```text
https://dmed-portal.vercel.app
```

## Stack

- Next.js App Router
- Supabase Postgres
- Google Drive API
- Telegram Bot API
- amoCRM API
- Vercel

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run check:env
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment Variables

Use `.env.example` as the template. Never commit `.env.local`.

Important production variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_SESSION_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_WEBHOOK_SECRET`
- `AMOCRM_DOMAIN`
- `AMOCRM_ACCESS_TOKEN`
- `AMOCRM_WEBHOOK_SECRET`
- `AMOCRM_TARGET_STATUS_IDS`
- `GOOGLE_DRIVE_ROOT_FOLDER_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `SLACK_WEBHOOK_URL` or `SLACK_BOT_TOKEN` + `SLACK_ADMIN_CHANNEL_ID`

Current target statuses:

```text
MIS -> Заявка: 84088646
Delivery -> Сбор: 85285282
```

## Supabase

Run migrations in order from:

```text
supabase/migrations
```

The schema includes:

- `users`
- `clinics`
- `clinic_users`
- `module_templates`
- `clinic_modules`
- `uploaded_files`
- `activity_log`
- `integration_events`
- `auth_challenges`

## amoCRM Webhook

Production endpoint:

```text
https://dmed-portal.vercel.app/api/webhooks/amo?secret=<AMOCRM_WEBHOOK_SECRET>
```

The webhook should listen to lead status changes.

Docs:

- `docs/stages/03-amocrm-webhook.md`

## Telegram Login

Users must link Telegram before production login can deliver one-time codes:

1. Open the bot.
2. Send `/start`.
3. Press the Telegram button to share the phone number.

The app stores the Telegram chat id in `users.telegram_chat_id`.
If a user tries to log in before linking Telegram, the login form shows a link to the bot from `TELEGRAM_BOT_USERNAME`.

## Admin

Admin users can use:

- `/admin` for clinic overview, module queue, and recent events;
- `/admin/clinics/<id>` for clinic contacts, files, and module actions;
- `/admin/users` for adding clients/managers, changing roles, unlinking Telegram, and clinic access;
- `/admin/events` for integration monitoring;
- `/api/admin/events` for the same event list as JSON.

The clinic page also contains the admin handoff actions:

- `Выдать доступы` sends an urgent Slack request after `Общая информация` is accepted;
- `Отправить настройку` sends the final setup request after all modules are accepted.

Managers can also manually sync an amoCRM deal from `/admin`, and retry failed or ignored amoCRM events from `/admin/events`.

## Useful Commands

```bash
npm run check:env
npm run lint
npm run build
npm run import:legacy -- --file ./legacy.csv
```

## Deployment

The Vercel project is connected to:

```text
https://github.com/amrilloevabdullojon/crm-portal
```

Pushes to `main` can be deployed by Vercel Git integration. Production env vars are stored in Vercel as encrypted variables.
