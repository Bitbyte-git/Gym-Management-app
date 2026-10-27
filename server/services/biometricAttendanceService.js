const mongoose = require('mongoose');
const { randomBytes, randomUUID, createHash } = require('node:crypto');
const config = require('../config/env');
const Station = require('../models/BiometricStationSession');
const Verification = require('../models/BiometricVerificationSession');
const Member = require('../models/MemberProfile');
const User = require('../models/User');
const Enrollment = require('../models/BiometricEnrollment');
const Attendance = require('../models/MemberAttendance');
const Audit = require('../models/AuditLog');
const engine = require('./identificationEngine');
const { decodeBase64 } = require('./biometricValidation');
const { decrypt } = require('./biometricCrypto');
const { validateAttendanceAccess } = require('./attendanceAccess');
const { gymDayBounds } = require('../utils/gymDate');
const { getSessionName, formatDuration, calculateDailySpending } = require('../utils/gymSession');
const error = (code, message, statusCode = 409) => Object.assign(new Error(message), { code, statusCode });
const hash = token => {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw error('INVALID_SESSION', 'Invalid biometric session', 400);
  return createHash('sha256').update(token).digest('hex');
};
const retention = now => new Date(now.getTime() + 24 * 3600000);
const actor = async (userId, session = null) => {
  const query = { _id: userId, isActive: true, role: { $in: ['admin', 'reception'] } };
  const user = session
    ? await User.findOneAndUpdate(query, { $inc: { biometricVersion: 1 } }, { session, returnDocument: 'after' })
    : await User.findOne(query);
  if (!user) throw error('NOT_AUTHORIZED', 'Reception or administrator access is required', 403);
};
const capabilities = () => ({
  identificationAvailable: engine.available(),
  reason: engine.status().reason,
  mode: config.biometric.identificationMode,
  developmentOnly: config.biometric.identificationMode === 'morfin-local-development',
  cooldownSeconds: config.biometric.cooldownSeconds,
  rearmSeconds: config.biometric.rearmSeconds,
  staleHours: config.biometric.staleHours,
  stalePolicy: config.biometric.stalePolicy,
  timeZone: config.gym.timezone,
  branch: config.gym.branchId,
  removalDetectionAvailable: false,
  rearmStrategy: 'delay_and_same_member_latch',
});
async function stationFor(token, operator, session = null, { lock = false, active = true, now = new Date() } = {}) {
  const query = { tokenHash: hash(token), operator, branch: config.gym.branchId,
    ...(active ? { active: true, expiresAt: { $gt: now } } : {}) };
  const station = lock
    ? await Station.findOneAndUpdate(query, { $inc: { revision: 1 } }, { session, returnDocument: 'after' }).select('+lastRecordedMember +sameMemberArmed')
    : await Station.findOne(query).select('+lastRecordedMember +sameMemberArmed').session(session);
  if (!station) throw error('STATION_INACTIVE', 'Scanner session is paused or expired. Resume to create a new session.', 409);
  return station;
}
async function openStation(operator) {
  await actor(operator);
  const now = new Date(), token = randomBytes(32).toString('base64url');
  const station = await Station.create({
    tokenHash: hash(token), operator, contextId: randomUUID(), branch: config.gym.branchId,
    expiresAt: new Date(now.getTime() + 15 * 60000), purgeAt: retention(now),
  });
  return { stationToken: token, contextId: station.contextId, expiresAt: station.expiresAt };
}
async function closeStation(stationToken, operator) {
  // Serialize with recording transactions by writing the same station document.
  await Station.updateOne({ tokenHash: hash(stationToken), operator }, { $set: { active: false }, $inc: { revision: 1 } });
  await Verification.updateMany({ operator, station: { $in: await Station.find({ tokenHash: hash(stationToken), operator }).distinct('_id') }, state: { $in: ['issued', 'verified'] } }, { $set: { state: 'cancelled' } });
}
async function closeOperatorStations(operator) {
  await Station.updateMany({ operator, active: true }, { $set: { active: false }, $inc: { revision: 1 } });
  await Verification.updateMany({ operator, state: { $in: ['issued', 'verified'] } }, { $set: { state: 'cancelled' } });
}
async function confirmRemoval(stationToken, operator) {
  await actor(operator);
  await mongoose.connection.transaction(async session => {
    const station = await stationFor(stationToken, operator, session, { lock: true });
    await Station.updateOne({ _id: station._id }, { $set: { sameMemberArmed: true } }, { session });
  });
  return { rearmed: true, message: 'Operator confirmed finger removal. Server cooldown still applies.' };
}
async function issueVerification(stationToken, operator) {
  await actor(operator);
  // Challenges may be issued while identification is unavailable; they confer no identity.
  return mongoose.connection.transaction(async session => {
    const now = new Date();
    const station = await stationFor(stationToken, operator, session, { lock: true, now });
    await Verification.updateMany({ station: station._id, state: { $in: ['issued', 'verified'] } }, { $set: { state: 'cancelled' } }, { session });
    const token = randomBytes(32).toString('base64url'), challenge = randomBytes(32).toString('base64url'), eventId = randomUUID();
    const expiresAt = new Date(Math.min(now.getTime() + 45000, station.expiresAt.getTime()));
    await Verification.create([{ tokenHash: hash(token), challenge, eventId, operator, station: station._id,
      branch: config.gym.branchId, expiresAt, purgeAt: retention(now) }], { session });
    return { verificationToken: token, eventId, challenge, expiresAt };
  });
}
async function verificationFor(token, station, operator, session = null) {
  const verification = await Verification.findOne({ tokenHash: hash(token), station: station._id, operator, branch: config.gym.branchId })
    .select('+challenge +member +enrollmentReference +result').session(session);
  if (!verification) throw error('INVALID_VERIFICATION', 'Verification does not belong to this scanner session', 403);
  return verification;
}
async function getCandidates(operator) {
  await actor(operator);
  const rows = await Enrollment.find({ isActive: true, enrollmentStatus: 'enrolled' })
    .select('_id member enrollmentReference schemaVersion templateFormat +encryptedTemplate')
    .sort({ _id: 1 })
    .limit(config.biometric.searchMaxCandidates)
    .lean();

  const candidates = [];
  for (const row of rows) {
    if (row.schemaVersion === 2 && row.templateFormat === 'FMR_V2005' && row.encryptedTemplate && row.member) {
      try {
        const decrypted = decrypt(row.encryptedTemplate, String(row.member) + ':' + row.enrollmentReference + ':template');
        candidates.push({
          memberId: String(row.member),
          enrollmentReference: row.enrollmentReference,
          galleryTemplate: decrypted.toString('base64'),
          templateFormat: 'FMR_V2005',
        });
      } catch (err) {}
    }
  }
  return candidates;
}

async function identify({ stationToken, verificationToken, probeTemplate, templateFormat, matchedMemberId, matchedEnrollmentReference, diagnostics }, operator) {
  await actor(operator);
  const station = await stationFor(stationToken, operator);
  const verification = await verificationFor(verificationToken, station, operator);
  if (verification.state !== 'issued' || verification.expiresAt <= new Date()) throw error('VERIFICATION_EXPIRED', 'Verification is expired or no longer usable');
  if (!engine.available()) return engine.identify(); // Explicit unavailable response, never a fabricated match.

  if (matchedMemberId && matchedEnrollmentReference) {
    const result = await engine.identify({
      memberId: matchedMemberId,
      enrollmentReference: matchedEnrollmentReference,
      challenge: verification.challenge,
      eventId: verification.eventId,
      stationContext: station.contextId,
      operator: String(operator),
      expiresAt: verification.expiresAt,
      diagnostics,
    });
    if (result.outcome !== 'identified') {
      await Verification.updateOne({ _id: verification._id, state: 'issued' }, { $set: { state: 'rejected' } });
      throw error('UNKNOWN_FINGERPRINT', 'Fingerprint is not recognized. No attendance recorded.', 422);
    }
    await mongoose.connection.transaction(async session => {
      await actor(operator, session);
      await stationFor(stationToken, operator, session, { lock: true });
      const enrollment = await Enrollment.findOne({ member: result.memberId, enrollmentReference: result.enrollmentReference,
        isActive: true, enrollmentStatus: 'enrolled', schemaVersion: 2 }).session(session);
      if (!enrollment) throw error('ENROLLMENT_INACTIVE', 'The identified enrollment is no longer active', 403);
      const updated = await Verification.updateOne({ _id: verification._id, state: 'issued', expiresAt: { $gt: new Date() } },
        { $set: { state: 'verified', member: result.memberId, enrollmentReference: result.enrollmentReference } }, { session });
      if (!updated.modifiedCount) throw error('VERIFICATION_EXPIRED', 'Verification expired, was cancelled, or has already been used');
    });
    return { verified: true, eventId: verification.eventId, ...(result.diagnostics ? { search: { comparisons: result.diagnostics.comparisons, elapsedMs: result.diagnostics.elapsedMs } } : {}) };
  }

  if (templateFormat !== 'FMR_V2005') throw error('INVALID_TEMPLATE', 'Only FMR_V2005 is enabled', 400);
  const probe = decodeBase64(probeTemplate, 64 * 1024, 'Probe template');
  try {
    if (probe.subarray(0, 4).toString('ascii') !== 'FMR\0') throw error('INVALID_TEMPLATE', 'Invalid FMR template', 400);
    // Only this server-owned provider may identify a member. Browser IDs/scores are not inputs.
    const result = await engine.identify({
      probe, templateFormat, challenge: verification.challenge, eventId: verification.eventId,
      stationContext: station.contextId, operator: String(operator), expiresAt: verification.expiresAt,
    });
    if (!result || !['identified', 'unknown', 'ambiguous'].includes(result.outcome)) throw error('INVALID_ENGINE_RESULT', 'Identification provider returned an invalid result', 503);
    if (result.outcome !== 'identified') {
      await Verification.updateOne({ _id: verification._id, state: 'issued' }, { $set: { state: 'rejected' } });
      throw error(result.outcome === 'ambiguous' ? 'AMBIGUOUS_FINGERPRINT' : 'UNKNOWN_FINGERPRINT',
        result.outcome === 'ambiguous' ? 'Fingerprint is ambiguous. No attendance recorded.' : 'Fingerprint is not recognized. No attendance recorded.', 422);
    }
    if (result.challenge !== verification.challenge || result.eventId !== verification.eventId ||
        result.stationContext !== station.contextId || !mongoose.isObjectIdOrHexString(result.memberId) ||
        typeof result.enrollmentReference !== 'string') throw error('INVALID_ENGINE_RESULT', 'Identification result is not bound to this challenge', 403);
    await mongoose.connection.transaction(async session => {
      await actor(operator, session);
      await stationFor(stationToken, operator, session, { lock: true });
      const enrollment = await Enrollment.findOne({ member: result.memberId, enrollmentReference: result.enrollmentReference,
        isActive: true, enrollmentStatus: 'enrolled', schemaVersion: 2 }).session(session);
      if (!enrollment) throw error('ENROLLMENT_INACTIVE', 'The identified enrollment is no longer active', 403);
      const updated = await Verification.updateOne({ _id: verification._id, state: 'issued', expiresAt: { $gt: new Date() } },
        { $set: { state: 'verified', member: result.memberId, enrollmentReference: result.enrollmentReference } }, { session });
      if (!updated.modifiedCount) throw error('VERIFICATION_EXPIRED', 'Verification expired, was cancelled, or has already been used');
    });
    return { verified: true, eventId: verification.eventId, ...(result.diagnostics ? { search: { comparisons: result.diagnostics.comparisons, elapsedMs: result.diagnostics.elapsedMs } } : {}) }; // No biometric bytes or untrusted score returned.
  } finally { probe.fill(0); }
}
async function record({ stationToken, verificationToken, eventId }, operator) {
  await actor(operator);
  if (typeof eventId !== 'string' || !/^[0-9a-f-]{36}$/.test(eventId)) throw error('INVALID_EVENT', 'Use the server-issued event ID', 400);
  return mongoose.connection.transaction(async session => {
    await actor(operator, session);
    const now = new Date();
    const priorStation = await stationFor(stationToken, operator, session, { active: false, now });
    const verification = await verificationFor(verificationToken, priorStation, operator, session);
    if (verification.eventId !== eventId) throw error('EVENT_MISMATCH', 'Idempotency key does not match the verification', 409);
    // Exact retries return the committed snapshot even after pause/expiry, within 24h retention.
    if (verification.state === 'consumed') return verification.result;
    const station = await stationFor(stationToken, operator, session, { lock: true, now });
    if (verification.state !== 'verified' || verification.expiresAt <= now) throw error('UNTRUSTED_VERIFICATION', 'A fresh trusted identification is required', 403);
    // Shared member document serializes concurrent stations. No client chooses member or action.
    const member = await Member.findOneAndUpdate({ _id: verification.member }, { $inc: { attendanceVersion: 1 } },
      { session, returnDocument: 'after' }).select('+lastBiometricPunchAt');
    if (!member) throw error('MEMBER_NOT_FOUND', 'Member no longer exists', 404);
    const enrollment = await Enrollment.findOne({ member: member._id, enrollmentReference: verification.enrollmentReference, isActive: true, enrollmentStatus: 'enrolled', schemaVersion: 2 }).session(session);
    if (!enrollment) throw error('ENROLLMENT_INACTIVE', 'Enrollment is inactive or has changed', 403);
    const latest = await Attendance.findOne({ member: member._id }).sort({ checkInTime: -1 }).session(session);
    const lastAt = Math.max(member.lastBiometricPunchAt?.getTime() || 0, latest?.checkInTime?.getTime() || 0, latest?.checkOutTime?.getTime() || 0);
    const remaining = Math.max(0, Math.ceil((lastAt + config.biometric.cooldownSeconds * 1000 - now.getTime()) / 1000));
    const latched = String(station.lastRecordedMember || '') === String(member._id) && !station.sameMemberArmed;
    let result = {
      eventId, recorded: false, action: 'duplicate', timestamp: now.toISOString(),
      member: { id: member.id, memberId: member.memberId, fullName: member.fullName, avatarInitials: member.avatarInitials || member.fullName.split(' ').map(p => p[0]).join('').slice(0, 2) },
      timeZone: config.gym.timezone,
    };
    if (remaining || latched) {
      result = { ...result, code: 'DUPLICATE_SCAN', retryAfterSeconds: remaining, requiresRemovalConfirmation: latched,
        message: 'Attendance already recorded - please remove your finger' };
    } else {
      const currentSession = getSessionName(now, config.gym.timezone);
      const dayBounds = gymDayBounds(now);

      let attendance = null;
      let openSession = await Attendance.findOne({ member: member._id, sessionOpen: true }).session(session);

      if (openSession?.branch && openSession.branch !== config.gym.branchId) {
        throw error('BRANCH_MISMATCH', 'This open visit belongs to another branch and requires staff review', 403);
      }

      const stale = openSession && now.getTime() - openSession.checkInTime.getTime() >= config.biometric.staleHours * 3600000;
      if (stale && config.biometric.stalePolicy === 'review') {
        result = { ...result, action: 'review', code: 'STALE_SESSION', message: 'An old open visit needs receptionist review. Use the authorized manual checkout after review.' };
      } else {
        // If an open session exists from a previous day, auto-close it so today's visit proceeds cleanly
        if (openSession && openSession.attendanceDate < dayBounds.start) {
          await Attendance.updateOne({ _id: openSession._id }, {
            $set: {
              sessionOpen: false,
              notes: [openSession.notes, 'Auto-closed stale prior day session'].filter(Boolean).join('\n'),
              updatedAt: now,
            },
          }, { session });
          openSession = null;
        }

        const punchRecord = {
          punchTime: now,
          punchType: 'punch',
          deviceId: 'MFS500',
          verificationReference: eventId,
          workstation: station.contextId,
          receptionist: operator,
        };

        const CHECKIN_GRACE_PERIOD_MS = 5 * 60 * 1000; // 5-minute grace period for confused re-punches

        if (openSession) {
          const elapsedMs = now.getTime() - new Date(openSession.checkInTime).getTime();

          if (elapsedMs < CHECKIN_GRACE_PERIOD_MS) {
            // Member punched again within 5 minutes of check-in (confused if first punch registered)
            // Reconfirm check-in: DO NOT checkout, keep sessionOpen: true, checkOutTime: null
            punchRecord.punchType = 'punch';
            const updated = await Attendance.findOneAndUpdate(
              { _id: openSession._id },
              {
                $set: { updatedAt: now },
                $push: { punches: punchRecord },
              },
              { session, returnDocument: 'after' }
            );
            if (!updated) throw error('SESSION_CHANGED', 'Attendance changed. No biometric action was recorded.');
            attendance = updated;
            result.action = 'checkin';
            result.reconfirmed = true;
          } else {
            // Member is checking out after working out (>= 5 minutes)
            const duration = Math.max(1, Math.round(elapsedMs / 60000));
            punchRecord.punchType = 'checkout';
            const updated = await Attendance.findOneAndUpdate(
              { _id: openSession._id },
              {
                $set: {
                  checkOutTime: now,
                  sessionOpen: false,
                  duration,
                  checkOutVerificationReference: eventId,
                  checkOutWorkstation: station.contextId,
                  checkOutReceptionist: operator,
                  updatedAt: now,
                  ...(stale ? { staleSessionReviewedByPolicy: true } : {}),
                },
                $push: { punches: punchRecord },
              },
              { session, returnDocument: 'after' }
            );
            if (!updated) throw error('SESSION_CHANGED', 'Attendance changed. No biometric action was recorded.');
            attendance = updated;
            result.action = 'checkout';
          }
        } else {
          // No currently open session. Check if member already attended this same session earlier today.
          const sessionRecord = await Attendance.findOne({
            member: member._id,
            attendanceDate: dayBounds.start,
            sessionName: currentSession,
          }).session(session);

          if (sessionRecord) {
            // Member is punching again in the same session -> update checkOutTime with the last incoming punch timestamp
            const duration = Math.max(1, Math.round((now.getTime() - new Date(sessionRecord.checkInTime).getTime()) / 60000));
            punchRecord.punchType = 'checkout';
            const updated = await Attendance.findOneAndUpdate(
              { _id: sessionRecord._id },
              {
                $set: {
                  checkOutTime: now,
                  sessionOpen: false,
                  duration,
                  checkOutVerificationReference: eventId,
                  checkOutWorkstation: station.contextId,
                  checkOutReceptionist: operator,
                  updatedAt: now,
                },
                $push: { punches: punchRecord },
              },
              { session, returnDocument: 'after' }
            );
            if (!updated) throw error('SESSION_CHANGED', 'Attendance changed. No biometric action was recorded.');
            attendance = updated;
            result.action = 'checkout';
            result.updatedCheckout = true;
          } else {
            // First punch of this session today -> Check-in!
            let slotAllocation;
            try { ({ slotAllocation } = await validateAttendanceAccess(member, now, session)); }
            catch (failure) { throw Object.assign(failure, { code: 'MEMBERSHIP_INELIGIBLE' }); }

            punchRecord.punchType = 'checkin';
            [attendance] = await Attendance.create([{
              member: member._id,
              branch: config.gym.branchId,
              attendanceDate: dayBounds.start,
              checkInTime: now,
              checkOutTime: null,
              sessionOpen: true,
              sessionName: currentSession,
              duration: 0,
              punches: [punchRecord],
              verificationReference: eventId,
              checkInWorkstation: station.contextId,
              checkInReceptionist: operator,
              deviceId: 'MFS500',
              slotAllocation: slotAllocation?._id,
            }], { session });
            result.action = 'checkin';
          }
        }

        // Calculate total daily gym spending across all sessions today
        const todayRecords = await Attendance.find({
          member: member._id,
          attendanceDate: dayBounds.start,
        }).session(session);
        const dailySpending = calculateDailySpending(todayRecords);

        result.recorded = true;
        result.attendanceId = String(attendance._id);
        result.sessionName = attendance.sessionName || currentSession;
        result.durationMinutes = attendance.duration || 0;
        result.durationFormatted = formatDuration(attendance.duration || 0);
        result.punchesCount = attendance.punches?.length || 1;
        result.dailySpending = dailySpending;

        const sessionLabel = (attendance.sessionName || currentSession).charAt(0).toUpperCase() +
          (attendance.sessionName || currentSession).slice(1);
        if (result.action === 'checkin') {
          if (result.reconfirmed) {
            result.message = `Check-in already confirmed at ${new Date(attendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${sessionLabel} session)`;
          } else {
            result.message = `Checked in (${sessionLabel} session)`;
          }
        } else {
          result.message = `${result.updatedCheckout ? 'Check-out updated' : 'Check-out recorded'}: ${formatDuration(attendance.duration)} in ${sessionLabel} session (Today's Total: ${dailySpending.totalHoursFormatted})`;
        }

        if (stale) result.staleSession = true;
        await Member.updateOne({ _id: member._id }, { $set: { lastBiometricPunchAt: now } }, { session });
        await Station.updateOne({ _id: station._id }, { $set: { lastRecordedMember: member._id, sameMemberArmed: false } }, { session });
        const counted = await Enrollment.updateOne({ _id: enrollment._id, enrollmentReference: verification.enrollmentReference },
          { $inc: { verificationCount: 1 }, $set: { lastVerificationDate: now } }, { session });
        if (!counted.modifiedCount) throw error('ENROLLMENT_CHANGED', 'Enrollment changed during recording');
      }
    }
    await Verification.updateOne({ _id: verification._id, state: 'verified' }, { $set: { state: 'consumed', result } }, { session });
    await Audit.create([{ user: operator, action: 'biometric_' + result.action, entityType: 'attendance', entityId: member._id,
      changes: { eventId, station: station.contextId, branch: config.gym.branchId, recorded: result.recorded }, timestamp: now }], { session });
    return result;
  }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
}
async function overview() {
  const now = new Date(), cutoff = new Date(now.getTime() - config.biometric.staleHours * 3600000);
  const [count, rows, stale] = await Promise.all([
    Attendance.countDocuments({ sessionOpen: true }),
    Attendance.find().select('member checkInTime checkOutTime').populate('member', 'fullName memberId avatarInitials').sort({ updatedAt: -1 }).limit(20),
    Attendance.find({ sessionOpen: true, checkInTime: { $lte: cutoff } }).select('member checkInTime').populate('member', 'fullName memberId').sort({ checkInTime: 1 }).limit(20),
  ]);
  const events = rows.flatMap(row => [
    { id: row.id + ':in', member: row.member, action: 'checkin', timestamp: row.checkInTime },
    ...(row.checkOutTime ? [{ id: row.id + ':out', member: row.member, action: 'checkout', timestamp: row.checkOutTime }] : []),
  ]).sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  return { currentlyPresent: count, events, staleSessions: stale, ...capabilities() };
}
module.exports = { capabilities, openStation, closeStation, closeOperatorStations, confirmRemoval, issueVerification, identify, record, overview, getCandidates };
