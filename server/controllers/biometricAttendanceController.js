const service = require('../services/biometricAttendanceService');
const run = (keys, action) => async (req, res, next) => {
  try {
    if (keys && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).some(key => !keys.includes(key)))) {
      return res.status(400).json({ success: false, code: 'INVALID_REQUEST', error: 'Unexpected biometric attendance fields' });
    }
    const data = await action(req);
    res.set('Cache-Control', 'no-store').json({ success: true, data });
  } catch (error) {
    if (error.code === 20 || /Transaction numbers are only allowed/.test(error.message)) {
      return res.status(503).json({ success: false, code: 'TRANSACTIONS_REQUIRED', error: 'Biometric attendance requires a MongoDB replica set. No attendance was confirmed.' });
    }
    if (typeof error.code === 'string' && error.statusCode) return res.status(error.statusCode).json({ success: false, code: error.code, error: error.message });
    next(error);
  }
};
exports.capabilities = run(null, () => service.capabilities());
exports.overview = run(null, () => service.overview());
exports.candidates = run(null, req => service.getCandidates(req.user.id));
exports.open = run([], req => service.openStation(req.user.id));
exports.close = run(['stationToken'], req => service.closeStation(req.body.stationToken, req.user.id).then(() => ({ paused: true })));
exports.rearm = run(['stationToken'], req => service.confirmRemoval(req.body.stationToken, req.user.id));
exports.challenge = run(['stationToken'], req => service.issueVerification(req.body.stationToken, req.user.id));
exports.identify = run(['stationToken', 'verificationToken', 'probeTemplate', 'templateFormat', 'matchedMemberId', 'matchedEnrollmentReference', 'diagnostics'], req => service.identify(req.body, req.user.id));
exports.record = run(['stationToken', 'verificationToken', 'eventId'], req => service.record(req.body, req.user.id));
