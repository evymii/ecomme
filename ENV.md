# Environment variables — inventory and Vercel checklist

This document lists **every environment variable read by the codebase** for `fd` (Next.js frontend) and `bd` (Express backend). It was generated from static analysis of the repository.

**Important:** This repo cannot read your Vercel project settings. **You must confirm each value yourself** in the Vercel dashboard: **Project → Settings → Environment Variables → Production** (and Preview/Development if you use them).

After adding or changing variables, **redeploy** both projects so builds pick up new values (especially `NEXT_PUBLIC_*` on the frontend).

---

## Quick verification (manual)

| Step | Action |
|------|--------|
| 1 | Open [Vercel Dashboard](https://vercel.com/dashboard) → select **frontend** project (`fd`). |
| 2 | **Settings → Environment Variables** → filter **Production** → compare with [Frontend (fd)](#frontend-fd) below. |
| 3 | Repeat for **backend** project (`bd`) → compare with [Backend (bd)](#backend-bd). |
| 4 | For any missing key, **Add** with the correct value, scope **Production** (and Preview if needed). |
| 5 | **Deployments → Redeploy** (both projects). |

---

## Frontend (`fd`)

Variables are read from `process.env` at build/runtime.

| Variable | Required in prod? | Where used / notes |
|----------|-------------------|----------------------|
| `NEXT_PUBLIC_API_URL` | **Yes** | `lib/api.ts`, `lib/image-utils.ts`, `app/page.tsx`. **Throws in production if missing.** Must be the **base API URL**; code appends `/api` if absent (e.g. `https://your-backend.vercel.app` or `https://your-backend.vercel.app/api`). |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | **Yes** (for admin product uploads) | `lib/cloudinary.ts` — unsigned browser uploads. |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | **Yes** (same) | `lib/cloudinary.ts` — must match an **unsigned** preset in Cloudinary. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Recommended | `components/providers/ClerkWrapper.tsx` — if unset, ClerkProvider is skipped; signup email OTP flow may not work. |
| `CLERK_SECRET_KEY` | Optional (current code) | **Not imported** anywhere in `fd` today. Clerk Next.js apps often add it for server-side Clerk APIs or future middleware. Safe to set for consistency with Clerk dashboard. **Do not** prefix with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_BANK_NAME` | Optional | `app/checkout/page.tsx` — defaults to `ХААН банк`. |
| `NEXT_PUBLIC_BANK_ACCOUNT` | Optional | `app/checkout/page.tsx` — bank account display. |
| `NEXT_PUBLIC_BANK_HOLDER` | Optional | `app/checkout/page.tsx` — account holder display. |

`NODE_ENV` is set by the platform (not set manually in Vercel for Next).

### Example — frontend Production block

```env
NEXT_PUBLIC_API_URL=https://YOUR-BACKEND-HOST.vercel.app
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
# Optional but recommended for Clerk ecosystem:
CLERK_SECRET_KEY=sk_live_...
# Optional checkout copy:
NEXT_PUBLIC_BANK_NAME=ХААН банк
NEXT_PUBLIC_BANK_ACCOUNT=
NEXT_PUBLIC_BANK_HOLDER=
```

---

## Backend (`bd`)

| Variable | Required in prod? | Where used / notes |
|----------|-------------------|----------------------|
| `MONGODB_URI` | **Yes** | `src/config/database.ts` — full MongoDB Atlas (or other) connection string. |
| `JWT_SECRET` | **Yes** | `src/middleware/auth.ts`, `src/controllers/auth.controller.ts` — signing/verifying JWTs. Use a **long random string** (≥ 32 characters recommended). |
| `FRONTEND_URL` | **Yes** (CORS) | `api/index.ts`, `src/server.ts` — your **live frontend origin** (no trailing slash issues handled by CORS helper), e.g. `https://www.az-souvenir.com`. |
| `CLERK_SECRET_KEY` | Optional (current code) | **Not read** in `api/index.ts` or `src/server.ts` today. `@clerk/express` is in `package.json` but **no Clerk middleware** is wired in the main API entry. Set this key if you add Clerk server middleware later. |
| `CLOUDINARY_CLOUD_NAME` | **Yes** if server uses Cloudinary | `src/config/cloudinary.ts` — required for **server-side** Cloudinary SDK (e.g. `src/utils/fileUtils.ts` delete on product image removal). |
| `CLOUDINARY_API_KEY` | **Yes** (same) | Same as above. |
| `CLOUDINARY_API_SECRET` | **Yes** (same) | Same as above. |
| `PORT` | Optional | `src/server.ts` — defaults to `5001` (local); Vercel uses its own port for serverless. |
| `VERCEL` / `VERCEL_ENV` | Auto | Set by Vercel; used in logs / CORS paths. |
| `ADMIN_EMAIL` | Optional | `src/seed.ts` only — seed script. |
| `ADMIN_PASSWORD` | Optional | `src/seed.ts` only. |

### Example — backend Production block

```env
MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/dbname?retryWrites=true&w=majority
JWT_SECRET=REPLACE_WITH_RANDOM_32_PLUS_CHARS
FRONTEND_URL=https://www.your-frontend-domain.com
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
# Optional until Clerk server auth is implemented:
CLERK_SECRET_KEY=sk_live_...
```

---

## Cross-service consistency

| Concern | Rule |
|--------|------|
| API URL | Frontend `NEXT_PUBLIC_API_URL` must point at the **deployed backend** host; path may be with or without `/api` (see `lib/api.ts` normalization). |
| CORS | Backend `FRONTEND_URL` must match the **exact** origin users use (including `https` and `www` if applicable). Extra origins for `az-souvenir.com` are hardcoded in `api/index.ts`. |
| Cloudinary | **Cloud name** should match between `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (fd) and `CLOUDINARY_CLOUD_NAME` (bd). Upload preset is **frontend-only** for unsigned uploads; backend uses API key/secret for admin operations. |

---

## Clerk webhook secret

**`CLERK_WEBHOOK_SECRET`** (or similar) is **not referenced** in this repository. If you add Clerk webhooks, document the new variable here and set it in Vercel/backend as needed.

---

## What cannot be verified from the repo

- Whether each variable is **present** in Vercel Production.
- Whether values are **correct** (wrong Mongo URI, rotated JWT, etc.).

Use Vercel **Runtime Logs** and smoke tests (`/api/health`, login, image upload) after redeploy.

---

## References in repo

- `DEPLOYMENT_CHECKLIST.md` — high-level deploy steps.
- `fd/FRONTEND_SETUP.md` — example `NEXT_PUBLIC_API_URL` and backend URL.

Last inventory sync: codebase scan (`process.env` / `NEXT_PUBLIC_*` in `fd` and `bd`).
