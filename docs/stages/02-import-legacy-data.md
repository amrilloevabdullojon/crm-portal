# Stage 2: import legacy Google Sheets data

Export the old Google Sheets tabs as CSV files into one folder:

```text
legacy-export/
  Clinics_Deals.csv
  Clinic_Users.csv
  Modules_Status.csv
```

Then run:

```bash
NEXT_PUBLIC_SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
npm run import:legacy -- legacy-export
```

The importer maps:

```text
Clinics_Deals  -> clinics
Clinic_Users   -> users + clinic_users
Modules_Status -> clinic_modules + uploaded_files
```

Status mapping:

```text
Сбор данных       -> data_collection
В работе (SLA)    -> in_progress_sla
Частично выданы   -> partially_delivered
Выполнено         -> completed

Сбор              -> collection
На проверке       -> review
Требуются правки  -> needs_revision
Принято           -> accepted
```

After import, verify:

```sql
select count(*) from public.clinics;
select count(*) from public.users;
select count(*) from public.clinic_modules;
select count(*) from public.uploaded_files;
```

