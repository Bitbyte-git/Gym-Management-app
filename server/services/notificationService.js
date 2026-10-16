const Notification = require('../models/Notification');
const User = require('../models/User');
const config = require('../config/env');

/**
 * Create notification
 * @param {string} recipientId - User ID
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {object} relatedData - Related data (optional)
 * @returns {Promise<Object>} Created notification
 */
const createNotification = async (recipientId, type, title, message, relatedData = {}, deduplicationKey) => {
  try {
    const fields = {
      recipient: recipientId,
      type,
      title,
      message,
      relatedData,
      deliveryStatus: 'sent',
      sentVia: ['in_app'],
    };
    const notification = deduplicationKey
      ? await Notification.findOneAndUpdate({ deduplicationKey }, { $setOnInsert: fields }, { upsert: true, returnDocument: 'after', runValidators: true })
      : await Notification.create(fields);

    // Send via other channels if enabled
    if (config.sms.enabled) {
      await sendSMS(notification);
    }

    if (config.email.enabled) {
      await sendEmail(notification);
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * Send SMS notification (placeholder)
 * @param {Object} notification - Notification object
 */
const sendSMS = async (notification) => {
  notification.deliveryStatus = 'failed';
  notification.deliveryErrors.push({
    channel: 'sms',
    message: 'SMS provider is not integrated; delivery was not attempted.',
  });
  await notification.save();
};

/**
 * Send email notification (placeholder)
 * @param {Object} notification - Notification object
 */
const sendEmail = async (notification) => {
  notification.deliveryStatus = 'failed';
  notification.deliveryErrors.push({
    channel: 'email',
    message: 'Email provider is not integrated; delivery was not attempted.',
  });
  await notification.save();
};

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @returns {Promise<Object>} Updated notification
 */
const markAsRead = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      {
        isRead: true,
        readAt: new Date(),
      },
      { returnDocument: 'after' }
    );

    return notification;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Get user's notifications
 * @param {string} userId - User ID
 * @param {boolean} unreadOnly - Get only unread notifications
 * @returns {Promise<Array>} Notifications
 */
const getUserNotifications = async (userId, unreadOnly = false) => {
  try {
    const query = { recipient: userId };
    if (unreadOnly) {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    return notifications;
  } catch (error) {
    console.error('Error getting user notifications:', error);
    throw error;
  }
};

/**
 * Get unread notification count
 * @param {string} userId - User ID
 * @returns {Promise<number>} Unread count
 */
const getUnreadCount = async (userId) => {
  try {
    const count = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
    });

    return count;
  } catch (error) {
    console.error('Error getting unread count:', error);
    throw error;
  }
};

/**
 * Bulk create notifications for multiple recipients
 * @param {Array} recipientIds - Array of user IDs
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {object} relatedData - Related data (optional)
 * @returns {Promise<Array>} Created notifications
 */
const bulkCreateNotifications = async (recipientIds, type, title, message, relatedData = {}) => {
  try {
    const notifications = await Notification.insertMany(
      recipientIds.map(recipientId => ({
        recipient: recipientId,
        type,
        title,
        message,
        relatedData,
        deliveryStatus: 'sent',
        sentVia: ['in_app'],
      }))
    );

    // Send via other channels if enabled
    if (config.sms.enabled || config.email.enabled) {
      await Promise.all(
        notifications.map(notification => {
          if (config.sms.enabled) sendSMS(notification);
          if (config.email.enabled) sendEmail(notification);
        })
      );
    }

    return notifications;
  } catch (error) {
    console.error('Error creating bulk notifications:', error);
    throw error;
  }
};

/**
 * Delete old notifications
 * @param {number} daysOld - Delete notifications older than this many days
 * @returns {Promise<number>} Number of deleted notifications
 */
const deleteOldNotifications = async (daysOld = 90) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await Notification.deleteMany({
      createdAt: { $lt: cutoffDate },
      isRead: true,
    });

    return result.deletedCount;
  } catch (error) {
    console.error('Error deleting old notifications:', error);
    throw error;
  }
};

module.exports = {
  createNotification,
  sendSMS,
  sendEmail,
  markAsRead,
  getUserNotifications,
  getUnreadCount,
  bulkCreateNotifications,
  deleteOldNotifications,
};
