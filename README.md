# PulseFit Gym Management

React/Vite frontend, Express API and MongoDB. The existing landing page and brand assets are preserved. Members register themselves without fingerprint enrollment. Biometrics remain deferred.

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

Basic details and password -> health and fitness details plus consent -> database-backed plan -> available weekday slot -> optional eligible trainer -> review -> save registration -> Stripe Checkout -> verified webhook -> membership activation and dashboard sign-in.

Registration is stored in MongoDB. The browser stores a registration bearer token, not the member database. Members can resume on another browser using their email/password. Closing Checkout does not erase a registration. Pending payment does not activate access or reserve a slot. Capacity is checked again during activation.

If Stripe payment succeeds but a requested slot/trainer becomes unavailable, a durable Stripe reconciliation record is retained. An administrator changes the pending membership selection and retries activation from Stripe reconciliation. Do not charge the customer again. Correct the selection or handle the refund using the provider's operational process if activation is impossible.

## Stripe setup

Set these server variables:

```dotenv
PAYMENT_GATEWAY_ENABLED=true
STRIPE_SECRET_KEY=your_server_side_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_endpoint_signing_secret
FRONTEND_URL=http://localhost:5173
```

In production use your actual HTTPS frontend origin as the first `FRONTEND_URL` entry. Checkout supports one-time INR card payments. Create a Stripe webhook pointing to `https://YOUR-API/api/payments/stripe/webhook` and subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `refund.created`
- `refund.updated`

For local testing use Stripe CLI forwarding to `http://localhost:5000/api/payments/stripe/webhook`, and put the CLI's signing secret in the server environment. The webhook consumes the raw body before Express JSON parsing. The server retrieves Checkout sessions from Stripe and verifies paid status, currency, amount and membership association. The browser return URL never activates membership.

Full Stripe refunds can be requested by an administrator. Pending provider refunds wait for webhook confirmation; original payments and refund records are retained. Partial/external partial refunds require manual reconciliation and are not treated as full refunds. Staff may alternatively record physically received cash using an idempotency key. A live online checkout must be cancelled before cash settlement. The legacy `/api/payments/online` endpoint is unavailable; use Stripe Checkout endpoints.

Official references: [Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment), [webhook signature verification](https://docs.stripe.com/events/manage-webhook-endpoints#resolve-signature-verification-errors).

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

Validated during this change: production frontend build, 22 unit/database tests, and browser checks for all four roles, admin plan creation, member profile editing, registration without biometrics, saved-registration recovery, missing Stripe configuration, and mobile rendering. Stripe API responses were simulated in integration tests; Stripe SDK webhook signing/verification and database settlement were real. The final regression run after adding Stripe refunds and the latest consistency changes was declined. Those final changes have not passed a subsequent runtime test/build. See `IMPLEMENTATION_AUDIT.md` before deployment.

## Production setup

1. Configure HTTPS, authenticated MongoDB, backups and restore testing, unique access/refresh JWT secrets, allowed frontend origins and `NODE_ENV=production`.
2. Review existing duplicate open attendance sessions and allocations before running `npm.cmd run db:indexes`. Production startup does not silently manage indexes. The new attendance index allows one open session per member across all dates; old conflicting records need explicit correction before the index can be created.
3. For a fresh production database set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12-72 characters), run `npm.cmd run admin:create`, and remove the bootstrap password from the environment. This command refuses to create another initial administrator if an admin already exists. Do not seed demo accounts in production.
4. Configure Stripe test keys and the signed webhook. Complete real Stripe sandbox checkout, cancellation, duplicate event, failed activation, retry and refund tests. Then configure live keys and perform operational acceptance testing.
5. Run the complete test suite and production build again. Validate the latest refund, freeze/unfreeze and trainer schedule changes before launch.
6. Host `client/dist` with SPA fallback and deploy the API separately or behind a reverse proxy. Configure the actual frontend URL/API URL. Configure trusted proxy behavior only when your deployment uses one trusted proxy.
7. Monitor API errors, webhook failures, reconciliation records and database backups. Membership expiry/slot cleanup runs at startup and every minute while the API is running; expiry reminders are in-app and deduplicated per membership/day.

Production readiness still depends on the pending validation, real Stripe configuration/testing and operational infrastructure. This repository is not a production certification.

## Boundaries and policies

- Biometrics are disabled and are not required for registration, activation or manual attendance.
- Manual attendance is limited to admin/reception, enforces membership/payment/slot/hours, and is audited.
- One active slot and one primary trainer per member. Slots recur on their configured weekday. Trainer capacity is a conservative total active-client limit drawn from matching availability, not arbitrary simultaneous-session booking.
- Trainer leave is open-ended until administrator reactivation. Scheduled date-range leave is not implemented.
- Downgrades are selected at renewal. Immediate downgrade credits and tax invoice rules are not implemented.
- The plan's configured price is authoritative. Free-form discount/eligibility notes are not an executable promotion engine.
- CSV exports export visible/loaded records. Member, trainer, staff and audit lists expose pagination; several reporting/list endpoints still require pagination work for large deployments.
- Notifications are in-app. SMS/email integrations remain unavailable. Password recovery through email is not implemented.
- Optional expenses, workouts, nutrition, progress and other unfinished modules are excluded from authenticated navigation.

See `IMPLEMENTATION_AUDIT.md` for the module/file map and remaining acceptance items.
