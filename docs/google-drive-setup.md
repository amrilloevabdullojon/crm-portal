# Google Drive setup

The portal stores file binaries in Google Drive and stores metadata in Postgres.

## Folder structure

Set `GOOGLE_DRIVE_ROOT_FOLDER_ID` to the Drive folder that should contain all clinic folders.

The service creates this structure on first upload:

```text
Root folder
  Clinic Name
    01_Source Uploads
      Module Name
    02_Actual
    03_Internal
```

Client uploads go into `01_Source Uploads/Module Name`.

## Service account

Create a Google Cloud service account with Drive API access, then share the root Drive folder with the service account email.

Required env vars:

```text
GOOGLE_DRIVE_ROOT_FOLDER_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Keep the private key as one env var string with escaped `\n` line breaks. The app normalizes it before creating the Google API client.

