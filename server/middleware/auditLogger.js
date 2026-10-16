const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');

/**
 * Audit logging middleware
 * Automatically logs sensitive operations
 */
const auditLogger = (action, entityType) => {
  return async (req, res, next) => {
    // Store original json
    const originalJson = res.json.bind(res);

    // Override res.json to capture response
    res.json = function (data) {
      // Log after response is sent
      res.on('finish', async () => {
        try {
          if (req.user && (res.statusCode >= 200 && res.statusCode < 300)) {
            await AuditLog.create({
              user: req.user.id,
              action,
              entityType,
              entityId: [
                req.params.id,
                req.params.allocationId,
                req.body._id,
                data?.data?._id,
                req.body.memberId,
              ]
                .find((id) => id && mongoose.Types.ObjectId.isValid(id)),
              changes: {
                method: req.method,
                path: req.path,
                submittedFields: Object.keys(req.body || {}),
                params: req.params,
              },
              ipAddress: req.ip || req.connection.remoteAddress,
              userAgent: req.get('user-agent'),
            });
          }
        } catch (error) {
          console.error('Error creating audit log:', error);
        }
      });

      // Call original json
      return originalJson(data);
    };

    next();
  };
};

module.exports = auditLogger;
