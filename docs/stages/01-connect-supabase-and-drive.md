# Stage 1: connect Supabase and Google Drive

This stage turns the scaffold from demo fallback into a real data-backed app.

## 1. Supabase

Create a Supabase project and configure:

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
AUTH_SESSION_SECRET=
```

Run migrations in order:

```text
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_seed_demo_data.sql
supabase/migrations/003_auth_challenges.sql
supabase/migrations/004_uploaded_files_legacy_unique.sql
```

After this, `/portal`, `/admin`, and portal API read from Postgres.

## 2. Google Drive

Create a Google Cloud service account, enable Google Drive API, and share the Drive root folder with the service account email.

Configure:

```env
GOOGLE_DRIVE_ROOT_FOLDER_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

The app creates:

```text
Root folder
  Clinic Name
    01_Source Uploads
      Module Name
    02_Actual
    03_Internal
```

## 3. Verify

Run:

```bash
npm run check:env
npm run lint
npm run build
```

Start the app and check:

```text
GET /api/health
POST /api/auth/start
POST /api/auth/verify
POST /api/portal/modules/:id/files
```

Expected upload result:

- file appears in Google Drive;
- row appears in `uploaded_files`;
- module status becomes `review`;
- row appears in `activity_log`.
