const MemberProfile = require('../models/MemberProfile');
const User = require('../models/User');
const MemberMembership = require('../models/MemberMembership');
const Payment = require('../models/Payment');
const MemberSlotAllocation = require('../models/MemberSlotAllocation');
const TrainerClientAllocation = require('../models/TrainerClientAllocation');
const Sequence = require('../models/Sequence');

// Generate unique member ID (e.g., GYM0001)
const generateMemberId = async (session) => {
  const options = { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true };
  if (session) options.session = session;
  const sequence = await Sequence.findOneAndUpdate(
    { _id: 'member' },
    { $inc: { value: 1 } },
    options
  );
  return `GYM${String(sequence.value).padStart(4, '0')}`;
};

module.exports = { generateMemberId };
