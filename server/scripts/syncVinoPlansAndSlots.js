const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MembershipPlan = require('../models/MembershipPlan');
const GymTimeSlot = require('../models/GymTimeSlot');
const GymOperatingHours = require('../models/GymOperatingHours');

const OFFICIAL_PLANS = [
  // 1. Weight Training
  {
    name: 'Weight Training - Monthly',
    description: '1 Month pure strength & hypertrophy training',
    duration: 1,
    price: 800,
    facilities: [
      'Full weight training floor access',
      'Free weights, Olympic barbells & dumbbells',
      'Plate-loaded machines & cable crossover bays',
      'Locker room & private rain showers',
      'Biometric touchless kiosk check-in'
    ],
    eligibilityRules: 'Open to all members. Admission fee ₹500 applicable.',
    status: 'active',
  },
  {
    name: 'Weight Training - Quarterly',
    description: '3 Months progressive muscle building (Save ₹400)',
    duration: 3,
    price: 2000,
    facilities: [
      'Full weight training floor access',
      'Continuous 90-day progressive overload',
      'Free weights, cables & squat cages',
      'Locker room & shower access included',
      'Biometric check-in & attendance history'
    ],
    eligibilityRules: 'Open to all members. Admission fee ₹500 applicable.',
    status: 'active',
  },
  {
    name: 'Weight Training - Half-Yearly',
    description: '6 Months physique transformation (Save ₹1,300)',
    duration: 6,
    price: 3500,
    facilities: [
      'All Weight Training equipment & zones',
      'Long-term strength & physique progress',
      '1 Complimentary 15-day membership freeze',
      'Locker room & private shower access',
      'Biometric check-in & app dashboard'
    ],
    eligibilityRules: 'Open to all members. Admission fee ₹500 applicable.',
    status: 'active',
  },
  {
    name: 'Weight Training - Yearly',
    description: '12 Months full access (Best Value: ₹500/mo, Save ₹3,600)',
    duration: 12,
    price: 6000,
    facilities: [
      'Full 365 days of weight training access',
      'Unbeatable lowest monthly rate (₹500/month)',
      'All Olympic barbells, dumbbells & machines',
      '1 Complimentary 30-day membership freeze',
      'Priority renewal privilege at locked rate'
    ],
    eligibilityRules: 'Open to all members. Admission fee ₹500 applicable.',
    status: 'active',
  },

  // 2. Cardio & Weight Training
  {
    name: 'Cardio & Weight Training - Monthly',
    description: '1 Month complete conditioning & muscle building',
    duration: 1,
    price: 1500,
    facilities: [
      'Full Cardio deck + Weight training floor',
      'Treadmills, cross-trainers & spin bikes',
      'Free weights, dumbbells & cable bays',
      'Fat-loss & endurance conditioning',
      'Locker room & private rain showers',
      'Biometric fingerprint pass'
    ],
    eligibilityRules: 'Open to all members. Admission fee ₹500 applicable.',
    status: 'active',
  },
  {
    name: 'Cardio & Weight Training - Quarterly',
    description: '3 Months fat-loss & toning (Save ₹1,000)',
    duration: 3,
    price: 3500,
    facilities: [
      'Full access to all Cardio & Weight equipment',
      'Structured cardio interval pacing',
      'Barbells, dumbbells, cables & squat racks',
      'Locker room & private shower access',
      'Biometric check-in at entrance'
    ],
    eligibilityRules: 'Open to all members. Admission fee ₹500 applicable.',
    status: 'active',
  },
  {
    name: 'Cardio & Weight Training - Half-Yearly',
    description: '6 Months stamina & physique results (Save ₹3,500)',
    duration: 6,
    price: 5500,
    facilities: [
      'Comprehensive Cardio + Strength floor access',
      '1 Complimentary 15-day membership freeze',
      'All cardio machinery, weights & functional gear',
      'Locker room & private shower access',
      'Biometric attendance & session statistics'
    ],
    eligibilityRules: 'Open to all members. Admission fee ₹500 applicable.',
    status: 'active',
  },
  {
    name: 'Cardio & Weight Training - Yearly',
    description: '12 Months unlimited cardio & weights (Save ₹10,500, ₹625/mo)',
    duration: 12,
    price: 7500,
    facilities: [
      'Full 365 days unlimited Cardio & Weights',
      'Massive savings — under ₹21 per day!',
      'All cardio machinery, Olympic weights & cables',
      '1 Complimentary 30-day membership freeze',
      'Locker room & shower access included',
      'Biometric pass & all studio amenities'
    ],
    eligibilityRules: 'Open to all members. Admission fee ₹500 applicable.',
    status: 'active',
  },

  // 3. 1-on-1 Personal Training
  {
    name: 'Personal Training - 16 Classes',
    description: '16 Dedicated 1-on-1 coaching sessions (30 Days Maximum Validity)',
    duration: 1,
    price: 4000,
    facilities: [
      'Dedicated certified personal trainer',
      '16 One-on-one sessions (30 days maximum validity)',
      'Customized progressive overload workout split',
      'Biomechanical form correction & injury prevention',
      'Targeted nutrition & dietary guidance',
      'Body composition progression tracking'
    ],
    eligibilityRules: 'Valid for 30 days maximum. Admission fees non-refundable.',
    status: 'active',
  },
];

const WEEKDAY_SLOTS = [
  { name: 'Morning Early', startTime: '05:00', endTime: '07:00', maxCapacity: 30 },
  { name: 'Morning Regular', startTime: '07:00', endTime: '10:00', maxCapacity: 50 },
  { name: 'Evening Early', startTime: '17:00', endTime: '19:00', maxCapacity: 50 },
  { name: 'Evening Power', startTime: '19:00', endTime: '21:00', maxCapacity: 40 },
];

const SUNDAY_SLOTS = [
  { name: 'Sunday Morning', startTime: '06:00', endTime: '10:00', maxCapacity: 50 },
];

async function sync() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('Connected!');

  // 1. Deactivate obsolete dummy plans so they no longer appear on active lists
  const legacyPlanNames = ['Basic', 'Standard', 'Premium', 'Annual'];
  const deactRes = await MembershipPlan.updateMany(
    { name: { $in: legacyPlanNames } },
    { $set: { status: 'inactive' } }
  );
  console.log(`Deactivated ${deactRes.modifiedCount} legacy plans (${legacyPlanNames.join(', ')})`);

  // 2. Upsert official Vino Fitness Studio plans
  for (const plan of OFFICIAL_PLANS) {
    const updated = await MembershipPlan.findOneAndUpdate(
      { name: plan.name },
      { $set: { ...plan, status: 'active' } },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
    );
    console.log(`Synced Plan: ${updated.name} | ₹${updated.price} | ${updated.duration}m | Status: ${updated.status}`);
  }

  // 3. Sync Gym Time Slots
  // Deactivate all existing slots during break (10:00 to 17:00) or past 21:00
  const deactSlots = await GymTimeSlot.updateMany(
    {
      $or: [
        { startTime: { $gte: '10:00', $lt: '17:00' } },
        { endTime: { $gt: '21:00' } },
        { name: { $in: ['Mid-Morning', 'Afternoon', 'Evening Late'] } }
      ]
    },
    { $set: { status: 'inactive' } }
  );
  console.log(`Deactivated ${deactSlots.modifiedCount} obsolete/break time slots`);

  // Deactivate any Sunday evening slots
  await GymTimeSlot.updateMany(
    { dayOfWeek: 'sunday', startTime: { $gte: '12:00' } },
    { $set: { status: 'inactive' } }
  );

  // Upsert active weekday slots (Monday to Saturday)
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (const dayOfWeek of weekdays) {
    for (const slot of WEEKDAY_SLOTS) {
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
  }
  console.log('Synced Monday to Saturday 4 active batches: Morning Early (5-7), Morning Regular (7-10), Evening Early (17-19), Evening Power (19-21)');

  // Upsert Sunday slots
  for (const slot of SUNDAY_SLOTS) {
    await GymTimeSlot.findOneAndUpdate(
      { name: slot.name, dayOfWeek: 'sunday' },
      {
        $set: {
          ...slot,
          dayOfWeek: 'sunday',
          eligiblePlans: [],
          status: 'active',
        },
        $setOnInsert: { currentCapacity: 0 },
      },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
    );
  }
  console.log('Synced Sunday active batch: Sunday Morning (6-10 AM)');

  // 4. Sync GymOperatingHours
  for (const dayOfWeek of weekdays) {
    await GymOperatingHours.findOneAndUpdate(
      { dayOfWeek },
      {
        $set: {
          dayOfWeek,
          isOpen: true,
          openTime: '05:00',
          closeTime: '21:00',
          sessions: [
            { name: 'Morning Class', startTime: '05:00', endTime: '10:00' },
            { name: 'Evening Class', startTime: '17:00', endTime: '21:00' },
          ],
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
    );
  }

  await GymOperatingHours.findOneAndUpdate(
    { dayOfWeek: 'sunday' },
    {
      $set: {
        dayOfWeek: 'sunday',
        isOpen: true,
        openTime: '06:00',
        closeTime: '10:00',
        sessions: [
          { name: 'Sunday Morning', startTime: '06:00', endTime: '10:00' },
        ],
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
  );
  console.log('Synced GymOperatingHours for all 7 days');

  // Verify Active Plans
  const activePlans = await MembershipPlan.find({ status: 'active' }).sort({ price: 1 });
  console.log('\n--- VERIFIED ACTIVE PLANS IN MONGODB ---');
  activePlans.forEach(p => console.log(`✓ ${p.name.padEnd(42)} | ₹${String(p.price).padEnd(6)} | ${p.duration} Month(s)`));

  // Verify Active Slots on Monday
  const activeMonSlots = await GymTimeSlot.find({ dayOfWeek: 'monday', status: 'active' }).sort({ startTime: 1 });
  console.log('\n--- VERIFIED ACTIVE MONDAY SLOTS ---');
  activeMonSlots.forEach(s => console.log(`✓ ${s.name.padEnd(20)} | ${s.startTime} – ${s.endTime} | Max Capacity: ${s.maxCapacity}`));

  // Verify Active Slots on Sunday
  const activeSunSlots = await GymTimeSlot.find({ dayOfWeek: 'sunday', status: 'active' }).sort({ startTime: 1 });
  console.log('\n--- VERIFIED ACTIVE SUNDAY SLOTS ---');
  activeSunSlots.forEach(s => console.log(`✓ ${s.name.padEnd(20)} | ${s.startTime} – ${s.endTime} | Max Capacity: ${s.maxCapacity}`));

  await mongoose.disconnect();
  console.log('\nDatabase sync complete!');
}

sync().catch(err => {
  console.error('SYNC FAILED:', err);
  process.exit(1);
});

