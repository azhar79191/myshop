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
