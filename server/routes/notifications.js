const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createNotification,
  bulkCreateNotifications,
  deleteNotification,
  cleanupOldNotifications,
  sendMembershipExpiryReminder,
  sendPaymentDueReminder,
} = require('../controllers/notificationController');

// Specific routes first
router.get('/unread-count', protect, getUnreadCount);
router.put('/read-all', protect, markAllAsRead);
router.post('/bulk', protect, authorize('admin'), bulkCreateNotifications);
router.post('/membership-expiry-reminder', protect, authorize('admin'), sendMembershipExpiryReminder);
router.post('/payment-due-reminder', protect, authorize('admin'), sendPaymentDueReminder);
router.delete('/cleanup', protect, authorize('admin'), cleanupOldNotifications);
router.put('/:id/read', protect, markAsRead);

// Generic routes
router
  .route('/')
  .get(protect, getNotifications)
  .post(protect, authorize('admin'), createNotification);

router.delete('/:id', protect, deleteNotification);

module.exports = router;
