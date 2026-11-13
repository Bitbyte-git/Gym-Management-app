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
  { email: 'kiosk@pulsefit.com', password: 'kiosk123', role: 'kiosk' },
  { email: 'member@pulsefit.com', password: 'member123', role: 'member' },
  { email: 'trainer@pulsefit.com', password: 'trainer123', role: 'trainer' },
];

const PLANS = [
  // Vino Fitness Studio - Weight Training
  {
    name: 'Weight Training - Monthly',
    description: '1 Month pure strength & hypertrophy training',
    duration: 1,
    price: 800,
    facilities: ['Weight training floor', 'Free weights & dumbbells', 'Plate-loaded machines', 'Locker room & showers', 'Biometric kiosk check-in'],
    eligibilityRules: 'Open to all members. Admission fee ₹500 applicable.',
    status: 'active',
  },
  {
    name: 'Weight Training - Quarterly',
    description: '3 Months progressive muscle building (Save ₹400)',
    duration: 3,
    price: 2000,
    facilities: ['Weight training floor', 'Olympic barbells & dumbbells', 'Plate-loaded machines', 'Locker room & showers', 'Biometric kiosk check-in'],
    eligibilityRules: 'Open to all members. Admission fee ₹500 applicable.',
    status: 'active',
  },
  {
    name: 'Weight Training - Half-Yearly',
    description: '6 Months physique transformation (Save ₹1,300)',
    duration: 6,
    price: 3500,
    facilities: ['All Weight training equipment', 'Locker & shower access', '15-day membership freeze option', 'Biometric kiosk check-in'],
    eligibilityRules: 'Open to all members. Admission fee ₹500 applicable.',
    status: 'active',
  },
  {
    name: 'Weight Training - Yearly',
    description: '12 Months full access (Best Value: ₹500/mo, Save ₹3,600)',
    duration: 12,
    price: 6000,
    facilities: ['All Weight training equipment', 'Full 365 days access', '30-day membership freeze option', 'Locker & shower access'],
    eligibilityRules: 'Open to all members. Admission fee ₹500 applicable.',
    status: 'active',
  },

  // Vino Fitness Studio - Cardio & Weight Training
  {
    name: 'Cardio & Weight Training - Monthly',
    description: '1 Month complete conditioning & muscle building',
    duration: 1,
    price: 1500,
    facilities: ['Cardio machines (treadmills, spin bikes)', 'Full weight training floor', 'Locker room & showers', 'Biometric kiosk check-in'],
    eligibilityRules: 'Open to all members. Admission fee ₹500 applicable.',
    status: 'active',
  },
  {
    name: 'Cardio & Weight Training - Quarterly',
    description: '3 Months fat-loss & toning (Save ₹1,000)',
    duration: 3,
    price: 3500,
    facilities: ['Cardio equipment + Weight floor', 'Continuous endurance coaching', 'Locker & shower access', 'Biometric kiosk check-in'],
    eligibilityRules: 'Open to all members. Admission fee ₹500 applicable.',
    status: 'active',
  },
  {
    name: 'Cardio & Weight Training - Half-Yearly',
    description: '6 Months stamina & physique results (Save ₹3,500)',
    duration: 6,
    price: 5500,
    facilities: ['All cardio machinery & weights', '15-day membership freeze', 'Locker & shower access', 'Biometric kiosk check-in'],
    eligibilityRules: 'Open to all members. Admission fee ₹500 applicable.',
    status: 'active',
  },
  {
    name: 'Cardio & Weight Training - Yearly',
    description: '12 Months unlimited cardio & weights (Save ₹10,500, ₹625/mo)',
    duration: 12,
    price: 7500,
    facilities: ['Full 365 days unlimited Cardio & Weights', '30-day membership freeze', 'Locker room & private shower', 'Biometric pass'],
    eligibilityRules: 'Open to all members. Admission fee ₹500 applicable.',
    status: 'active',
  },

  // Vino Fitness Studio - 1-on-1 Personal Training
  {
    name: 'Personal Training - 16 Classes',
    description: '16 Dedicated 1-on-1 coaching sessions (30 Days Maximum Validity)',
    duration: 1,
    price: 4000,
    facilities: ['Dedicated certified trainer', 'Customized workout routine', 'Form assessment & injury prevention', 'Nutrition advice'],
    eligibilityRules: 'Valid for 30 days maximum. Admission fees non-refundable.',
    status: 'active',
  },

  // Legacy fallback
  {
    name: 'Basic',
    description: 'Perfect for beginners starting their fitness journey',
    duration: 1,
    price: 800,
    facilities: ['Gym access', 'Basic equipment', 'Locker room'],
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
