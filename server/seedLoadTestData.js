const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectDb = require('./config/db');
const User = require('./models/User');
const MemberProfile = require('./models/MemberProfile');
const TrainerProfile = require('./models/TrainerProfile');
const TrainerAvailability = require('./models/TrainerAvailability');
const TrainerClientAllocation = require('./models/TrainerClientAllocation');
const MembershipPlan = require('./models/MembershipPlan');
const GymTimeSlot = require('./models/GymTimeSlot');
const MemberMembership = require('./models/MemberMembership');
const MemberSlotAllocation = require('./models/MemberSlotAllocation');
const Payment = require('./models/Payment');
const MemberAttendance = require('./models/MemberAttendance');
const Sequence = require('./models/Sequence');

// High-quality name banks for generating realistic, authentic data
const FIRST_NAMES_MALE = [
  'Aarav', 'Rohan', 'Aditya', 'Vikram', 'Arjun', 'Karthik', 'Rajesh', 'Suresh',
  'Rahul', 'Amit', 'Siddharth', 'Varun', 'Nikhil', 'Pranav', 'Manish', 'Deepak',
  'Gaurav', 'Abhishek', 'Ankit', 'Kunal', 'Neeraj', 'Sachin', 'Vishal', 'Harsh',
  'Rohit', 'Akash', 'Mayank', 'Yash', 'Naveen', 'Vivek', 'Tarun', 'Alok',
  'Mohit', 'Rakesh', 'Ajay', 'Sanjay', 'Vinay', 'Chetan', 'Praveen', 'Santosh',
  'Girish', 'Harish', 'Dinesh', 'Manoj', 'Kiran', 'Prashant', 'Ashwin', 'Shyam',
];

const FIRST_NAMES_FEMALE = [
  'Priya', 'Ananya', 'Pooja', 'Sneha', 'Neha', 'Riya', 'Divya', 'Kavya',
  'Shreya', 'Meera', 'Swati', 'Deepa', 'Shilpa', 'Rashmi', 'Tanvi', 'Preeti',
  'Shruti', 'Aishwarya', 'Isha', 'Sunita', 'Geeta', 'Rekha', 'Anita', 'Anjali',
  'Meenakshi', 'Radhika', 'Bhavana', 'Lavanya', 'Harini', 'Pavithra', 'Nandini',
  'Keerthi', 'Archana', 'Madhuri', 'Simran', 'Kritika', 'Trisha', 'Sanjana',
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Reddy', 'Kumar', 'Singh', 'Gupta', 'Nair',
  'Iyer', 'Rao', 'Joshi', 'Kulkarni', 'Hegde', 'Gowda', 'Bhat', 'Pillai',
  'Menon', 'Das', 'Roy', 'Mukherjee', 'Chatterjee', 'Banerjee', 'Bose', 'Sen',
  'Dutta', 'Ghosh', 'Jain', 'Agarwal', 'Mehta', 'Shah', 'Desai', 'Chauhan',
  'Yadav', 'Mishra', 'Pandey', 'Tiwari', 'Nambiar', 'Shetty', 'Pai', 'Kamath',
];

const LOCALITIES = [
  '100ft Road, Indiranagar',
  '80ft Road, Koramangala 4th Block',
  'HSR Layout, Sector 2',
  'Outer Ring Road, Bellandur',
  'Sarjapur Main Road',
  'Whitefield ITPL Main Road',
  'JP Nagar 6th Phase',
  'Jayanagar 4th Block',
  'Bannerghatta Road, Hulimavu',
  'MG Road, Central',
  'Brigade Road, Ashok Nagar',
  'Richmond Town',
  'Malleshwaram 8th Cross',
  'Rajajinagar 1st Block',
  'Electronic City Phase 1',
  'Marathahalli Bridge',
  'Hebbal Kempapura',
  'Yelahanka New Town',
  'Kalyan Nagar, HRBR Layout',
  'BTM Layout 2nd Stage',
];

const SPECIALIZATIONS = [
  'Strength & Conditioning',
  'CrossFit & High Intensity Training',
  'Bodybuilding & Hypertrophy',
  'Weight Loss & Functional Fitness',
  'Yoga & Mobility Training',
  'Powerlifting & Heavy Compound Lifting',
  'Calisthenics & Bodyweight Movement',
  'Olympic Weightlifting',
  'Endurance & Cardio Conditioning',
  'Rehabilitation & Posture Correction',
  'Kickboxing & Martial Arts Fitness',
  'Athletic Performance & Agility',
];

const CERT_POOLS = [
  ['ACE-CPT', 'CPR/AED'],
  ['NASM-PES', 'CrossFit Level 2'],
  ['ISSA-CPT', 'Precision Nutrition Level 1'],
  ['CSCS', 'NSCA-CPT'],
  ['K11 Diploma in Personal Training', 'CPR/AED'],
  ['Yoga Alliance RYT-200', 'Mobility Specialist'],
  ['REPs India Level 3', 'TRX Certified'],
  ['NASM-CPT', 'FMS Level 1'],
];

const FITNESS_GOALS = ['general_fitness', 'muscle_gain', 'weight_loss', 'strength', 'flexibility'];
const EXPERIENCES = ['beginner', 'intermediate', 'advanced'];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addMonthsClamped(date, months) {
  const d = new Date(date);
  const targetMonth = d.getMonth() + months;
  d.setMonth(targetMonth);
  return d;
}

async function seed() {
  console.log('Connecting to database...');
  await connectDb();

  try {
    // ----------------------------------------------------
    // CLEANUP PREVIOUS TEST RUNS (IDEMPOTENT SAFETY)
    // ----------------------------------------------------
    console.log('Cleaning up any previous test seed data...');
    const testUsers = await User.find({ email: { $regex: /^(member|trainer)[0-9]+@pulsefit\.com$/ } }).select('_id email').lean();
    const testUserIds = testUsers.map(u => u._id);

    if (testUserIds.length) {
      console.log(`Found ${testUserIds.length} previous test accounts to clean up...`);
      const testMembers = await MemberProfile.find({ user: { $in: testUserIds } }).select('_id').lean();
      const testMemberIds = testMembers.map(m => m._id);

      const testTrainers = await TrainerProfile.find({ user: { $in: testUserIds } }).select('_id').lean();
      const testTrainerIds = testTrainers.map(t => t._id);

      if (testMemberIds.length) {
        await MemberMembership.deleteMany({ member: { $in: testMemberIds } });
        await MemberSlotAllocation.deleteMany({ member: { $in: testMemberIds } });
        await TrainerClientAllocation.deleteMany({ member: { $in: testMemberIds } });
        await Payment.deleteMany({ member: { $in: testMemberIds } });
        await MemberAttendance.deleteMany({ member: { $in: testMemberIds } });
        await MemberProfile.deleteMany({ _id: { $in: testMemberIds } });
      }

      if (testTrainerIds.length) {
        await TrainerAvailability.deleteMany({ trainer: { $in: testTrainerIds } });
        await TrainerClientAllocation.deleteMany({ trainer: { $in: testTrainerIds } });
        await TrainerProfile.deleteMany({ _id: { $in: testTrainerIds } });
      }

      await User.deleteMany({ _id: { $in: testUserIds } });
      console.log(`✓ Cleaned up previous test run data.`);
    }

    console.log('Generating shared password hash for load-test accounts...');
    const memberPasswordHash = await bcrypt.hash('member123', 10);
    const trainerPasswordHash = await bcrypt.hash('trainer123', 10);

    // Fetch existing plans and slots
    const plans = await MembershipPlan.find().lean();
    if (!plans.length) throw new Error('No membership plans found in database. Seed plans first.');

    // Increase maxCapacity on GymTimeSlots to support 2000 active members
    console.log('Configuring gym time slot capacities for 2000 member load testing...');
    await GymTimeSlot.updateMany({}, { $set: { maxCapacity: 450 } });
    const slots = await GymTimeSlot.find({ status: 'active' }).lean();
    if (!slots.length) throw new Error('No time slots found in database.');

    // ----------------------------------------------------
    // 1. CREATE 20 TRAINERS
    // ----------------------------------------------------
    console.log('\n--- Creating 20 Professional Trainers ---');
    const existingTrainersCount = await TrainerProfile.countDocuments();
    const trainerStartIdx = existingTrainersCount + 1;

    const newTrainerUsers = [];
    const newTrainerProfiles = [];
    const newTrainerAvailabilities = [];

    const trainerWorkingDayOptions = [
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      ['tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    ];

    for (let i = 0; i < 20; i++) {
      const idx = trainerStartIdx + i;
      const isMale = i % 3 !== 0;
      const firstName = isMale ? randomChoice(FIRST_NAMES_MALE) : randomChoice(FIRST_NAMES_FEMALE);
      const lastName = randomChoice(LAST_NAMES);
      const fullName = `${firstName} ${lastName}`;
      const initials = (firstName[0] + lastName[0]).toUpperCase();
      const email = `trainer${idx}@pulsefit.com`;
      const mobileNumber = `98${String(idx).padStart(2, '0')}${String(randomInt(100000, 999999))}`.slice(0, 10);
      const trainerId = `TRN${String(idx).padStart(4, '0')}`;
      const specialization = SPECIALIZATIONS[i % SPECIALIZATIONS.length];
      const experience = randomInt(3, 14);
      const certs = CERT_POOLS[i % CERT_POOLS.length];
      const workingDays = trainerWorkingDayOptions[i % trainerWorkingDayOptions.length];

      const userId = new mongoose.Types.ObjectId();
      const trainerProfileId = new mongoose.Types.ObjectId();

      newTrainerUsers.push({
        _id: userId,
        email,
        password: trainerPasswordHash,
        role: 'trainer',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      newTrainerProfiles.push({
        _id: trainerProfileId,
        user: userId,
        trainerId,
        fullName,
        gender: isMale ? 'male' : 'female',
        dateOfBirth: new Date(1985 + (i % 12), (i * 2) % 12, 10 + (i % 18)),
        mobileNumber,
        email,
        specialization,
        experience,
        certifications: certs,
        joiningDate: new Date(Date.now() - randomInt(180, 720) * 86400000),
        workingDays,
        convenientTimings: ['morning', 'afternoon', 'evening'],
        status: 'active',
        avatarInitials: initials,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      for (const day of workingDays) {
        newTrainerAvailabilities.push({
          trainer: trainerProfileId,
          dayOfWeek: day,
          startTime: '06:00',
          endTime: '21:00',
          maxClients: 50,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    console.log(`Inserting ${newTrainerUsers.length} trainer users...`);
    await User.insertMany(newTrainerUsers);

    console.log(`Inserting ${newTrainerProfiles.length} trainer profiles...`);
    await TrainerProfile.insertMany(newTrainerProfiles);

    console.log(`Inserting ${newTrainerAvailabilities.length} trainer availability schedules...`);
    await TrainerAvailability.insertMany(newTrainerAvailabilities);

    await Sequence.findOneAndUpdate(
      { _id: 'trainer' },
      { $set: { value: trainerStartIdx + 19 } },
      { upsert: true }
    );
    console.log(`✓ 20 Trainers successfully created (IDs: TRN${String(trainerStartIdx).padStart(4, '0')} to TRN${String(trainerStartIdx + 19).padStart(4, '0')}).`);

    // Combine all available trainers (including existing) for member assignments
    const allTrainers = await TrainerProfile.find({ status: 'active' }).lean();

    // ----------------------------------------------------
    // 2. CREATE 2000 MEMBERS + MEMBERSHIPS + SLOTS + PAYMENTS
    // ----------------------------------------------------
    console.log('\n--- Creating 2000 Members with Full Schemas & Relational Data ---');

    // Get current member sequence
    const memberSeqDoc = await Sequence.findOne({ _id: 'member' }).lean();
    const memberStartVal = (memberSeqDoc?.value || 6) + 1;

    const TOTAL_MEMBERS = 2000;
    const BATCH_SIZE = 500;

    const now = Date.now();
    const dayMs = 86400000;

    let memberIdx = memberStartVal;
    let paymentCounter = 1000;

    // Slot capacity tracking map
    const slotCapacityCount = {};
    for (const s of slots) {
      slotCapacityCount[s._id.toString()] = s.currentCapacity || 0;
    }

    for (let batchStart = 0; batchStart < TOTAL_MEMBERS; batchStart += BATCH_SIZE) {
      const batchCount = Math.min(BATCH_SIZE, TOTAL_MEMBERS - batchStart);
      const batchEnd = batchStart + batchCount;
      console.log(`Processing batch ${batchStart + 1} to ${batchEnd} of ${TOTAL_MEMBERS}...`);

      const userBatch = [];
      const memberBatch = [];
      const membershipBatch = [];
      const slotAllocBatch = [];
      const trainerAllocBatch = [];
      const paymentBatch = [];

      for (let i = 0; i < batchCount; i++) {
        const curMemberNum = memberIdx++;
        const isMale = Math.random() < 0.62;
        const firstName = isMale ? randomChoice(FIRST_NAMES_MALE) : randomChoice(FIRST_NAMES_FEMALE);
        const lastName = randomChoice(LAST_NAMES);
        const fullName = `${firstName} ${lastName}`;
        const initials = (firstName[0] + lastName[0]).toUpperCase();
        const memberId = `GYM${String(curMemberNum).padStart(4, '0')}`;
        const email = `member${curMemberNum}@pulsefit.com`;

        // Unique mobile number
        const mobilePrefix = ['98', '97', '99', '96', '91', '90', '88', '87', '70', '81'][curMemberNum % 10];
        const mobileNumber = `${mobilePrefix}${String(curMemberNum).padStart(4, '0')}${String(randomInt(1000, 9999))}`.slice(0, 10);

        const emergencyPhone = `95${String(curMemberNum).padStart(4, '0')}${String(randomInt(1000, 9999))}`.slice(0, 10);
        const emergencyContactName = `${randomChoice(isMale ? FIRST_NAMES_FEMALE : FIRST_NAMES_MALE)} ${lastName}`;

        // Registration date spread across the last 180 days
        const daysAgo = randomInt(1, 180);
        const regDate = new Date(now - daysAgo * dayMs);

        // Realistic member status: 94% active, 4% expired, 2% frozen
        const randStatus = Math.random();
        let memberStatus = 'active';
        let regStatus = 'active';
        if (randStatus > 0.96) {
          memberStatus = 'expired';
          regStatus = 'expired';
        } else if (randStatus > 0.94) {
          memberStatus = 'frozen';
          regStatus = 'active';
        }

        // Plan selection
        const plan = randomChoice(plans);
        let startDate = regDate;
        let endDate = addMonthsClamped(startDate, plan.duration);

        if (memberStatus === 'expired') {
          // If expired, membership started in the past and expired 2 to 45 days ago
          const expiredDaysAgo = randomInt(2, 45);
          endDate = new Date(now - expiredDaysAgo * dayMs);
          startDate = new Date(endDate.getTime() - Math.max(plan.duration, 1) * 30 * dayMs);
        }

        // Payment status & dues
        let paymentStatus = 'paid';
        let amountPaid = plan.price;
        let pendingAmount = 0;
        if (memberStatus === 'active') {
          const payRand = Math.random();
          if (payRand > 0.96) {
            paymentStatus = 'partial';
            amountPaid = Math.round(plan.price * 0.5);
            pendingAmount = plan.price - amountPaid;
          } else if (payRand > 0.94) {
            paymentStatus = 'pending';
            amountPaid = 0;
            pendingAmount = plan.price;
          }
        }

        // Assign a gym time slot
        const assignedSlot = randomChoice(slots);
        slotCapacityCount[assignedSlot._id.toString()] = (slotCapacityCount[assignedSlot._id.toString()] || 0) + 1;

        // Optionally assign a personal trainer (~35% of members have personal trainer)
        const hasTrainer = Math.random() < 0.35 && allTrainers.length > 0;
        const assignedTrainer = hasTrainer ? randomChoice(allTrainers) : null;

        const userId = new mongoose.Types.ObjectId();
        const memberProfileId = new mongoose.Types.ObjectId();
        const membershipId = new mongoose.Types.ObjectId();

        userBatch.push({
          _id: userId,
          email,
          password: memberPasswordHash,
          role: 'member',
          isActive: memberStatus !== 'expired',
          createdAt: regDate,
          updatedAt: new Date(),
        });

        memberBatch.push({
          _id: memberProfileId,
          user: userId,
          memberId,
          fullName,
          dateOfBirth: new Date(1975 + randomInt(0, 30), randomInt(0, 11), randomInt(1, 28)),
          gender: isMale ? 'male' : 'female',
          mobileNumber,
          address: `${randomInt(1, 450)}, ${randomChoice(LOCALITIES)}, Bengaluru`,
          emergencyContactName,
          emergencyContactPhone: emergencyPhone,
          height: isMale ? randomInt(165, 192) : randomInt(150, 172),
          weight: isMale ? randomInt(60, 102) : randomInt(48, 80),
          fitnessGoal: randomChoice(FITNESS_GOALS),
          exerciseExperience: randomChoice(EXPERIENCES),
          previousDiseases: 'none',
          recentOperations: 'none',
          healthNotes: 'Cleared for high-intensity gym workouts and personal training',
          physicalLimitations: 'none',
          registrationStatus: regStatus,
          membershipStatus: memberStatus,
          registrationDate: regDate,
          avatarInitials: initials,
          createdAt: regDate,
          updatedAt: new Date(),
        });

        membershipBatch.push({
          _id: membershipId,
          member: memberProfileId,
          membershipPlan: plan._id,
          startDate,
          endDate,
          action: 'new_membership',
          requestedSlot: assignedSlot._id,
          requestedTrainer: assignedTrainer ? assignedTrainer._id : undefined,
          status: memberStatus,
          paymentStatus,
          amountPaid,
          totalAmount: plan.price,
          pendingAmount,
          createdAt: regDate,
          updatedAt: new Date(),
        });

        // Slot allocation (only active for active members)
        if (memberStatus === 'active') {
          slotAllocBatch.push({
            member: memberProfileId,
            timeSlot: assignedSlot._id,
            membership: membershipId,
            startDate,
            endDate,
            status: 'active',
            createdAt: regDate,
            updatedAt: new Date(),
          });
        }

        // Trainer client allocation
        if (assignedTrainer && memberStatus === 'active') {
          trainerAllocBatch.push({
            trainer: assignedTrainer._id,
            member: memberProfileId,
            startDate,
            endDate,
            status: 'active',
            notes: `Personal fitness coaching: ${randomChoice(SPECIALIZATIONS)}`,
            createdAt: regDate,
            updatedAt: new Date(),
          });
        }

        // Payment record
        if (amountPaid > 0) {
          const payMethods = ['upi', 'upi', 'card', 'card', 'cash', 'online_gateway'];
          paymentBatch.push({
            member: memberProfileId,
            membership: membershipId,
            transactionId: `TXN-${paymentCounter++}-${memberId}`,
            amount: amountPaid,
            paymentMethod: randomChoice(payMethods),
            paymentStatus: 'completed',
            paymentDate: regDate,
            action: 'new_membership',
            notes: `Membership activation payment for ${plan.name} (${plan.duration} Month)`,
            createdAt: regDate,
            updatedAt: new Date(),
          });
        }
      }

      // Bulk write batch
      await User.insertMany(userBatch);
      await MemberProfile.insertMany(memberBatch);
      await MemberMembership.insertMany(membershipBatch);
      if (slotAllocBatch.length) await MemberSlotAllocation.insertMany(slotAllocBatch);
      if (trainerAllocBatch.length) await TrainerClientAllocation.insertMany(trainerAllocBatch);
      if (paymentBatch.length) await Payment.insertMany(paymentBatch);

      console.log(`✓ Stored batch ${batchEnd}/${TOTAL_MEMBERS}`);
    }

    // Update Sequence for members
    await Sequence.findOneAndUpdate(
      { _id: 'member' },
      { $set: { value: memberIdx - 1 } },
      { upsert: true }
    );

    // Update currentCapacity on all time slots
    console.log('\nUpdating time slot capacities based on new member allocations...');
    for (const [slotId, count] of Object.entries(slotCapacityCount)) {
      await GymTimeSlot.findByIdAndUpdate(slotId, { $set: { currentCapacity: count } });
    }

    // ----------------------------------------------------
    // 3. GENERATE ATTENDANCE DATA (PAST 7 DAYS + TODAY LIVE)
    // ----------------------------------------------------
    console.log('\n--- Generating Realistic Attendance Data for Analytics & Live Load Testing ---');
    const allMembers = await MemberProfile.find({ membershipStatus: 'active' }).select('_id memberId fullName').lean();
    console.log(`Found ${allMembers.length} active members available for attendance simulation.`);

    const attendanceRecords = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Past 6 days attendance trend
    for (let dayOffset = 6; dayOffset >= 1; dayOffset--) {
      const attDate = new Date(today);
      attDate.setDate(attDate.getDate() - dayOffset);
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][attDate.getDay()];
      if (dayName === 'sunday') continue; // Gym closed/limited on Sunday

      // Pick ~160 to ~220 members each day
      const dailyCount = randomInt(160, 220);
      const shuffled = [...allMembers].sort(() => 0.5 - Math.random()).slice(0, dailyCount);

      for (const m of shuffled) {
        const isMorning = Math.random() < 0.55;
        const checkInHour = isMorning ? randomInt(6, 10) : randomInt(16, 20);
        const checkInMin = randomInt(0, 59);

        const checkInTime = new Date(attDate);
        checkInTime.setHours(checkInHour, checkInMin, randomInt(0, 59));

        const durationMin = randomInt(45, 95);
        const checkOutTime = new Date(checkInTime.getTime() + durationMin * 60000);

        attendanceRecords.push({
          member: m._id,
          attendanceDate: attDate,
          checkInTime,
          checkOutTime,
          duration: durationMin,
          sessionOpen: false,
          sessionName: isMorning ? 'morning' : 'evening',
          attendanceStatus: 'present',
          verificationReference: `SIM-ATT-${m.memberId}`,
          deviceId: 'MFS500-STATION-01',
          punches: [
            { punchTime: checkInTime, punchType: 'checkin', deviceId: 'MFS500-STATION-01' },
            { punchTime: checkOutTime, punchType: 'checkout', deviceId: 'MFS500-STATION-01' },
          ],
          createdAt: checkInTime,
          updatedAt: checkOutTime,
        });
      }
    }

    // Today's live check-ins:
    // ~180 check-ins today: ~35 currently checked in (live active!), ~145 already checked out
    const todayShuffled = [...allMembers].sort(() => 0.5 - Math.random()).slice(0, 180);
    const liveCheckedInCount = 35;

    for (let j = 0; j < todayShuffled.length; j++) {
      const m = todayShuffled[j];
      const isCurrentlyInside = j < liveCheckedInCount;

      const checkInTime = new Date();
      if (isCurrentlyInside) {
        // Checked in 15 to 75 minutes ago, still inside
        checkInTime.setMinutes(checkInTime.getMinutes() - randomInt(15, 75));
        checkInTime.setSeconds(randomInt(0, 59));

        attendanceRecords.push({
          member: m._id,
          attendanceDate: today,
          checkInTime,
          checkOutTime: null,
          duration: 0,
          sessionOpen: true,
          sessionName: 'evening',
          attendanceStatus: 'present',
          verificationReference: `SIM-LIVE-${m.memberId}`,
          deviceId: 'MFS500-STATION-01',
          punches: [
            { punchTime: checkInTime, punchType: 'checkin', deviceId: 'MFS500-STATION-01' },
          ],
          createdAt: checkInTime,
          updatedAt: checkInTime,
        });
      } else {
        // Checked in earlier today and completed session
        checkInTime.setHours(checkInTime.getHours() - randomInt(2, 8));
        checkInTime.setMinutes(randomInt(0, 59));
        const durationMin = randomInt(45, 90);
        const checkOutTime = new Date(checkInTime.getTime() + durationMin * 60000);

        attendanceRecords.push({
          member: m._id,
          attendanceDate: today,
          checkInTime,
          checkOutTime,
          duration: durationMin,
          sessionOpen: false,
          sessionName: checkInTime.getHours() < 13 ? 'morning' : 'evening',
          attendanceStatus: 'present',
          verificationReference: `SIM-TODAY-${m.memberId}`,
          deviceId: 'MFS500-STATION-01',
          punches: [
            { punchTime: checkInTime, punchType: 'checkin', deviceId: 'MFS500-STATION-01' },
            { punchTime: checkOutTime, punchType: 'checkout', deviceId: 'MFS500-STATION-01' },
          ],
          createdAt: checkInTime,
          updatedAt: checkOutTime,
        });
      }
    }

    console.log(`Inserting ${attendanceRecords.length} attendance records across past 7 days...`);
    // Insert attendance in batches
    for (let k = 0; k < attendanceRecords.length; k += 500) {
      await MemberAttendance.insertMany(attendanceRecords.slice(k, k + 500));
    }
    console.log('✓ Attendance records successfully inserted.');

    // ----------------------------------------------------
    // 4. SUMMARY REPORT
    // ----------------------------------------------------
    console.log('\n====================================================');
    console.log('🎉 LOAD TESTING SEEDING COMPLETED SUCCESSFULLY!');
    console.log('====================================================');
    const [finalUsers, finalMembers, finalTrainers, finalMemberships, finalSlots, finalTrainerAllocs, finalPayments, finalAttendance] = await Promise.all([
      User.countDocuments(),
      MemberProfile.countDocuments(),
      TrainerProfile.countDocuments(),
      MemberMembership.countDocuments(),
      MemberSlotAllocation.countDocuments(),
      TrainerClientAllocation.countDocuments(),
      Payment.countDocuments(),
      MemberAttendance.countDocuments(),
    ]);

    console.log(`• Total Users in DB:             ${finalUsers}`);
    console.log(`• Total Member Profiles:        ${finalMembers} (target: +2000)`);
    console.log(`• Total Trainer Profiles:       ${finalTrainers} (target: +20)`);
    console.log(`• Total Active Memberships:     ${finalMemberships}`);
    console.log(`• Total Slot Allocations:       ${finalSlots}`);
    console.log(`• Total Trainer Client Allocs:  ${finalTrainerAllocs}`);
    console.log(`• Total Payments / Receipts:    ${finalPayments}`);
    console.log(`• Total Attendance Records:     ${finalAttendance}`);
    console.log('====================================================');
    console.log('Member credentials: email: member1@pulsefit.com to member2000@pulsefit.com | password: member123');
    console.log('Trainer credentials: email: trainer1@pulsefit.com to trainer20@pulsefit.com | password: trainer123');
    console.log('====================================================\n');

  } finally {
    await mongoose.disconnect();
  }
}

seed().catch(err => {
  console.error('Seeding failed with error:', err);
  process.exitCode = 1;
});
