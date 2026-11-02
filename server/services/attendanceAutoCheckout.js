const MemberAttendance = require('../models/MemberAttendance');
const { calculateAutoCheckout, isSessionExpired } = require('../utils/gymSession');
const config = require('../config/env');

/**
 * Automatically checks out any open attendance record whose session window has ended.
 * Ensures visits do not run continuously when a member forgets to punch out.
 * Clamps the checkout time to the official session end time (e.g. 11:59 for morning, 15:59 for afternoon, 22:00 for evening).
 *
 * @param {Date} now
 * @param {Object} filter Optional filter, e.g. { member: memberId }
 * @param {Object} session Optional mongoose transaction session
 * @returns {Promise<Array>} Array of auto-closed attendance records
 */
async function autoCloseExpiredAttendance(now = new Date(), filter = {}, session = null) {
  const query = { sessionOpen: true, ...filter };
  const findQuery = MemberAttendance.find(query);
  if (session) findQuery.session(session);
  const openRecords = await findQuery;

  const closed = [];

  for (const record of openRecords) {
    if (isSessionExpired(record, now, config.gym.timezone)) {
      const autoData = calculateAutoCheckout(record, now, config.gym.timezone);
      const punchRecord = {
        punchTime: autoData.checkOutTime,
        punchType: 'checkout',
        deviceId: 'AUTO_SESSION_END',
      };

      const updatedNotes = [record.notes, autoData.notes].filter(Boolean).join('\n');

      const updateQuery = MemberAttendance.findOneAndUpdate(
        { _id: record._id, sessionOpen: true },
        {
          $set: {
            checkOutTime: autoData.checkOutTime,
            sessionOpen: false,
            duration: autoData.duration,
            notes: updatedNotes,
            updatedAt: now,
          },
          $push: { punches: punchRecord },
        },
        { returnDocument: 'after' }
      );
      if (session) updateQuery.session(session);
      const updated = await updateQuery;

      if (updated) {
        closed.push(updated);
      }
    }
  }

  return closed;
}

module.exports = { autoCloseExpiredAttendance };
