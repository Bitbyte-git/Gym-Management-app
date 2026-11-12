const { randomUUID, createHash } = require('node:crypto');
const BiometricEnrollment = require('../models/BiometricEnrollment');
const MemberProfile = require('../models/MemberProfile');
const config = require('../config/env');
const engine = require('./identificationEngine');
const localIdentifier = require('./localMorFinIdentifier');
const { encrypt, decrypt, keyFor } = require('./biometricCrypto');
const { validateCapture, fail } = require('./biometricValidation');

const matcherMessage = 'Biometric attendance is unavailable: a documented backend matcher or authenticated trusted local agent is required. Browser match results are not accepted.';
const dto = e => e ? ({
  _id: e._id, member: e.member, enrollmentReference: e.enrollmentReference,
  fingerPosition: e.fingerPosition, enrollmentStatus: e.enrollmentStatus,
  isActive: e.isActive, enrollmentDate: e.enrollmentDate,
  lastVerificationDate: e.lastVerificationDate, verificationCount: e.verificationCount,
  deviceModel: e.deviceModel, deviceSerial: e.deviceSerial,
  templateFormat: e.templateFormat, imageFormat: e.imageFormat,
  quality: e.quality, nfiq: e.nfiq, schemaVersion: e.schemaVersion,
}) : null;

// Device discovery belongs to the capture workstation's browser, never backend localhost.
const capabilities = () => {
  let enrollmentStorage = false;
  try { keyFor(config.biometric.keyVersion); enrollmentStorage = true; } catch {}
  return { deviceType: 'Mantra MFS500', deviceAvailable: null, captureLocation: 'browser',
    enrollmentStorage, retainImages: config.biometric.retainImages,
    verificationAvailable: engine.available(), identificationAvailable: engine.available(),
    message: engine.available() ? 'Local development matching is available in the staff attendance screen.' : engine.status().reason };
};
const checkMorFinAuthAvailability = async () => capabilities();
const initializeCapture = async memberId => {
  if (!await MemberProfile.exists({ _id: memberId })) fail('Member not found', 404);
  if (!capabilities().enrollmentStorage) fail('Backend biometric encryption keys are not configured', 503);
  const existing = await BiometricEnrollment.findOne({ member: memberId });
  return { ...capabilities(), existingEnrollment: dto(existing) };
};
async function assertNoDuplicateFingerprint(memberId, template, templateHash) {
  const hashDuplicate = await BiometricEnrollment.findOne({
    member: { $ne: memberId },
    isActive: true,
    enrollmentStatus: 'enrolled',
    templateHash,
  }).populate('member', 'fullName memberId');
  if (hashDuplicate) {
    const owner = hashDuplicate.member;
    const ownerLabel = owner ? `${owner.fullName} (${owner.memberId})` : 'another member';
    fail(`Duplicate fingerprint detected: this fingerprint is already enrolled for ${ownerLabel}.`, 409);
  }

  if (localIdentifier.available()) {
    const others = await BiometricEnrollment.find({
      member: { $ne: memberId },
      isActive: true,
      enrollmentStatus: 'enrolled',
      schemaVersion: 2,
      templateFormat: 'FMR_V2005',
    })
      .select('member enrollmentReference +encryptedTemplate')
      .populate('member', 'fullName memberId')
      .limit(config.biometric.searchMaxCandidates)
      .lean();

    const probeBase64 = template.toString('base64');
    for (const row of others) {
      if (!row.encryptedTemplate || !row.member?._id) continue;
      let gallery;
      try {
        gallery = decrypt(row.encryptedTemplate, String(row.member._id) + ':' + row.enrollmentReference + ':template');
        const result = await localIdentifier.postVendor(
          config.biometric,
          'verify',
          { ProbTemplate: probeBase64, GalleryTemplate: gallery.toString('base64'), TmpFormat: 0 },
          2000
        );
        if (result?.Status === true) {
          fail(`Duplicate fingerprint detected: this fingerprint is already enrolled for ${row.member.fullName} (${row.member.memberId}).`, 409);
        }
      } catch (err) {
        if (err.statusCode === 409) throw err;
        // Ignore transient local matcher errors on individual rows so browser-level check still protects cloud/workstation flows
      } finally {
        gallery?.fill(0);
      }
    }
  }
}

async function processEnrollment(memberId, captureData, { fingerPosition, operatorId, replaceEnrollmentReference } = {}) {
  const { template, image, deviceSerial } = validateCapture(captureData, fingerPosition);
  try {
    if (!await MemberProfile.exists({ _id: memberId })) fail('Member not found', 404);
    if (!capabilities().enrollmentStorage) fail('Backend biometric encryption keys are not configured', 503);
    const templateHash = createHash('sha256').update(template).digest('hex');
    await assertNoDuplicateFingerprint(memberId, template, templateHash);
    const reference = randomUUID();
    const context = String(memberId) + ':' + reference;
    const values = {
      member: memberId, enrollmentReference: reference, deviceId: deviceSerial,
      encryptedTemplate: encrypt(template, context + ':template'),
      templateHash,
      fingerPosition, templateFormat: captureData.templateFormat,
      quality: captureData.quality, nfiq: captureData.nfiq,
      deviceModel: captureData.deviceModel, deviceSerial,
      imageWidth: captureData.imageWidth, imageHeight: captureData.imageHeight,
      capturedAt: new Date(captureData.capturedAt), enrolledBy: operatorId,
      enrollmentDate: new Date(), enrollmentStatus: 'enrolled', isActive: true,
      verificationCount: 0, schemaVersion: 2,
    };
    if (image && config.biometric.retainImages) {
      values.encryptedImage = encrypt(image, context + ':image');
      values.imageFormat = captureData.imageFormat;
    }
    let enrollment;
    if (replaceEnrollmentReference !== undefined) {
      if (typeof replaceEnrollmentReference !== 'string' || !replaceEnrollmentReference) fail('The existing enrollment reference is required for replacement');
      enrollment = await BiometricEnrollment.findOneAndUpdate(
        { member: memberId, enrollmentReference: replaceEnrollmentReference },
        { $set: values, $unset: { enrollmentData: 1, ...(!values.encryptedImage ? { encryptedImage: 1, imageFormat: 1 } : {}), lastVerificationDate: 1 }, $inc: { revision: 1 } },
        { returnDocument: 'after', runValidators: true });
      if (!enrollment) fail('Enrollment changed; reload before replacing it', 409);
    } else {
      if (await BiometricEnrollment.exists({ member: memberId })) fail('Member already has an enrollment; explicitly replace the current reference', 409);
      enrollment = await BiometricEnrollment.create(values);
    }
    return dto(enrollment);
  } finally { template.fill(0); image?.fill(0); }
}
// No matcher credentials, thresholds, endpoints or success path are invented.
const verifyFingerprint = async () => ({ success: false, unavailable: true, code: 'MATCHER_UNAVAILABLE', message: matcherMessage });
async function getMemberByEnrollment(enrollmentReference) {
  const enrollment = await BiometricEnrollment.findOne({ enrollmentReference, enrollmentStatus: 'enrolled', isActive: true }).populate('member');
  if (!enrollment?.member) fail('No active enrollment found', 404);
  return enrollment.member; // Lookup is not verification.
}
async function deleteEnrollment(memberId) {
  const enrollment = await BiometricEnrollment.findOneAndDelete({ member: memberId });
  if (!enrollment) fail('No enrollment found for this member', 404);
  return { success: true, message: 'Enrollment and retained biometric material deleted' };
}
module.exports = { capabilities, dto, checkMorFinAuthAvailability,
  initializeCapture, processEnrollment, verifyFingerprint, getMemberByEnrollment, deleteEnrollment };
