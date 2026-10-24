const mongoose = require('mongoose');
const path = require('path');
const User = require('./models/User');
const TrainerProfile = require('./models/TrainerProfile');
const MembershipPlan = require('./models/MembershipPlan');
const GymTimeSlot = require('./models/GymTimeSlot');
const GymOperatingHours = require('./models/GymOperatingHours');
const TrainerAvailability = require('./models/TrainerAvailability');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const DEFAULT_ACCOUNTS = [
  { email: 'admin@pulsefit.com', password: 'admin123', role: 'admin' },
  { email: 'reception@pulsefit.com', password: 'reception123', role: 'reception' },
  { email: 'member@pulsefit.com', password: 'member123', role: 'member' },
  { email: 'trainer@pulsefit.com', password: 'trainer123', role: 'trainer' },
];

const PLANS = [
  {
    name: 'Basic',
    description: 'Perfect for beginners starting their fitness journey',
    duration: 1,
    price: 999,
    facilities: ['Gym access', 'Basic equipment', 'Locker room'],
    eligibilityRules: 'Open to all members',
    status: 'active',
  },
  {
    name: 'Standard',
    description: 'Best value for regular gym-goers',
    duration: 3,
    price: 2499,
    facilities: ['Gym access', 'All equipment', 'Locker room', 'Group classes'],
    eligibilityRules: 'Open to all members',
    status: 'active',
  },
  {
    name: 'Premium',
    description: 'For serious fitness enthusiasts',
    duration: 6,
    price: 4499,
    facilities: ['Gym access', 'All equipment', 'Locker room', 'Group classes', 'Personal trainer consultation'],
    eligibilityRules: 'Open to all members',
    status: 'active',
  },
  {
    name: 'Annual',
    description: 'Best value for committed members',
    duration: 12,
    price: 7999,
    facilities: ['All Premium facilities', 'Nutrition consultation', 'Priority booking'],
    eligibilityRules: 'Open to all members',
    status: 'active',
  },
];

const SLOTS = [
  { name: 'Morning Early', startTime: '05:00', endTime: '07:00', maxCapacity: 30 },
  { name: 'Morning Regular', startTime: '07:00', endTime: '10:00', maxCapacity: 50 },
  { name: 'Mid-Morning', startTime: '10:00', endTime: '13:00', maxCapacity: 40 },
  { name: 'Afternoon', startTime: '14:00', endTime: '17:00', maxCapacity: 40 },
  { name: 'Evening Early', startTime: '17:00', endTime: '19:00', maxCapacity: 50 },
  { name: 'Evening Late', startTime: '19:00', endTime: '22:00', maxCapacity: 40 },
];

const seedDatabase = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The development seed script cannot run in production');
  }

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pulsefit-gym');
  try {
    const seededUsers = {};
    for (const account of DEFAULT_ACCOUNTS) {
      let user = await User.findOne({ email: account.email });
      if (!user) {
        user = await User.create(account);
        console.log(`Created development ${account.role} account: ${user.email}`);
      } else {
        console.log(`Preserved existing ${account.role} account: ${user.email}`);
      }
      seededUsers[account.role] = user;
    }

    const trainerUser = seededUsers.trainer;
    let trainerProfile = await TrainerProfile.findOne({ user: trainerUser._id });
    const profileFields = {
      trainerId: 'TR001',
      fullName: 'Kabir Singh',
      gender: 'male',
      mobileNumber: '9000000001',
      email: trainerUser.email,
      specialization: 'Strength & Conditioning',
      experience: 8,
      certifications: ['NASM-CPT', 'ACE'],
      workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      convenientTimings: ['morning', 'afternoon', 'evening'],
      status: 'active',
    };
    if (!trainerProfile) {
      trainerProfile = await TrainerProfile.create({ user: trainerUser._id, ...profileFields });
    } else {
      Object.assign(trainerProfile, profileFields);
      await trainerProfile.save();
    }
    if (!await TrainerAvailability.exists({ trainer: trainerProfile._id })) {
      for (const dayOfWeek of trainerProfile.workingDays) {
        await TrainerAvailability.create({
          trainer: trainerProfile._id,
          dayOfWeek,
          startTime: '05:00',
          endTime: '22:00',
          maxClients: 10,
        });
      }
    }

    for (const plan of PLANS) {
      await MembershipPlan.findOneAndUpdate(
        { name: plan.name },
        { $set: plan },
        { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
      );
    }

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const dayOfWeek of days) {
      for (const slot of SLOTS) {
        if (dayOfWeek === 'sunday' && (slot.startTime < '08:00' || slot.endTime > '20:00')) continue;
        await GymTimeSlot.findOneAndUpdate(
          { name: slot.name, dayOfWeek },
          {
            $set: {
              ...slot,
              dayOfWeek,
              eligiblePlans: [],
              status: 'active',
            },
            $setOnInsert: { currentCapacity: 0 },
          },
          { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
        );
      }

      const isSunday = dayOfWeek === 'sunday';
      await GymOperatingHours.findOneAndUpdate(
        { dayOfWeek },
        {
          $set: {
            dayOfWeek,
            isOpen: true,
            openTime: isSunday ? '08:00' : '05:00',
            closeTime: isSunday ? '20:00' : '22:00',
            sessions: [
              { name: 'Morning', startTime: isSunday ? '08:00' : '05:00', endTime: '13:00' },
              { name: 'Evening', startTime: '14:00', endTime: isSunday ? '20:00' : '22:00' },
            ],
          },
        },
        { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
      );
    }

    const MemberProfile = require('./models/MemberProfile');
    const MemberMembership = require('./models/MemberMembership');
    const MemberSlotAllocation = require('./models/MemberSlotAllocation');
    const Payment = require('./models/Payment');
    const { generateMemberId } = require('./services/memberService');
    const { addMonthsClamped } = require('./utils/date');
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if (await MemberProfile.exists({ user: seededUsers.member._id }).session(session)) return;
        const [member] = await MemberProfile.create([{ user: seededUsers.member._id,
          memberId: await generateMemberId(session), fullName: 'Demo Member', dateOfBirth: new Date('1995-01-15'),
          gender: 'other', mobileNumber: '9000000002', emergencyContactName: 'Demo Contact', emergencyContactPhone: '9000000003',
          height: 170, weight: 70, fitnessGoal: 'general_fitness', registrationStatus: 'active', membershipStatus: 'active',
        }], { session });
        const plan = await MembershipPlan.findOne({ name: 'Basic' }).session(session);
        const slot = await GymTimeSlot.findOneAndUpdate({ dayOfWeek: 'monday', name: 'Morning Regular',
          $expr: { $lt: ['$currentCapacity', '$maxCapacity'] } }, { $inc: { currentCapacity: 1 } }, { returnDocument: 'after', session });
        if (!slot) throw new Error('Demo slot is full');
        const startDate = new Date(); const endDate = addMonthsClamped(startDate, plan.duration);
        const [membership] = await MemberMembership.create([{ member: member._id, membershipPlan: plan._id,
          startDate, endDate, status: 'active', paymentStatus: 'paid', totalAmount: plan.price, amountPaid: plan.price,
          pendingAmount: 0, requestedSlot: slot._id }], { session });
        await MemberSlotAllocation.create([{ member: member._id, membership: membership._id, timeSlot: slot._id,
          startDate, endDate }], { session });
        await Payment.create([{ member: member._id, membership: membership._id, transactionId: `DEMO-${member.memberId}`,
          amount: plan.price, paymentMethod: 'cash', paymentStatus: 'completed', action: 'new_membership', notes: 'Development demo receipt' }], { session });
      });
    } finally { await session.endSession(); }
    console.log('Development data seeded. Change default passwords before using these accounts beyond local development.');
  } finally {
    await mongoose.disconnect();
  }
};

seedDatabase().catch((error) => {
  console.error(`Database seeding failed: ${error.message}`);
  process.exitCode = 1;
});
