# Bismillah Spray Center API

Express and MongoDB API used by the Bismillah Spray Center public website and protected admin CMS.

## Requirements

- Node.js 22 or newer (the installed MongoDB driver requires at least 20.19)
- npm
- MongoDB local or Atlas connection

## Local setup

```powershell
npm install
```

Create `.env` in this repository root:

```env
MONGODB_URI=mongodb://localhost:27017/bismillah_spray_center
JWT_SECRET=replace-with-a-long-random-secret
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

`MONGODB_URI` and `JWT_SECRET` are required. `PORT` defaults to `5000` and must be between 1 and 65535. `FRONTEND_URL` is optional and may contain comma-separated allowed origins. Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` to enable image uploads.

Start the API:

```powershell
npm run dev
```

## Checks and health

### Initial administrator

Set `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_FULL_NAME` in the environment, then run `npm run seed:admin`. The password must have at least 12 characters. This creates a superadmin and refuses to overwrite an existing account. Remove the bootstrap password from the environment afterward. Products, brands, gallery entries, contacts, and FAQs are managed through the CMS; obsolete seed commands have been removed.

### Sessions and request limits

Passwords invalidate previously issued sessions. The password-change response includes a replacement token for the current browser. New tokens default to one hour unless `JWT_EXPIRE` overrides it. Login accepts 10 attempts per IP per 15 minutes; public contact, service-request, and testimonial submissions share a 20-request allowance. Limits are bounded in memory per API process and reset on restart. Multiple API instances need a shared rate-limit store.

Set `TRUST_PROXY_HOPS` to the exact number of trusted reverse proxies (default `0`, Render configuration `1`). Do not enable arbitrary forwarded-header trust. Cloudinary image retirement runs after database updates and retries deletion three times; exhausted retries are logged for operational follow-up.

### Automated checks

Authenticated admins can read the last 20 settings/logo saves at `GET /api/site-settings/history`. Each entry records the server time and authenticated admin's identity. Public settings responses do not include this history. Existing installations start recording history with their next save; earlier edits are not reconstructed.

```powershell
npm test
```

The test suite covers pagination, startup configuration, response-cache policy, and the readiness endpoint. `GET /api/health` returns HTTP 200 only when MongoDB is connected and 503 otherwise; health and authenticated/dynamic responses are marked `no-store`.

Caching is configured centrally in `src/middleware/cachePolicyMiddleware.js`. Only explicitly classified public GET endpoints receive public cache headers; route-local response caching is not used. Authenticated responses, site settings, health checks, mutations, and unclassified routes are not cached.

## Deployment

Render uses `render.yaml`; set `MONGODB_URI`, `JWT_SECRET`, and the Cloudinary credentials in the service environment. Set `FRONTEND_URL` to the production website origin if it differs from the built-in allowlist. Render probes `/api/health` for readiness.

## Server-hosted Media

The public page is `/media`, with `/gallery` kept as a redirect. Admins manage photos and videos at `/admin/media`; `/api/gallery` remains an API alias for older clients. Existing image records work without a migration.

In **Admin > Media**, choose Photo or Video, select a local file, and set its title, description, category, display order, and website visibility. Videos can have an optional uploaded cover image. Uploads use multipart form data, not base64 video payloads. Public cards have a play button and open a native video player with playback, seeking, volume, and fullscreen controls. MP4 (H.264/AAC recommended), WebM, and Ogg are accepted; browser codec support still applies. The server does not transcode files.

In **Admin > Site Settings > Media uploads**, enable/disable new video uploads and set the video size limit. Existing videos keep playing when new uploads are disabled. Images and covers have a 5MB limit. Videos default to 100MB, capped by the server configuration.

Optional server environment variables:

```env
MEDIA_UPLOAD_DIR=/var/lib/myshop/media
MEDIA_MAX_VIDEO_MB=100
MEDIA_PUBLIC_BASE_URL=https://your-api.example.com
```

`MEDIA_UPLOAD_DIR` defaults to this backend's `uploads/media` folder. Use an absolute path on a durable disk in production. `MEDIA_PUBLIC_BASE_URL` is the public origin of this API (not the frontend) and is used to construct media URLs; it falls back to `RENDER_EXTERNAL_URL`, then the incoming request origin. Set it explicitly behind a reverse proxy. The hard upload cap `MEDIA_MAX_VIDEO_MB` accepts 1–2048MB. Ensure a reverse proxy accepts at least that upload size and permits long enough upload requests. Uploaded media is served from `/uploads/media/<generated-name>` with HTTP byte-range support for seeking. Uploaded files receive randomized names; content signatures and MIME types are checked. Replacing/deleting media retires its local files, and unsuccessful uploads are cleaned up.

For local development, start this API and set the frontend's `VITE_API_BASE_URL=http://localhost:5000/api`, then restart Vite. Upload endpoints require an authenticated admin. Endpoints:

- `GET /api/media`: active public photos/videos.
- `GET /api/media/admin` and `/api/media/admin/:id`: authenticated management data including inactive items.
- `GET /api/media/upload-policy`: authenticated effective upload limits.
- `POST /api/media`, `PUT /api/media/:id`: authenticated multipart uploads (`file`, optional `poster`, plus metadata fields). Metadata-only edits also accept JSON.
- `DELETE /api/media/:id`: authenticated deletion and file cleanup.

Visibility hides items from the public Media page; files are public assets if their URL is known. Do not upload private files. Back up MongoDB metadata and the media directory together. A single local disk deployment needs one API instance or shared persistent storage.

### Render persistence

The current `render.yaml` uses the free plan. Render's free filesystem is ephemeral and cannot have a persistent disk. Before using server uploads in production, attach persistent storage on a supported service and set `MEDIA_UPLOAD_DIR` to its mounted directory (for example `/var/data/media` with a `/var/data` disk mount). No paid plan or production deployment is enabled by this change. See [Render persistent disks](https://render.com/docs/disks) and [free service limitations](https://render.com/docs/free).


## Customer workflow improvements

Products support `crops`, `activeIngredient`, `formulation`, `targetProblems`, an HTTPS `labelUrl`, optional `translations.ur` (`name`, `description`, `usage`), and stock status per pack. `GET /api/products?crop=Wheat` matches an exact crop tag, ignoring case. Products with explicit pack statuses derive their overall availability from those packs. Pack names must be unique. Existing packs without a status retain the product-level fallback.

Reviews now store a validated product reference. Public approved-review lists accept `productId`; product lists and details calculate ratings only from approved linked reviews. Older reviews are not guessed by partial name: run `npm run migrate:reviews` for an exact-name dry run, then `npm run migrate:reviews -- --apply` only after reviewing the summary and backing up the database. Ambiguous matches remain unlinked.

`POST /api/contact` accepts either phone or email, and an optional `preferredContact` of `phone`, `whatsapp`, or `email`. The chosen channel must have contact details. Public contact/service confirmations return only `data.reference`. Quote requests are saved as contacts with subject `Product quote request`.

Service bookings also accept village, crop, acreage, preferred date, and up to three base64 JPEG/PNG/WebP field photos (2MB each). Field photos require Cloudinary. File signatures and request metadata are validated before upload; failed uploads/database saves clean up new assets. Field photos use public asset URLs and should contain only field imagery.

Authenticated contacts and service-request updates accept `status`, `assignedTo`, `followUpAt`, and `internalNotes`. Lists support server pagination, status, and `overdue=true`. Terminal statuses are excluded from overdue queues. `GET /api/auth/staff` exposes active staff names/IDs to authenticated staff for assignment. Account creation, listing, and activation controls remain superadmin-only.

`GET /api/dashboard` is authenticated and aggregates full database totals, pending reviews, low stock, overdue follow-ups, and six monthly buckets in Asia/Karachi. The frontend polls for new-inquiry counts while visible.

### Durable production media (supersedes the local-only production guidance above)

Production defaults to `MEDIA_STORAGE=cloudinary`; `render.yaml` sets it explicitly. Configure the existing `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` values on the backend. Images, videos, and covers are staged locally only while validated/uploaded, then stored using Cloudinary URLs and asset IDs. Missing credentials block new uploads with a useful error. Metadata edits remain available. Cloud uploads use a 100MB video cap, or a lower `MEDIA_MAX_VIDEO_MB` value.

Development defaults to `MEDIA_STORAGE=local`. Production local storage is available only with `MEDIA_STORAGE=local`, `MEDIA_DURABLE_DISK=true`, and `MEDIA_UPLOAD_DIR` pointing to a genuinely persistent mounted disk. The flag is an operator declaration; it cannot make an ephemeral disk durable.

Before replacing an installation with local media, back up its database and files and run `npm run migrate:media` on the machine that still has the files, with MongoDB and Cloudinary configured. This migrates referenced local files, saves URLs only after uploads succeed, cleans failed cloud uploads, and retains original files. Do not remove the old files before verifying the migrated site. Files already lost by an ephemeral host cannot be reconstructed.

### Recovery email and notifications

All newly set admin passwords require at least 12 characters. Existing passwords continue to authenticate. Recovery uses a 30-minute, one-time token stored as a hash, and invalidates existing sessions after reset. Configure these backend-only values:

```env
RESEND_API_KEY=your-provider-key
RECOVERY_FROM_EMAIL=Bismillah Admin <admin@your-verified-domain.example>
RECOVERY_SITE_URL=https://your-frontend.example
```

Use a verified sender accepted by your Resend account. The frontend routes are `/admin/forgot-password` and `/admin/reset-password`; reset tokens travel in the URL fragment rather than server request logs. Recovery is unavailable until email is configured. See the [Resend API reference](https://resend.com/docs/api-reference/emails/send-email).

Optional new-lead notifications use `LEAD_NOTIFICATION_WEBHOOK` (HTTPS) and optional `LEAD_NOTIFICATION_SECRET`. Only the lead kind and reference are sent; customer details remain in the CMS. Webhook failure does not reject a saved inquiry and is logged for follow-up. In-app inquiry counts work without a webhook.

### Backups

`npm run backup` writes a timestamped logical database export, collection indexes, and a copy of local media into ignored `backups/`. Pass an explicit directory with `npm run backup -- <directory>`. `COMPLETE.json` exists only after the export succeeds. Pause application writes during the export if you need cross-collection consistency. Files contain customer information and password hashes; keep them in restricted encrypted storage. This JSONL/EJSON logical export is not a `mongodump` archive; use the version 2 verification and isolated restore-check commands described below to validate documents and indexes in an empty recovery database. For a managed production database, also enable its native backup/restore facilities and test restoration.

Cloud media is represented by URL and asset ID in the database backup; maintain an independent asset backup/export with the cloud provider. Development checks do not initiate production backups, migrations, recovery emails or deployments. Configured notification retries run when the deployed API worker is active.

## Structured product quotes

Customers submit `POST /api/quotes` with a UUID v4 `requestId`, name, phone, 1–30 product/pack/quantity items, and an optional collection/delivery preference and location. The server snapshots catalog names and pack sizes, checks stock, and returns only a reference and status. Identical retries reuse the reference; changed payloads cannot reuse the UUID. Shared public submission limits apply.

Authenticated staff use `GET /api/quotes` (status, overdue, reference and pagination filters) and `PUT /api/quotes/:id` (record `version`, unit prices, charge, status, assignment, notes and follow-up). New → Quoted → Confirmed → Closed tracks progress. Complete prices and an explicit charge are required for Quoted/Confirmed. Totals use integer cents during calculation; stale versions return 409. The unique request ID index is initialized before the server accepts traffic. Existing quote messages remain in Contacts.

`GET /api/products/admin/list?attention=low-stock` and `attention=missing-details` require authentication. Empty public catalog searches include bounded `suggestions` that respect the same filters. The dashboard exposes separate overdue counts and new quote/missing-detail counters.

Delivery and collection text is configured through `deliveryAreas`, `deliveryDetails`, and `collectionDetails` in site settings (500 characters each). No payment settings are added. Deploy this API before the matching frontend release.

## Dynamic public content

Site settings now include `aboutContent`, `pageImages`, `pageContent`, `seoPages`, `homepageSections` and `policies`. Missing nested fields fall back to defaults; partial saves preserve previously saved values. Privacy and terms revision dates are stamped on the server only when their sections change. User-supplied revision dates are ignored.

Authenticated `GET /api/site-settings/configuration` returns booleans for configured services without credentials. Authenticated `POST /api/site-settings/images` uses the existing image storage and 5MB image limits, returning a URL for a draft selection. Save settings separately to publish the selection. Deploy this API before the frontend content-management release. Payment methods remain excluded.

## Reliability and recovery

Settings GET responses include `_revision`; PUT must send that revision. Published logo uploads require `If-Match` with the revision. Atomic saves advance the revision; stale or concurrent changes return 409. The settings and notification indexes are initialized before accepting traffic.

`notificationdeliveries` persists configured lead alerts. A leased worker resumes pending work and retries up to three times. Authenticated `GET /api/notifications` lists delivery status; `POST /api/notifications/:id/retry` requeues failed/disabled rows. Alert payloads contain references only. Receivers should deduplicate `X-Notification-Id` because delivery is at least once.

`npm run backup` now produces a version 2 checksum manifest and refuses existing destinations. `npm run backup:verify -- <directory>` verifies the snapshot without a database connection. `npm run backup:restore-check -- <directory>` requires an explicit `RESTORE_MONGODB_URI` and empty `RESTORE_DATABASE_NAME` beginning `restore_check_`; it compares restored BSON records and index definitions and retains the recovery copy. These commands do not schedule backups. Real production restore/scheduling checks have not been run by development tests.

## Source formatting and image policy

Run `npm run format` to format the source and tests, and `npm run format:check` in review. Backend formatting keeps semicolons and uses a 100-column target.

New product and general branding images retain up to 2400 pixels on each axis, without upscaling or cropping. Client delivery generates smaller modern-format renditions. Previously small uploaded originals must be replaced to obtain more detail. Profile photos use their separate face-cropped policy.

The frontend repository contains `docs/website-audit.md` and `docs/architecture.md`, covering both services and remaining dependency upgrades.
