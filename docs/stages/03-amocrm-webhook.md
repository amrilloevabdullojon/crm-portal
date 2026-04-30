# Stage 3: amoCRM webhook

The app now supports:

```text
POST /api/webhooks/amo
```

## Current trigger

The webhook only processes leads when the amoCRM status matches one of the configured target statuses:

```env
AMOCRM_TARGET_STATUS_ID=84088646
# or
AMOCRM_TARGET_STATUS_IDS=84088646
```

In the connected account this status is:

```text
Pipeline: MIS
Status: Заявка
ID: 84088646
```

All other statuses are stored in `integration_events` and marked as `ignored`.

## What processing does

For a new amoCRM deal:

1. stores the raw webhook in `integration_events`;
2. ignores the event if the clinic already exists by `amo_deal_id`;
3. fetches the full deal from amoCRM;
4. creates a clinic in `clinics`;
5. creates default modules, currently `Общая информация` and `Прайс`;
6. fetches linked contacts and creates/links users by phone;
7. creates Google Drive clinic folders;
8. writes `activity_log`.

## Webhook URL

Local development needs a public tunnel such as ngrok or Cloudflare Tunnel:

```text
https://<public-url>/api/webhooks/amo?secret=<AMOCRM_WEBHOOK_SECRET>
```

Production/Vercel:

```text
https://<your-domain>/api/webhooks/amo?secret=<AMOCRM_WEBHOOK_SECRET>
```

The same secret can also be sent as an `x-amo-webhook-secret` header if the webhook provider supports custom headers.

## Smoke tests already run

The local route was tested for safe cases:

- existing `amo_deal_id=100001` returns `clinic_exists`;
- non-target status returns `non_target_status`;
- both events are saved in `integration_events`;
- no duplicate clinic was created.
