const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAuditLogs,
  getAuditLog,
  getAuditLogStats,
  cleanupOldLogs,
} = require('../controllers/auditLogController');

router.use(protect, authorize('admin'));
router.get('/stats', getAuditLogStats);
router.delete('/cleanup', cleanupOldLogs);
router.get('/', getAuditLogs);
router.get('/:id', getAuditLog);

module.exports = router;
