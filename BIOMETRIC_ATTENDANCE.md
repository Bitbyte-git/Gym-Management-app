# Reception biometric attendance

## Status and actual identification architecture

**Local Windows development now supports fingerprint-only attendance using your existing MORFIN Auth SDK.** The application does not need fingerprint images for matching. It decrypts the stored FMR_V2005 templates on the backend, calls the real documented verify operation once per active enrollment, and maps the sole matching enrollment to its member.

This is an application search built from SDK 1:1 comparisons. It is not a new fingerprint algorithm and does not require a separate 1:N engine merely to implement the development search. The SDK decides each match using its own Status result. The application accepts exactly one matching member after a complete search; zero matches are unknown and multiple matching members are ambiguous. It never selects the first positive result or compares Base64 strings/hashes as biometric verification.

The user confirmed that development Express, the browser and MFS500 run on the same Windows PC. The local provider in server/services/localMorFinIdentifier.js is implemented and connected through identificationEngine.js to the existing challenge and transactional attendance workflow. It uses encrypted MongoDB templates without sending enrolled galleries to the browser. The provider returns identity bound to the server's challenge, event and station context. Attendance rules, idempotency, cooldown and re-arm protections still apply.

For AWS/remote production, direct local mode remains disabled. A managed Windows workstation agent can host this SDK-based matching approach, subject to measured capacity and supported licensing, and authenticate its challenge-bound results to EC2. A compatible server identification engine is another option. No signed/provisioned agent is included yet, and a browser context token is not proof of managed workstation identity. EC2 localhost cannot reach the scanner-connected user's localhost.

## Local search configuration and behavior

The ignored server/.env on this workstation has been configured with:

```env
NODE_ENV=development
BIOMETRIC_IDENTIFICATION_MODE=morfin-local-development
MORFIN_AUTH_SERVICE_URL=https://localhost:8030/morfinauth
```

Restart the backend and frontend with npm run dev. Enrollment encryption keys must remain configured. Open the application through localhost or 127.0.0.1, sign in as reception/admin, and open attendance. Resume should initialize the device and show Ready - place your finger. Enrollment still selects a member; attendance identification does not.

The local backend accepts only direct loopback requests and loopback browser origins for this mode. Forwarded/proxied requests are rejected. The provider requires Windows and NODE_ENV=development, and production startup rejects this mode. Keep BIOMETRIC_IDENTIFICATION_MODE=disabled on EC2 until the remote trusted integration is implemented.

The documented SDK request sent from the backend is POST /morfinauth/verify:

```json
{"ProbTemplate":"<fresh probe>","GalleryTemplate":"<one decrypted enrolled template>","TmpFormat":0}
```

Every comparison must return ErrorCode 0. Explicit boolean Status true means a match; boolean false means a non-match. This installed SDK also omits Status with ErrorDescription Success for non-matches; that observed variant is normalized to false. The browser's capture run initializes the local service and keeps scanner ownership while Express performs these sequential comparisons. The backend does not reinitialize/uninitialize the browser's owned device during a search. SDK licensing or initialization errors fail the entire search.

All active enrollments must have compatible version-2 encrypted FMR_V2005 data. Missing keys, invalid templates or active legacy records cause an explicit error rather than a partial search. Use the existing explicit re-enrollment workflow to repair those records; no enrollments are automatically deleted. Enrollment references are re-read after the search, and a changing gallery is rejected. Selected enrollment validity is checked again before verification and attendance commit.

The application bounds development searches with:

```env
BIOMETRIC_SEARCH_MAX_CANDIDATES=100
BIOMETRIC_SEARCH_TIMEOUT_MS=15000
```

These are application limits, not vendor gallery limits or biometric thresholds. A verify request contains one gallery template, regardless of the SDK's separate support for up to 10 in a single call. The full search is linear in enrollment count and has a 2-second maximum per-request transport deadline within its overall budget and challenge expiry. An oversized gallery, deadline failure or SDK error never accepts a partial positive. Measure real hardware/service latency before changing capacity settings. Successful identify responses include comparison count and elapsed milliseconds without biometric data.

The Node HTTPS client combines normal CA trust with the Windows system CA store when available. Certificate verification is never disabled. On older Node versions, configure the approved vendor CA through NODE_EXTRA_CA_CERTS before launching Node, or use a supported Node version with system CA support. A certificate-trust problem is reported explicitly.

Encrypted templates remain in MongoDB. Only one gallery is decrypted at a time; byte buffers are cleared afterwards and transient Base64 strings are released for garbage collection. Attendance captures do not request or retain an image. No template is written into attendance/audit/session records or ordinary responses.

The real local service was reached through this certificate-verified Node transport and reported ErrorCode 0 with MFS500 connected. Fresh-finger matching, actual search throughput, finger removal and deployed-origin acceptance still require hands-on tests. Runtime SDK license failures are surfaced. Confirm permitted use/redistribution and deployment licensing with Mantra before production rollout; no new SDK purchase is assumed necessary for this local development implementation.


## Scanner lifecycle and limits

The client controller uses initializing, capturing, identifying, recording, result, rearming, paused, disconnected and error phases. Capturing displays Ready - place your finger. It issues sequential finite captures (Quality 60, TimeOut 10), then retrieves the template from that capture. Attendance does not retrieve or store a new fingerprint image. The existing enrollment image/preview workflow remains intact.

Normal SDK -2019 no-finger timeouts resume with a short delay and no repeated error popup. Poor capture, unknown/ambiguous identity and membership denial show distinct feedback. Device/service errors stop the loop; use Retry after recovery. No overlapping setInterval captures exist.

A Web Lock named pulsefit-morfinauth is held for the entire listening run, including identification, recording and re-arm delays. A second same-origin tab displays Scanner in use in another tab. Automatic scanning requires Web Locks support in a secure browser. Locks cannot coordinate unrelated origins or native/vendor test tools; close other scanner software.

Pausing, hiding the tab, navigation and logout invalidate the controller generation. Late captures and identification results cannot send a new record request. The logout API also cancels operator station contexts. Capture HTTP requests already running are deliberately drained until their finite response before uninitializing the device and releasing ownership. Aborting fetch alone is not treated as device cancellation. No undocumented stop/LED/power API is used.

After uncertain capture transport failure, Retry waits out a conservative 30-second capture deadline and calls documented uninitdevice before allowing reuse. The same-origin browser stores only that deadline as pulsefit.scannerDrainUntil; no biometric data or keys are stored. A tab closed during capture leaves this short drain deadline for another tab. Actual SDK timeout behavior and recovery timing require hardware confirmation. This is a conservative application policy, not proof that every hung/compromised device has stopped.

The SDK documentation supplies no reliable finger presence/removal event. The re-arm strategy therefore combines:

- A configurable delay after results (default 5 seconds).
- A server-enforced per-member cooldown (default 60 seconds) across reception stations; recent manual entry/exit timestamps also participate.
- A server-side same-member latch for each active station context. After a recorded event, that member is ignored at that station even beyond cooldown until another member is recorded there or reception selects Confirm finger removed.

The latch prevents a finger left on the same scanner from immediately checking its owner out. Operator confirmation is a deliberate statement, not a sensor event. New station contexts reset that context's latch, and the physical identity of a workstation is not proven by browser tokens. Cooldown alone does not prove finger removal, freshness or replay resistance. These limitations must be addressed and hardware-tested with the future trusted identification deployment.

## Backend sessions, idempotency and rules

All new /api/attendance/biometric routes require authenticated active reception/admin access:

| Method and suffix | Purpose |
| --- | --- |
| GET /capabilities | Actual identifier availability and configured policies |
| GET /overview | Recent events, open count, stale visits and timezone |
| POST /stations | Issue an opaque 15-minute browser/operator context |
| POST /stations/close | Cancel that context and pending verifications |
| POST /stations/rearm | Explicit operator confirmation of finger removal |
| POST /challenges | Issue a random 45-second challenge and unique event ID |
| POST /identify | Ask the server-owned identifier to process a bounded transient probe |
| POST /record | Consume verified identity and determine the action from database state |

Tokens are random and stored only as hashes. Browser context/challenge tokens and pending retry data stay in memory. Session expiry is checked explicitly; TTL cleanup is not the authorization check. Issuing a new challenge cancels the station's previous unconsumed challenge. Unknown, ambiguous, forged, expired, cancelled and cross-context requests never write attendance. Unexpected body fields such as matched, score, memberId and action are rejected by the record route.

The record transaction locks the operator, station and shared member document. It checks active enrollment/reference, cooldown and same-member latch, determines the current open visit, and atomically updates attendance, consumes the verification, updates successful verification counters and appends a minimal audit entry. Concurrent stations share the member lock; the existing unique partial index additionally prevents two open visits.

A verified member with no open visit is checked in only after the existing active account, paid/current membership, gym hours, timezone and assigned-slot rules pass. A member with an open visit is checked out from that specific session even if their membership expired, their profile was suspended or the gym closed during the visit. No daily punch-count toggle or guessed last scan exists. Later eligible visits can open a new session under existing rules.

An open visit aged 16 hours or more is stale by default. With policy review, automatic changes stop and reception reviews it using authorized manual checkout. With allow_checkout, a trusted scan closes it with an audit flag. Ordinary overnight visits younger than the threshold can check out. No visit is silently closed or converted into a new check-in.

The same event ID and verification token return the original committed response for an exact retry, including after pause or challenge expiry, within the 24-hour retention window. Changing the event ID is rejected. This intentional idempotent response is not a second consumption. Unconsumed expired verifications fail. If the response is lost, the screen keeps only that attempted event in memory and offers Retry attendance confirmation. It does not start a fresh toggle or persist an offline queue. Definitive rejection is distinct from uncertain network failure.

Cancellation and recording serialize on the same station document. If cancellation wins, subsequent record/identification completion fails. If recording committed before pause/logout, cancellation cannot retroactively undo it; the exact retry can return its original result. Abrupt browser/network loss cannot provide instantaneous server revocation, so short expiry and lack of new browser requests bound the window. This does not eliminate compromised-workstation or replay risks.

## Configuration and storage

Frontend configuration is unchanged: client/.env.local uses VITE_MANTRA_DEVICE_MODEL=MFS500 and VITE_MANTRA_SERVICE_URL=https://localhost:8030/morfinauth. Use the existing VITE_API_URL for the API. Workstation SDK client keys, if required by Mantra, can be entered in the panel's configuration field and remain in memory; backend encryption or matcher credentials never belong in Vite configuration.

Add the following backend policy values to server/.env or deployment secrets, or use their defaults:

```env
BIOMETRIC_COOLDOWN_SECONDS=60
BIOMETRIC_REARM_SECONDS=5
BIOMETRIC_STALE_SESSION_HOURS=16
BIOMETRIC_STALE_SESSION_POLICY=review
GYM_BRANCH_ID=main
```

GYM_TIMEZONE remains the display/business timezone. Timestamps are UTC. Enrollment encryption/retention settings remain documented in BIOMETRICS.md; attendance never saves probes or images. Request JSON is bounded to 100 KiB for these routes; decoded probes are limited to 64 KiB.

The repository currently has one gym database and no multi-branch member access/visit-limit model. GYM_BRANCH_ID labels this deployment's new station/attendance records; it does not introduce tenant isolation or a new member branch entitlement system. An open visit explicitly labelled for another branch is rejected for review. Legacy unlabelled visits remain compatible with the current gym. Do not share this database between independent tenants on the assumption that this label is authorization.

The UI uses the existing default initials avatar because the project explicitly excludes profile-photo uploads. No photo-upload feature or new biometric image retention was introduced.

## Indexes and rollout

New collections:

- BiometricStationSession: unique tokenHash and contextId, operator/active lookup, TTL on purgeAt.
- BiometricVerificationSession: unique tokenHash and eventId, station/state lookup, TTL on purgeAt.

Contexts expire in 15 minutes and challenges in 45 seconds; purgeAt is 24 hours after creation to preserve short-term idempotent responses. Purging a token removes the ability to retrieve its response; permanent attendance and audit references remain.

Existing models receive additive fields: attendance branch and per-action receptionist/workstation/verification references; hidden member lock/last-biometric-time fields; hidden operator lock counter. Attendance retains its unique partial member index for sessionOpen:true and adds member/checkInTime, sessionOpen/checkInTime and updatedAt lookup indexes. No destructive index synchronization or historical attendance rewrite is required.

The recording/challenge/re-arm path requires MongoDB transactions on a replica set or compatible sharded deployment. Standalone MongoDB returns TRANSACTIONS_REQUIRED; there is no unsafe nontransactional fallback. Existing manual attendance remains available under its existing behavior.

Before deployment, back up the database and encryption keys, then run npm run db:indexes against the intended configured database to create the additive indexes. Production autoIndex is disabled. This task's tests created indexes only in isolated test databases; no production migration was run.

## Tests and hardware acceptance

Automated tests use synthetic bytes and test-only backend matcher doubles. Lifecycle tests cover sequential timeouts, disconnection, pause/navigation/logout, uncertain-response retries, ownership errors, and actual adapter drain behavior with a mocked finite capture. Database tests use an isolated MongoDB replica set for toggling, cooldown/latch, concurrency, exact retries, expiry/forgery, unknown/ambiguous outcomes, membership restrictions, overnight/stale policies, cancellation and operator revocation.

Run npm test and npm run build. The focused Edge check is:

```powershell
node server/tests/attendanceKiosk.browser.cjs
```

It uses real browser Web Locks and application authentication/APIs with synthetic scanner discovery responses. It checks the unavailable state, preserved manual controls, pause/resume, second-tab rejection, recovery and desktop/mobile rendering. It does not capture fingerprints or fabricate a hardware match.

On this computer use D: for test binaries, npm cache and temporary files because C: has insufficient free space:

```powershell
$env:MONGOMS_DOWNLOAD_DIR='D:\gym\biometric-test-cache\mongodb'
$env:npm_config_cache='D:\gym\biometric-test-cache\npm'
$env:TEMP='D:\gym\biometric-test-cache\tmp'
$env:TMP=$env:TEMP
npm test
npm run build
node server/tests/attendanceKiosk.browser.cjs
```

Local hardware acceptance:

1. Install the documented MFS500 driver/service/prerequisites on each workstation. Close vendor/native test applications. Establish approved HTTPS certificate trust; do not bypass browser or certificate validation.
2. Sign in as reception and open attendance. Confirm automatic discovery/initialization, real model/serial, Ready/Place your finger after initialization, recent events and manual fallback. If local mode is disabled or unsupported, no capture should start.
3. Test Pause, hidden tab, navigation and logout. Open a second same-origin tab while one holds the scanner and confirm rejection. Verify reconnect/Retry and vendor license errors using the intended configuration.
4. Repeat from the actual deployed HTTPS origin and browser/profile. Verify local-network permission, CORS/preflight and certificate trust. Local vendor HTML success does not establish deployed-origin access.

Local matching acceptance and future production rollout:

5. For local development, enroll consenting test members and run the implemented template search. Verify real positive/negative/ambiguous outcomes and measure the comparison count/elapsed time. Before EC2 rollout, implement authenticated workstation-agent or server matching, confirm deployment licensing and verify station credential provisioning/revocation.
6. With consenting test members, verify first scan check-in, no immediate checkout while held, ignored repeats within cooldown and beyond cooldown while latched, explicit removal confirmation, different-member rearming and later eligible checkout.
7. Test multiple stations concurrently; lose a record response and explicitly retry its same event. Test unknown/ambiguous fingers, expired memberships/new entry, expiry during an open visit, overnight visits and stale review.
8. Pause/navigate/logout during capture, identification and recording; confirm ordering, no new late writes, drain/uninitialization and recovery timing. Verify real TimeOut units and scanner output sizes.
9. Check that no attendance capture bytes appear in MongoDB attendance/session/audit records, API responses, persistent browser storage or logs. No success card should precede the server's committed response.

Do not claim production readiness until real identification/trust, re-arm behavior, concurrency and deployed-origin device access pass these tests.

## Changed files

- client/src/components/AttendanceKiosk.jsx: reception panel and lifecycle integration.
- client/src/services/attendanceScanner.mjs: sequential state machine, cancellation and exact-event confirmation retry.
- client/src/services/morfinAuth.mjs: owned listening sessions, template-only capture and hardware drain/recovery.
- client/src/pages/Operations.jsx and client/src/styles.css: existing attendance section integration and theme styling.
- client/src/contexts/AuthContext.jsx: stop scanning immediately when logout begins.
- server/services/biometricAttendanceService.js, identificationEngine.js and localMorFinIdentifier.js: transactional sessions and actual local SDK template-search provider.
- server/services/attendanceAccess.js and server/controllers/attendanceController.js: shared existing eligibility rules, including transaction support.
- server/controllers/biometricAttendanceController.js and server/routes/attendance.js: authenticated receptionist APIs.
- server/models/BiometricStationSession.js and BiometricVerificationSession.js: bounded challenge/session lifecycle.
- server/models/MemberAttendance.js, MemberProfile.js and User.js: additive action metadata and transaction locks.
- server/controllers/authController.js: server-side cancellation on logout.
- server/config/env.js, server/.env.example and server/index.js: policies, input limits and rate limiting.
- server/tests/biometricAttendance.test.js, attendanceScanner.test.js and attendanceKiosk.browser.cjs: synthetic database/lifecycle/browser checks.
- BIOMETRIC_ATTENDANCE.md, BIOMETRICS.md and README.md: setup, rollout and remaining dependencies.

## Validation results for this change

- Full automated suite before the local search addition: 58 passed; see the current local-search results below.
- Production Vite build: passed.
- Headless Edge attendance UI check: passed, including real same-origin Web Locks and scanner discovery doubles.
- Backend/test JavaScript syntax checks: 93 files passed.
- Physical MFS500 capture/removal behavior, trusted real identification and actual deployed-origin access: not verified.
- Production database indexes/migration: not executed; use the documented target-database rollout step.

Browser screenshots are in test-results/attendance-kiosk-desktop.png and test-results/attendance-kiosk-mobile.png (ignored verification artifacts).

## Local-search validation

The final full suite passes 72 tests. The production frontend build passed. A separate headless Edge check, node server/tests/localTemplateAttendance.browser.cjs, passed automatic capture-to-backend search-to-checkin and ignored a repeat scan. Scanner capture and SDK match responses in that check were synthetic; the MongoDB encryption, candidate mapping, authorization, browser state machine and attendance transaction paths were real application code against isolated test data. This is not a claim of real fingerprint matching or production readiness.

Additional changed files for local search: server/services/localMorFinIdentifier.js, server/middleware/localBiometricWorkstation.js, server/tests/localMorFinIdentifier.test.js, server/tests/localTemplateAttendance.browser.cjs, provider/capability wiring, local environment configuration, and the Fingerprints screen attendance link. No database migration or biometric-data rewrite is required by this addition.

If a matching HTTP request times out or disconnects without confirming SDK completion, the local provider pauses further matching until MorFinAuth and the backend are restarted. Closing the HTTP request does not prove the native matcher stopped. A fully returned SDK rejection or a completed search exceeding its total budget does not imply an in-flight native call.

## SDK omitted-false Status compatibility fix

The installed service was observed returning ErrorCode "0", ErrorDescription "Success" and no Status property for a non-match, while a positive match returns boolean Status true. The earlier parser incorrectly treated the omitted false value as a malformed result and stopped at the first non-matching enrollment. Backend search and local browser diagnostics now normalize only that observed omitted-field/Success variant to a non-match, continue through the gallery, and still require explicit boolean true to accept any match. Null, numeric or string statuses remain rejected. SDK errors still fail the search.

Validation: 72 automated tests passed and the production frontend build passed. A real local SDK search using the saved Demo Member template identified that member after two comparisons in 134 ms. This was a saved-template diagnostic, not a fresh physical scan, and did not call attendance recording. Fresh-finger capture/attendance should be retried after restarting the development backend. No re-enrollment was performed for this fix.

## Automatic scanner reinitialization between attempts

After each completed attempt and result display/re-arm delay, the attendance loop calls documented uninitdevice, rediscovers/checks MFS500, and initializes it through the working info operation before issuing the next finite capture. Normal no-finger timeouts and recoverable capture/identity failures follow the same reset before retry. No operating-system or Windows-service restart is performed.

The same Web Lock and server station session remain owned across this reset. Resetting the hardware does not confirm finger removal or clear the server cooldown/same-member latch. Matching/attendance processing finishes before resetting so the local service is not uninitialized during verification. Pause/navigation/logout during reset prevent a subsequent capture; disconnect/reset failure stops the loop for recovery. Stale-review and uncertain attendance outcomes retain their existing pause behavior.

Validation: 76 automated tests passed, production frontend build passed, and the synthetic Edge attendance test confirmed uninitdevice then info between captures while repeat scanning did not close the visit. Real-device reinitialization still requires hands-on acceptance.
