# Mantra MFS500 integration

Current local development attendance uses the implemented backend template search with the existing MORFIN Auth verify operation. See [BIOMETRIC_ATTENDANCE.md](BIOMETRIC_ATTENDANCE.md) for its configuration and acceptance steps; it supersedes older unavailable-provider statements below.

See [BIOMETRIC_ATTENDANCE.md](BIOMETRIC_ATTENDANCE.md) for the newer receptionist scanner/session workflow and current deployment limitations. The later guide supersedes this document's older statement that no verification sessions are issued.

## Implemented capabilities

The existing member model, authentication and gym database are reused. This application has one gym database and no tenant field; admin/reception are gym-wide operators, members can access only their own enrollment, and trainers cannot manage biometrics. If multi-tenancy is introduced, add tenant scoping before sharing a database.

The dashboard Fingerprints screen supports member search, finger selection, scanner discovery, capture preview/quality, retry, authenticated encrypted storage, saved status, explicit replacement and authorized deletion. Self-registration still does not require fingerprints. Manual attendance rules, membership/payment checks, gym timezone and unique open-session index are preserved.

The browser on the scanner-connected Windows computer calls MorFinAuth. The Express API never calls its own localhost to reach a remote user's scanner.

## Source evidence and SDK inconsistencies

Inspected locally:

- D:/Morfin_Auth_Web_SDK_1.0.0.3.zip and its extracted Document and SDKSample directories.
- Document/MorFin_Auth_Windows_Web_SDK_1.0.0.0.pdf, pages 3?12.
- Document/MorFin_Auth_ClientService_UserManual.pdf.
- SDKSample/morfinauth.js and MorFinAuthClientServiceTest.htm.
- Installed copies in C:/Program Files/Mantra/MorFinAuth/MorFinAuthClientService/Test.

All operations use POST. Discovery and uninitialization have no body; other calls send JSON. The working sample's info operation sets isInit=1; the capture sequence follows discovery -> checkdevice -> info -> capture -> gettemplate -> getimage -> uninitdevice. The separate initdevice operation is also exposed by the adapter for explicit SDK initialization.

The PDF documents template response TmpData, whereas both HTML samples read ImgData. The adapter accepts these documented alternatives and rejects conflicting simultaneous values. Image retrieval uses ImgData; capture quality/NFIQ come from Quality/Nfiq. The sample renders capture BitmapData; our preview uses the separately retrieved BMP from the same serialized capture.

FMR_V2005 is TmpFormat 0 and BMP is ImgFormat 0 (the sample subtracts 1 from select values). Quality is 60 and TimeOut is 10. The PDF has inconsistent timeout units: prose says milliseconds, example comments say seconds. Confirm the observed wait with hardware; the browser request deadline is 15 seconds.

Every operation requires ErrorCode 0, with useful messages for documented disconnect, license, initialization and timeout codes. verify/match additionally require a boolean Status. No application matching threshold is invented.

## Configuration

Browser build variables in client/.env.local (rebuild Vite after changes):

```env
VITE_API_URL=http://localhost:5000/api
VITE_MANTRA_DEVICE_MODEL=MFS500
VITE_MANTRA_SERVICE_URL=https://localhost:8030/morfinauth
```

The base path is confirmed by the supplied SDK. HTTPS is the deployment default. Local HTTP can be configured for controlled local development where browser policy permits it. Do not disable browser security, TLS verification, private-network protections or Windows Defender, even where the old installation manual suggests doing so. Do not publish the scanner service or open router ports.

Each capture workstation needs the MFS500 driver, MorFinAuth Client Service, and prerequisites listed in the SDK: supported Windows, .NET Framework 4.8 and VC++ 2013/2015?2019 redistributables. Follow the vendor installer and organization certificate policy.

If Mantra issues a workstation SDK client key, enter it in the screen's password field. It stays in component memory and is sent only to the local service; it is never put in Vite variables, sent to Express or stored in browser persistent storage. An empty value matches the vendor sample's initially blank field. Licensing must be confirmed with Mantra; the SDK does not establish remote server license rights.

Backend secrets in server/.env or deployment secrets:

```env
BIOMETRIC_KEY_VERSION=v1
BIOMETRIC_ENCRYPTION_KEYS='{"v1":"<replace-with-32-random-bytes-in-base64>"}'
BIOMETRIC_RETAIN_IMAGES=false
```

Generate the key once in a secure administrative terminal:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Store it in the backend secret manager and backed-up key escrow; do not commit it, expose it in screenshots, or regenerate it on startup. Missing keys disable enrollment storage. Invalid configured keys fail startup validation. Empty keyrings allow the rest of the application to operate with enrollment disabled.

AES-256-GCM uses a fresh 96-bit nonce and authentication tag per encrypted field. Authenticated additional data binds each value to member ID, application enrollment reference and field purpose. Envelopes include keyVersion. Rotation: add v2 while retaining v1, then change BIOMETRIC_KEY_VERSION to v2 for new writes. Keep old versions until all ciphertext and retained backups requiring them have been re-encrypted or expired. No automated rotation job is included.

Images are decoded/validated but retained only when BIOMETRIC_RETAIN_IMAGES=true. Template-only submissions are supported. Request JSON is bounded to 800 KiB; decoded template to 64 KiB and image to 512 KiB. These are conservative application limits, not measured hardware output guarantees. Adjust only after inspecting legitimate SDK output sizes.

## API and data migration

Existing paths remain:

- GET /api/biometrics/status: backend capabilities; deviceAvailable is null because workstation state is checked by the browser.
- POST /api/biometrics/enroll/initialize: authorized member/capability preflight.
- POST /api/biometrics/enroll/process: memberId (MongoDB member ID), fingerPosition, captureData, optional replaceEnrollmentReference.
- GET /api/biometrics/enrollment?memberId=...: safe saved status.
- DELETE /api/biometrics/enrollment: selected memberId in JSON; admin or member owner.
- GET /api/biometrics/enrollments: admin metadata list, bounded to 500.
- POST /api/biometrics/verify and attendance checkin/checkout: authenticated 503 MATCHER_UNAVAILABLE.

Member ID is optional on owner requests. Passing another member's ID is rejected. Reception can enroll/replace but cannot delete. API response DTOs and schema serialization exclude legacy enrollmentData and encrypted envelopes. Avoid logging request bodies, Axios error configuration, database documents or APM payloads on these endpoints.

Schema changes are additive. Existing member/enrollment-reference unique indexes are retained. No production database migration was run; existing enrollment records are not deleted, overwritten or marked inactive. Legacy records remain schema version 1 and cannot be assumed to contain compatible templates. New writes use schema version 2. There is no safe automatic conversion of arbitrary legacy enrollmentData.

Before rollout: back up the database and keys, inventory legacy records through an authorized offline process without printing their data, and arrange explicit re-enrollment. Replacement requires the current enrollmentReference and uses an atomic conditional update; stale references return 409. Concurrent first saves cannot overwrite because of the existing member unique index. No destructive index synchronization is required.

Deletion physically removes the selected enrollment document, including retained template/image and legacy material. Audit records contain action/field names and IDs only. Backups follow the operator's existing retention/deletion policy; this application cannot erase independent backups. Explicit replacement removes old biometric material from the live document and records the operation in the audit trail.

## Local matching diagnostics and production trust

An administrator running npm run dev sees Development matching diagnostics. It captures a temporary test gallery in memory, then either captures a fresh probe and calls verify, or calls live match. Both use only that test gallery. No stored employee templates are returned by the backend, and diagnostics never call attendance APIs. Clear diagnostic data or navigate away when finished. Production builds omit the diagnostic UI.

The adapter implements documented requests:

```json
{"ProbTemplate":"<fresh probe>","GalleryTemplate":"<test gallery>","TmpFormat":0}
```

for verify, and Quality 60, TimeOut 10, GalleryTemplate and TmpFormat 0 for match. ErrorCode 0 plus Status true means a local diagnostic match; Status false is a mismatch. Strings such as "true" are rejected. These are local results, not proofs accepted by the attendance server.

Deployment inspection found Vercel SPA hosting configuration and instructions to deploy the API separately. The current development environment is Windows, but no production managed-workstation topology, vendor-signed result protocol or remote matcher license is established by the supplied package. For these reasons production biometric attendance stays disabled. Public kiosk biometric routes now require application authentication.

For a backend hosted remotely, install a documented compatible backend matcher, or build and provision an authenticated managed-workstation agent. The agent must protect gallery access and sign/attest results with workstation credentials, bind to server challenges/member/action and enforce replay controls. The supplied service alone does not document this protocol.

If Express and MorFinAuth genuinely run on the same managed Windows machine, direct server-to-local-service matching is a possible deployment-specific integration. It still needs explicit deployment configuration, initialization/concurrency ownership, certificate trust, vendor licensing confirmation, hardware tests, and capture authenticity/replay analysis. The browser adapter must not be copied into a cloud backend expecting remote scanner access.

No verification sessions are issued or accepted in this release. A future trusted integration must mint short-lived single-use sessions bound to employee/action, consume atomically with attendance writes, enforce idempotency and membership/slot/timezone rules, and increment verification counters only after trusted success. Expiry/reuse/session-concurrency tests are deferred with that unavailable path. A nonce alone cannot prove that a physical scan is fresh. getMemberByEnrollment is now read-only.

Neither the 10-gallery limit nor local matching establishes general 1:N identification. No fingerprint-only employee search is implemented.

## Hardware and deployed-origin acceptance steps

1. Configure the persistent backend key and restart Express. Configure client/.env.local and restart Vite (or rebuild production).
2. Connect MFS500; confirm the Windows service and driver are installed/running. Visit https://localhost:8030/morfinauth and resolve certificate trust through approved certificate management without bypassing validation.
3. Close vendor test pages and other scanner applications. Sign in as admin/reception; open Fingerprints, search/select a test member and finger, enter the vendor client key if needed, and choose Check scanner.
4. Capture. Confirm preview, quality >=60, real serial/model, and elapsed timeout behavior. Retry with poor placement and unplug/reconnect tests. Verify each capture releases the device.
5. Save enrollment. Reload the screen to verify persisted metadata. Verify another member cannot access it and ordinary/list responses contain no template, image or encryption envelopes.
6. With image retention false, inspect through a secure administrative process that only encrypted template material is stored. In an isolated test database enable retention, explicitly replace the enrollment and verify encrypted image storage. Test stale replacement conflicts and authorized deletion. Do not export real biometric bytes into logs or fixtures.
7. For local matching diagnostics use an admin development session and a consenting test participant. Capture test gallery, then Capture probe and verify with the same finger; repeat with another finger. Repeat Live match. Confirm genuine SDK Status outcomes and that the attendance count never changes. Clear test data.
8. Repeat scanner discovery and capture from the actual deployed HTTPS application's origin in the intended browser/profile. Inspect CORS/preflight, certificate trust, browser local-network permission and organization policy. Success from a local vendor HTML page does not prove deployed-origin access. Do not bypass denied browser security.
9. Verify POST attendance checkin/checkout and biometrics/verify return 503 MATCHER_UNAVAILABLE for authenticated requests, including forged matched flags/scores/session IDs, and write no attendance. Existing authorized manual attendance remains available under existing gym rules.

Physical capture, real positive/negative matching, licensing, actual output sizes and deployed-origin acceptance require hands-on testing and are not claimed as verified by synthetic tests.

## Automated checks

Run npm test and npm run build. Focused tests: node --test server/tests/biometric.test.js.

Tests use synthetic protocol-shaped bytes and mocked local SDK responses, plus a real isolated MongoDB replica set. They exercise AES-GCM roundtrip/tamper/context binding, response redaction, malformed/oversized payloads, authorization, re-enrollment/deletion, concurrent saves, unavailable matcher rejection without attendance writes, capture sequencing, response-field compatibility and local matching result handling. Mocked Status true tests only validate control flow; they are not a fingerprint match.

On this workstation C: had insufficient space for the MongoDB test binary. The binary and temp files were moved to D:/gym/biometric-test-cache outside the repository. To reuse that cache in PowerShell:

```powershell
$env:MONGOMS_DOWNLOAD_DIR='D:\gym\biometric-test-cache\mongodb'
$env:TEMP='D:\gym\biometric-test-cache\tmp'
$env:TMP=$env:TEMP
npm test
```

## Changed files

- client/src/services/morfinAuth.mjs: asynchronous local SDK adapter and diagnostic matching.
- client/src/pages/Biometrics.jsx, client/src/pages/Dashboard.jsx, client/src/styles.css: enrollment screen, development diagnostics and navigation.
- server/services/biometricCrypto.js, biometricValidation.js, biometricService.js: encryption, bounded validation, safe enrollment lifecycle and capability reporting.
- server/models/BiometricEnrollment.js: additive encrypted schema, metadata and serialization redaction.
- server/controllers/biometricController.js, server/routes/biometrics.js: selected-member authorization and safe responses.
- server/controllers/attendanceController.js, server/routes/attendance.js: authenticated explicit unavailable response; existing manual attendance rules preserved.
- server/config/env.js, server/index.js: backend key/retention configuration, biometric body limit and rate limit.
- client/.env.example, server/.env.example: current configuration examples.
- server/tests/biometric.test.js: synthetic unit/integration/adapter tests.
- README.md, BIOMETRICS.md: integration status, setup, migration and acceptance instructions.

Validation completed: npm test passed all 39 tests (including 8 biometric tests); npm run build passed. Hardware acceptance and deployed-origin access remain unverified.
