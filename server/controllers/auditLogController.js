const AuditLog = require('../models/AuditLog');

// @desc    Get all audit logs
// @route   GET /api/audit-logs
// @access  Private (Admin)
exports.getAuditLogs = async (req, res, next) => {
  try {
    const { userId, entityType, action, startDate, endDate } = req.query;
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
    
    let query = {};
    
    if (userId) {
      query.user = userId;
    }
    
    if (entityType) {
      query.entityType = entityType;
    }
    
    if (action) {
      query.action = action;
    }
    
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
        return res.status(400).json({ success: false, error: 'Invalid audit log date range' });
      }
      query.timestamp = {
        $gte: start,
        $lte: end,
      };
    }

    const [logs, count] = await Promise.all([
      AuditLog.find(query)
        .populate('user', 'email role')
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      AuditLog.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: logs.length,
      data: { logs, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single audit log
// @route   GET /api/audit-logs/:id
// @access  Private (Admin)
exports.getAuditLog = async (req, res, next) => {
  try {
    const log = await AuditLog.findById(req.params.id)
      .populate('user', 'email role');

    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Audit log not found',
      });
    }

    res.status(200).json({
      success: true,
      data: log,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create audit log
// @route   POST /api/audit-logs
// @access  Private (used by middleware, not directly)
exports.createAuditLog = async (data) => {
  try {
    const log = await AuditLog.create(data);
    return log;
  } catch (error) {
    console.error('Error creating audit log:', error);
    throw error;
  }
};

// @desc    Get audit log statistics
// @route   GET /api/audit-logs/stats
// @access  Private (Admin)
exports.getAuditLogStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        timestamp: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      };
    }

    const totalLogs = await AuditLog.countDocuments(dateFilter);
    
    const byAction = await AuditLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const byEntityType = await AuditLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$entityType',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const byUser = await AuditLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$user',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]).populate('_id', 'email role');

    res.status(200).json({
      success: true,
      data: {
        totalLogs,
        byAction,
        byEntityType,
        byUser,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete old audit logs
// @route   DELETE /api/audit-logs/cleanup
// @access  Private (Admin)
exports.cleanupOldLogs = async (req, res, next) => {
  try {
    const { daysOld } = req.query;
    const days = Number.parseInt(daysOld, 10) || 365;
    if (days < 30 || days > 3650) {
      return res.status(400).json({ success: false, error: 'daysOld must be between 30 and 3650' });
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await AuditLog.deleteMany({
      timestamp: { $lt: cutoffDate },
    });

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} old audit logs`,
      data: { deletedCount: result.deletedCount },
    });
  } catch (error) {
    next(error);
  }
};
