# Google Sheets training-data receiver

This Google Apps Script Web App splits solo training sessions between a public visitor-statistics sheet and a separate private owner sheet. A request without a token is public; a request with the configured `PERSONAL_API_TOKEN` is private; any other token is rejected. The typing app remains local-first: every session stays in browser `localStorage`, and failed uploads stay in a separate queue for automatic or manual retry.

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
| `country_code` | Best-effort two-letter visitor country code |
| `ip_hash` | Salted SHA-256 hash used only to estimate unique visitors |

Raw keystroke timelines and complete IP addresses are intentionally not stored. The browser obtains country/IP from `api.country.is`; Apps Script immediately converts the IP to a salted one-way hash before writing the row. Country lookup failure never blocks a training record.

## Manual setup and deployment

1. Create separate public and personal Google Sheets, each with a `typing_sessions` tab.
2. Open [Google Apps Script](https://script.google.com), create a standalone project, and paste `Code.gs` into it.
3. In **Project Settings → Script Properties**, add:
   - `SPREADSHEET_ID`: public statistics spreadsheet id
   - `SHEET_NAME`: optional public tab name; defaults to `typing_sessions`
   - `PERSONAL_SPREADSHEET_ID`: private owner spreadsheet id
   - `PERSONAL_SHEET_NAME`: optional private tab name; defaults to `typing_sessions`
   - `PERSONAL_API_TOKEN`: a random secret of at least 24 characters
   - `IP_HASH_SALT`: a separate random secret used only for IP hashing
4. In the editor, run `setupSheet` once and approve access. Confirm that the header row appears in the intended spreadsheet.
5. Choose **Deploy → New deployment → Web app**. Execute as yourself and select the access level that permits the deployed frontend to send requests. Copy the `/exec` URL, not the `/dev` test URL.
6. In the frontend deployment environment, set `VITE_GOOGLE_SHEETS_WEB_APP_URL` to that `/exec` URL, then rebuild/redeploy the frontend.
7. Without a token, finish one short solo session and verify it appears only in the public sheet with no sync message in the result screen.
8. In the app's advanced settings, save `PERSONAL_API_TOKEN`, finish another session, and confirm it appears only in the personal sheet with a private sync message.

No password, API key, spreadsheet id, personal token, hashing salt, or personal identifier belongs in this repository. A Vite environment variable is visible to browser users, so it must not be treated as a secret. The receiver therefore keeps secrets in Script Properties, validates and bounds every field, and uses a session id to make retries idempotent. For public deployments, periodically review unexpected rows and disclose the anonymous country/IP-hash collection in the interface.
