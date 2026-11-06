# Integrations & Automation

Open **Admin → Settings → Integrations & Automation**. Public WhatsApp number/message fields, service credentials, automation status and credential change history are gathered here. Public settings and private credentials have separate save buttons so a content save cannot overwrite a secret.

Supported private configuration: notification webhook/shared secret, WhatsApp Business Platform token/phone ID/app secret/verification token/API version, Cloudinary cloud/API credentials, and Resend recovery email key/sender/frontend origin. Additional configuration types must be added to the server allowlist with validation; administrators cannot invent arbitrary environment variables.

## One-time hosting setup

1. Set `CONFIG_ENCRYPTION_KEY` in backend hosting to **32 cryptographically random bytes encoded as base64**. Generate it locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` and copy it directly to the hosting secret manager. Never commit it or put it in `VITE_` variables. Retain a protected backup: changing or losing it makes existing encrypted credentials unreadable. Keep this key separate from database backups.
2. Set `CONFIG_ALLOWED_WEBHOOK_HOSTS` to exact approved hostnames, separated by commas, such as `hooks.example.com`. No protocols, paths, wildcards or ports. The hostname of an existing hosting `LEAD_NOTIFICATION_WEBHOOK` is also trusted for backward compatibility. Only HTTPS port 443 is allowed. DNS must resolve entirely to public addresses. Every delivery resolves, validates and pins its destination; redirects are never followed.
3. Set `FRONTEND_URL` to the approved production frontend origin(s). The recovery origin entered in admin must exactly match one of these HTTPS origins. The built-in frontend is used when FRONTEND_URL is absent.
4. Keep `MONGODB_URI`, `JWT_SECRET`, `CONFIG_ENCRYPTION_KEY`, outbound host allowlists, proxy settings, storage disk policy and other server/bootstrap controls in hosting. They cannot be edited through this API. Run backend startup normally; its new integration-settings collection/index is initialized before accepting requests.

Existing environment-only integrations keep working until explicitly overridden. With no stored credentials, an encryption key is not required for those existing hosting values. Once encrypted settings exist, missing/wrong keys fail closed; restore the correct hosting key to recover access.

## Updating credentials

Only an active **superadmin** may read or save private integration metadata. Saving requires the account's current password. Each field offers:

- **Keep current value:** no change; secrets remain blank and are never returned.
- **Set a new value:** replace the saved override.
- **Disable this value:** save an empty override, preventing a hosting fallback.
- **Use hosting value:** remove the saved override and fall back to hosting configuration.

Blank replacement fields are rejected by the UI. Public contact data rejects unknown contact properties; do not put credentials in public text fields. Public WhatsApp messages and the acknowledgement text remain public business content, not secrets.

Secrets are held only in component memory while editing; neither credentials nor password confirmation are saved to localStorage. Save responses, GET responses and audit history omit secret values and ciphertext. The audit records actor ID, time and changed field names. Credentials use AES-256-GCM with random nonces, a 128-bit authentication tag and bound version context. The database stores one authenticated encrypted envelope in a dedicated collection, separate from publicly readable site settings.

## Runtime behavior and protections

- Updates take effect on this backend instance after a successful save. Other running instances refresh on API traffic/worker checks with a 15-second cache, normally within the 30-second worker tick. No provider credentials are copied into process.env.
- Revision checks prevent concurrent administrators from silently overwriting each other. A conflict preserves the draft; discard it and reload saved metadata before resubmitting.
- Every private request requires JWT validation, an active account and the superadmin role. Writes additionally recheck the password/role, accept at most 24 KB JSON, reject unknown fields and return generic errors. Reads/writes carry `Cache-Control: no-store`.
- Reads are limited per IP; password-confirmed writes are limited per account (five attempts per 15 minutes per backend process). For deployments with multiple replicas, shared edge/gateway rate limits are still needed for a global quota. This change does not add MFA or replace protection against compromised admin sessions.
- Webhook destination restrictions follow [OWASP SSRF prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html). Encryption uses [Node's authenticated encryption APIs](https://nodejs.org/download/release/latest-jod/docs/api/crypto.html).

Presence flags mean configured, not that the provider has accepted credentials. Saving never sends an external test message. Provider setup, subscription verification and a controlled delivery check are still needed after deployment; see [AUTOMATION-SETUP.md](AUTOMATION-SETUP.md).

These controls reduce demonstrated risks; they do not establish that the API cannot be attacked. Protect hosting, database access and superadmin credentials, deploy over HTTPS, and test in staging before activation.
