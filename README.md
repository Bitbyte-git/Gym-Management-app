# PulseFit Gym Management

React/Vite frontend, Express API and MongoDB. The existing landing page and brand assets are preserved. Members register themselves without fingerprint enrollment. MFS500 capture/enrollment, local Windows template-search attendance and development matching diagnostics are available; trusted production biometric attendance remains disabled. See [BIOMETRICS.md](BIOMETRICS.md).

## Local setup

Use Node.js 22.12 or newer and a transaction-capable MongoDB replica set (MongoDB Atlas or a local replica set). A standalone MongoDB server cannot run the multi-record registration/payment/allocation transactions.

```powershell
npm.cmd install
# Copy examples only when your environment files do not already exist:
Copy-Item client/.env.example client/.env.local
Copy-Item server/.env.example server/.env
# Configure MONGODB_URI and JWT secrets before seeding.
npm.cmd run seed
npm.cmd run dev
```

Do not overwrite existing environment files. The frontend API URL is configured with `VITE_API_URL`. Server secrets belong only in `server/.env` or the deployment secret manager. DNS uses the operating system resolver unless `DNS_SERVERS` is explicitly configured.

CORS is configured to allow requests from all origins (including local dev servers on any port, preview domains, and production URLs), with support for credentials, custom authorization headers, and standard preflight handling.

## Demo credentials

Run `npm.cmd run seed` against a dedicated development database first.

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@pulsefit.com | admin123 |
| Reception / staff | reception@pulsefit.com | reception123 |
| Trainer | trainer@pulsefit.com | trainer123 |
| Member | member@pulsefit.com | member123 |

The seed refuses `NODE_ENV=production` and preserves existing account passwords. It includes a real demo member profile, paid membership, receipt and Monday slot. Re-running the seed also updates sample plans, trainer details and operating hours, so use a development database only. The development login screen has credential-fill buttons; they are excluded from production builds.

## Member flow

Basic details and password -> health and fitness details plus consent -> database-backed plan -> available weekday slot -> optional eligible trainer -> review -> save registration -> Razorpay Checkout -> server-verified payment -> membership activation and dashboard sign-in.

Registration is stored in MongoDB. The browser stores a registration bearer token, not the member database. Members can resume on another browser using their email/password. Closing Checkout does not erase a registration. Pending payment does not activate access or reserve a slot. Capacity is checked again during activation.

If payment succeeds but activation is interrupted, retrying checkout rechecks the Razorpay order before allowing another payment. Do not charge the customer again; correct unavailable slot or trainer selections or handle a verified refund.

## Razorpay setup

Set these server variables:

```dotenv
PAYMENT_GATEWAY_ENABLED=true
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_server_side_key_secret
FRONTEND_URL=http://localhost:5173
```

In production use your actual HTTPS frontend origin as `FRONTEND_URL`. The server creates the INR order, the browser opens Razorpay Standard Checkout, and the server verifies the HMAC signature plus the order and captured payment directly with Razorpay before activating membership. Full online refunds are sent to Razorpay and retained in the local audit trail. Staff may alternatively record physically received cash using an idempotency key.

## Commands and validation

```powershell
npm.cmd run dev           # API and Vite
npm.cmd run build         # client/dist
npm.cmd test              # unit and isolated MongoDB transaction/API tests
npm.cmd run test:e2e      # headless Edge browser workflow checks
npm.cmd run db:indexes    # create/verify declared indexes, without dropping data
npm.cmd run admin:create  # bootstrap initial production admin using environment variables
```

Tests use temporary MongoDB replica sets, not `server/.env` data. The first run downloads MongoDB 8.0.12. Browser checks require installed Microsoft Edge and write ignored artifacts under `test-results/`.

Validated during this change: production frontend build and 24 unit/database tests covering all four roles, registration without biometrics, Razorpay order amount control, signature verification, captured-payment settlement, refunds, allocation consistency, and access control.

## Production setup

1. Configure HTTPS, authenticated MongoDB, backups and restore testing, unique access/refresh JWT secrets, allowed frontend origins and `NODE_ENV=production`.
2. Review existing duplicate open attendance sessions and allocations before running `npm.cmd run db:indexes`. Production startup does not silently manage indexes. The new attendance index allows one open session per member across all dates; old conflicting records need explicit correction before the index can be created.
3. For a fresh production database set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12-72 characters), run `npm.cmd run admin:create`, and remove the bootstrap password from the environment. This command refuses to create another initial administrator if an admin already exists. Do not seed demo accounts in production.
4. Configure Razorpay test keys and complete real test-mode checkout, failed payment, interrupted activation, retry, and refund tests. Then configure live keys and perform operational acceptance testing.
5. Run the complete test suite and production build again. Validate the latest refund, freeze/unfreeze and trainer schedule changes before launch.
6. Host `client/dist` with SPA fallback and deploy the API separately or behind a reverse proxy. Configure the actual frontend URL/API URL. Configure trusted proxy behavior only when your deployment uses one trusted proxy.
7. Monitor API errors, webhook failures, reconciliation records and database backups. Membership expiry/slot cleanup runs at startup and every minute while the API is running; expiry reminders are in-app and deduplicated per membership/day.

Production readiness still depends on deployment-specific Razorpay acceptance testing, monitoring, backups, and operational infrastructure. This repository is not a production certification.

## Boundaries and policies

- Biometrics are optional for registration/activation. Local Windows development supports SDK template-search attendance; remote production matching remains disabled pending its trusted integration.
- Manual attendance is limited to admin/reception, enforces membership/payment/slot/hours, and is audited.
- One active slot and one primary trainer per member. Slots recur on their configured weekday. Trainer capacity is a conservative total active-client limit drawn from matching availability, not arbitrary simultaneous-session booking.
- Trainer leave is open-ended until administrator reactivation. Scheduled date-range leave is not implemented.
- Downgrades are selected at renewal. Immediate downgrade credits and tax invoice rules are not implemented.
- The plan's configured price is authoritative. Free-form discount/eligibility notes are not an executable promotion engine.
- CSV exports export visible/loaded records. Member, trainer, staff and audit lists expose pagination; several reporting/list endpoints still require pagination work for large deployments.
- Notifications are in-app. SMS/email integrations remain unavailable. Password recovery through email is not implemented.
- Optional expenses, workouts, nutrition, progress and other unfinished modules are excluded from authenticated navigation.

See `IMPLEMENTATION_AUDIT.md` for the module/file map and remaining acceptance items.

Reception scanner lifecycle, transactional attendance sessions, rollout and remaining trusted-identification dependencies: [BIOMETRIC_ATTENDANCE.md](BIOMETRIC_ATTENDANCE.md). Local Windows development now supports fingerprint-only template search with MORFIN Auth; remote production matching needs its trusted integration. Authorized manual attendance is preserved.


Final Commit
