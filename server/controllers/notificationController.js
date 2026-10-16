const {
  createNotification,
  markAsRead,
  getUserNotifications,
  getUnreadCount,
  bulkCreateNotifications,
  deleteOldNotifications,
} = require('../services/notificationService');

// @desc    Get user's notifications
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res, next) => {
  try {
    const { unread } = req.query;
    const unreadOnly = unread === 'true';

    const notifications = await getUserNotifications(req.user.id, unreadOnly);

    res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await getUnreadCount(req.user.id);

    res.status(200).json({
      success: true,
      data: { count },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res, next) => {
  try {
    const notification = await markAsRead(req.params.id, req.user.id);

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
exports.markAllAsRead = async (req, res, next) => {
  try {
    const Notification = require('../models/Notification');
    
    await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create notification (admin only)
// @route   POST /api/notifications
// @access  Private (Admin)
exports.createNotification = async (req, res, next) => {
  try {
    const { recipientId, type, title, message, relatedData } = req.body;

    if (!recipientId || !type || !title || !message) {
      return res.status(400).json({
        success: false,
        error: 'recipientId, type, title, and message are required',
      });
    }

    const notification = await createNotification(
      recipientId,
      type,
      title,
      message,
      relatedData
    );

    res.status(201).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk create notifications (admin only)
// @route   POST /api/notifications/bulk
// @access  Private (Admin)
exports.bulkCreateNotifications = async (req, res, next) => {
  try {
    const { recipientIds, type, title, message, relatedData } = req.body;

    if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'recipientIds array is required',
      });
    }

    if (!type || !title || !message) {
      return res.status(400).json({
        success: false,
        error: 'type, title, and message are required',
      });
    }

    const notifications = await bulkCreateNotifications(
      recipientIds,
      type,
      title,
      message,
      relatedData
    );

    res.status(201).json({
      success: true,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
exports.deleteNotification = async (req, res, next) => {
  try {
    const Notification = require('../models/Notification');
    
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete old notifications (admin only)
// @route   DELETE /api/notifications/cleanup
// @access  Private (Admin)
exports.cleanupOldNotifications = async (req, res, next) => {
  try {
    const { daysOld } = req.query;
    const days = parseInt(daysOld) || 90;

    const deletedCount = await deleteOldNotifications(days);

    res.status(200).json({
      success: true,
      message: `Deleted ${deletedCount} old notifications`,
      data: { deletedCount },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send membership expiry reminder
// @route   POST /api/notifications/membership-expiry-reminder
// @access  Private (Admin)
exports.sendMembershipExpiryReminder = async (req, res, next) => {
  try {
    const { daysBeforeExpiry } = req.body;
    const days = parseInt(daysBeforeExpiry) || 7;

    const MemberMembership = require('../models/MemberMembership');
    const MemberProfile = require('../models/MemberProfile');
    const User = require('../models/User');

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + days);

    const expiringMemberships = await MemberMembership.find({
      status: 'active',
      endDate: { $gte: new Date(), $lte: thresholdDate },
    }).populate('member');

    const notifications = [];
    
    for (const membership of expiringMemberships) {
      const member = membership.member;
      const user = member && await User.findOne({ _id: member.user });
      
      if (user) {
        const notification = await createNotification(
          user._id,
          'membership_expiry',
          'Membership Expiring Soon',
          `Your membership will expire on ${new Date(membership.endDate).toLocaleDateString()}. Please renew to continue enjoying our services.`,
          { membershipId: membership._id, expiryDate: membership.endDate },
          `expiry-${membership._id}-${membership.endDate.toISOString().slice(0, 10)}-${new Date().toISOString().slice(0, 10)}`
        );
        notifications.push(notification);
      }
    }

    res.status(200).json({
      success: true,
      message: `Sent ${notifications.length} membership expiry reminders`,
      count: notifications.length,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send payment due reminder
// @route   POST /api/notifications/payment-due-reminder
// @access  Private (Admin)
exports.sendPaymentDueReminder = async (req, res, next) => {
  try {
    const MemberMembership = require('../models/MemberMembership');
    const MemberProfile = require('../models/MemberProfile');
    const User = require('../models/User');

    const pendingMemberships = await MemberMembership.find({
      paymentStatus: { $in: ['pending', 'partial', 'overdue'] },
      status: { $ne: 'cancelled' },
    }).populate('member');

    const notifications = [];
    
    for (const membership of pendingMemberships) {
      const member = membership.member;
      const user = member && await User.findOne({ _id: member.user });
      
      if (user) {
        const notification = await createNotification(
          user._id,
          'payment_due',
          'Payment Due',
          `You have a pending payment of ₹${membership.pendingAmount}. Please complete your payment to avoid service interruption.`,
          { membershipId: membership._id, pendingAmount: membership.pendingAmount },
          `dues-${membership._id}-${new Date().toISOString().slice(0, 10)}`
        );
        notifications.push(notification);
      }
    }

    res.status(200).json({
      success: true,
      message: `Sent ${notifications.length} payment due reminders`,
      count: notifications.length,
    });
  } catch (error) {
    next(error);
  }
};
