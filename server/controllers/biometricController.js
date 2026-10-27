const mongoose = require('mongoose');
const MemberProfile = require('../models/MemberProfile');
const BiometricEnrollment = require('../models/BiometricEnrollment');
const service = require('../services/biometricService');
const { fail } = require('../services/biometricValidation');

// This application has one gym database and no tenant model. Staff access is gym-wide.
async function resolveMember(req) {
  const requested = req.body?.memberId ?? req.query.memberId;
  if (requested !== undefined && (typeof requested !== 'string' || !mongoose.isObjectIdOrHexString(requested))) fail('A valid member database ID is required');
  const own = req.user.role === 'member';
  const member = await MemberProfile.findOne(own ? { user: req.user.id } : { _id: requested });
  if (own && requested && String(member?._id) !== requested) fail('You cannot access another member enrollment', 403);
  if (!member) fail('Member profile not found', 404);
  return member;
}
exports.checkDeviceStatus = async (req, res) => res.json({ success: true, data: service.capabilities() });
exports.initializeEnrollment = async (req, res, next) => {
  try { const member = await resolveMember(req); res.json({ success: true, data: await service.initializeCapture(member._id) }); } catch (e) { next(e); }
};
exports.processEnrollment = async (req, res, next) => {
  try {
    const member = await resolveMember(req);
    const data = await service.processEnrollment(member._id, req.body.captureData, {
      fingerPosition: req.body.fingerPosition, operatorId: req.user.id,
      replaceEnrollmentReference: req.body.replaceEnrollmentReference,
    });
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
};
exports.verifyFingerprint = async (req, res, next) => {
  try {
    await resolveMember(req);
    const result = await service.verifyFingerprint();
    res.status(503).json({ success: false, code: result.code, error: result.message });
  } catch (e) { next(e); }
};
exports.getEnrollmentStatus = async (req, res, next) => {
  try {
    const member = await resolveMember(req);
    const enrollment = await BiometricEnrollment.findOne({ member: member._id });
    res.json({ success: true, data: { isEnrolled: enrollment?.isActive === true && enrollment?.enrollmentStatus === 'enrolled', enrollment: service.dto(enrollment) } });
  } catch (e) { next(e); }
};
exports.deleteEnrollment = async (req, res, next) => {
  try { const member = await resolveMember(req); res.json({ success: true, data: await service.deleteEnrollment(member._id) }); } catch (e) { next(e); }
};
exports.getAllEnrollments = async (req, res, next) => {
  try {
    const enrollments = await BiometricEnrollment.find().populate('member', 'memberId fullName').sort({ enrollmentDate: -1 }).limit(500);
    res.json({ success: true, count: enrollments.length, data: enrollments.map(service.dto) });
  } catch (e) { next(e); }
};
