const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getSettings,
  getSetting,
  upsertSetting,
  updateSetting,
  deleteSetting,
  initializeDefaultSettings,
} = require('../controllers/settingController');
const auditLogger = require('../middleware/auditLogger');

router.use(protect, authorize('admin'));
router.post('/initialize', auditLogger('initialize', 'settings'), initializeDefaultSettings);
router.route('/').get(getSettings).post(auditLogger('upsert', 'settings'), upsertSetting);
router.route('/:key').get(getSetting).put(auditLogger('update', 'settings'), updateSetting).delete(auditLogger('delete', 'settings'), deleteSetting);

module.exports = router;
