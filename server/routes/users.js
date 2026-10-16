const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const auditLogger = require('../middleware/auditLogger');
const { getUsers, createStaffUser, updateUserStatus } = require('../controllers/userController');

router.use(protect, authorize('admin'));
router.route('/').get(getUsers).post(auditLogger('create', 'user'), createStaffUser);
router.patch('/:id/status', auditLogger('update_status', 'user'), updateUserStatus);

module.exports = router;
