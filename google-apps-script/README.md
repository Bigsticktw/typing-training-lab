# Google Sheets training-data receiver

This optional Google Apps Script Web App appends solo training sessions to a dedicated sheet. The typing app remains local-first: every session stays in browser `localStorage`, and failed uploads stay in a separate queue for automatic or manual retry.

## Data schema (v1)

| Sheet column | Description |
| --- | --- |
| `schema_version` | Payload schema, currently `1` |
| `received_at` | Server-side Apps Script receive time |
| `session_id` | Browser-generated idempotency key; duplicates are ignored |
| `started_at`, `completed_at` | ISO 8601 timestamps sent by the client |
| `client_timezone_offset_minutes` | Browser offset returned by `Date#getTimezoneOffset` |
| `mode` | `English` or `Zhuyin` |
| `score`, `errors`, `total_keystrokes` | Session input counts |
| `accuracy_percent`, `ppm` | Existing performance metrics |
| `avg_latency_ms`, `duration_seconds` | Existing timing metrics |
| `key_errors_json` | Per-key error counts as JSON |
| `key_latency_average_ms_json` | Per-key average latency as JSON |

Raw keystroke timelines are intentionally not uploaded. This keeps the payload small and avoids collecting more detailed behavior than the dashboard needs.

## Manual setup and deployment

1. Create a Google Sheet dedicated to typing sessions and copy its spreadsheet id from the URL.
2. Open [Google Apps Script](https://script.google.com), create a standalone project, and paste `Code.gs` into it.
3. In **Project Settings → Script Properties**, add `SPREADSHEET_ID`. Optionally add `SHEET_NAME`; it defaults to `typing_sessions`.
4. In the editor, run `setupSheet` once and approve access. Confirm that the header row appears in the intended spreadsheet.
5. Choose **Deploy → New deployment → Web app**. Execute as yourself and select the access level that permits the deployed frontend to send requests. Copy the `/exec` URL, not the `/dev` test URL.
6. In the frontend deployment environment, set `VITE_GOOGLE_SHEETS_WEB_APP_URL` to that `/exec` URL, then rebuild/redeploy the frontend.
7. Finish one short solo session. Confirm the UI says it synced and verify exactly one new row with the matching `session_id`.

No password, API key, spreadsheet id, or personal identifier belongs in this repository. A Vite environment variable is visible to browser users, so it must not be treated as a secret. The receiver therefore validates and bounds every field and uses a session id to make retries idempotent. For public deployments, use a dedicated spreadsheet and periodically review unexpected rows.
