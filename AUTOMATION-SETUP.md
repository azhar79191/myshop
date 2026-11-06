# Website automation setup

Service credentials can now be entered in **Admin → Settings → Integrations & Automation** after the one-time hosting encryption/allowlist setup in [INTEGRATION-SETUP.md](INTEGRATION-SETUP.md). The hosting variables below remain supported fallbacks. Public WhatsApp settings and delivery status have moved to that tab as well.

Implemented locally; deployment and external credentials are required to activate delivery. Store credentials through the encrypted admin setup or backend hosting secret manager, never frontend `VITE_` variables or Git.

## New enquiries, low stock and staff follow-up

Set `LEAD_NOTIFICATION_WEBHOOK` to an HTTPS endpoint belonging to your chosen notification service (for example your own n8n/Make workflow). Set `LEAD_NOTIFICATION_SECRET` to a long random shared secret and have the receiver verify its Bearer Authorization header.

The existing new-enquiry queue sends `event: new_lead`, `kind: contact|service|quote`, and the database `reference`. The new automation worker sends `event: low_stock`, `kind: stock`, or `event: followup_due`, `kind: followup-contact|followup-service|followup-quote`. These alerts contain references, not customer contact information. The receiver can link staff to the matching admin queue; do not make customer APIs public to enrich alerts.

The worker scans every 15 minutes while the backend is running, queues one reminder per matching record per Pakistan calendar day, and attempts delivery every 30 seconds. Low stock follows the existing product/pack `Low Stock` flag; there are no numerical stock quantities to calculate. Completed/closed follow-ups are excluded when scanning. Records are deduplicated persistently, and each delivery has three attempts. `X-Notification-Id` is a stable idempotency key: receivers should deduplicate retries, including ambiguous network failures. Hosting sleep pauses workers until the process resumes.

## WhatsApp automatic acknowledgements

You may instead enable greeting/away messages in the WhatsApp Business mobile app for a simpler setup. For website-controlled replies, use the WhatsApp Business Platform/Cloud API and configure:

```
WHATSAPP_ACCESS_TOKEN=<server-side API token>
WHATSAPP_PHONE_NUMBER_ID=<Meta phone number ID, not the visible telephone number>
WHATSAPP_APP_SECRET=<Meta app secret>
WHATSAPP_VERIFY_TOKEN=<your random webhook verification token>
WHATSAPP_GRAPH_VERSION=<supported version for your Meta app, such as vNN.0>
```

Subscribe the Meta app to `messages` at `https://YOUR-BACKEND/api/whatsapp/webhook`, using the same verify token. GET validates the subscription; POST verifies the HMAC signature over the raw request bytes before accepting messages. Only recent text messages addressed to the configured phone ID trigger a reply. Status updates and other phone IDs are ignored. Duplicate message IDs share one persisted job. Customer text is not stored. Reply recipient records expire after seven days. Configure your data/privacy policy accordingly.

Edit the acknowledgement in **Admin → Settings → Integrations & Automation → WhatsApp automatic reply**. Replies are queued until the worker's next 30-second tick, with up to three attempts. Replies older than 23 hours are not sent, leaving a margin within the customer service window. This is a simple acknowledgement per incoming text, not a chatbot, stock confirmation or an order acceptance. Outbound API requests can have ambiguous outcomes; a network failure followed by retry can produce a duplicate acknowledgement. Do not also enable a competing app/provider auto-responder without deciding which should reply.

Changing **WhatsApp number (international digits)** changes public website links only. A different Cloud API sending number requires changing its Meta connection and server phone number ID as well. Enter country code and number, for example `923001234567`.

## Review and activation

**Admin → Settings → Integrations & Automation → Website automations** shows whether the credentials are configured and delivery counts. A configured flag reports credential presence, not verified provider connectivity. New enquiry delivery details retain their existing admin panel. Configure a test provider first and verify one real delivery after deployment. No external messages were sent during development; tests intercepted website APIs or stubbed provider calls.

References: [WhatsApp Business app features](https://whatsappbusiness.com/products/business-app-features/), [Meta webhook verification](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/).
