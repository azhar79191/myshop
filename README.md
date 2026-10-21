# Bismillah Spray Center API

Express and MongoDB API used by the Bismillah Spray Center public website and protected admin CMS.

## Requirements

- Node.js 18 or newer
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
