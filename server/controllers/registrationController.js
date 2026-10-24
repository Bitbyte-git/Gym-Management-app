const { validateSlotHours } = require('../utils/schedule');
const { checkTrainer } = require('../services/allocationService');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const MemberProfile = require('../models/MemberProfile');
const MembershipPlan = require('../models/MembershipPlan');
const GymTimeSlot = require('../models/GymTimeSlot');
const TrainerProfile = require('../models/TrainerProfile');
const TrainerAvailability = require('../models/TrainerAvailability');
const MemberMembership = require('../models/MemberMembership');
const Payment = require('../models/Payment');
const RegistrationDraft = require('../models/RegistrationDraft');
const { generateMemberId } = require('../services/memberService');
const { addMonthsClamped } = require('../utils/date');

const makeError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');

const getDraft = async (req, { required = true } = {}) => {
  const token = req.get('x-registration-token');
  if (!token) {
    if (required) throw makeError('Registration token is required');
    return null;
  }

  const draft = await RegistrationDraft.findOne({ tokenHash: tokenHash(token) }).select('+tokenHash');
  if (!draft || draft.status === 'cancelled') {
    throw makeError('Registration could not be found. Start a new registration.', 404);
  }
  if (draft.status === 'in_progress' &&
      Date.now() - draft.lastActivityAt.getTime() > 90 * 24 * 60 * 60 * 1000) {
    throw makeError('This registration has expired. Start a new registration.', 410);
  }
  draft.lastActivityAt = new Date();
  return draft;
};

const requireInProgress = (draft) => {
  if (draft.status !== 'in_progress') {
    throw makeError('This registration has already been submitted and cannot be changed.', 409);
  }
};

exports.submitBasicDetails = async (req, res, next) => {
  try {
    const {
      email,
      password,
      fullName,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      mobileNumber,
      mobile,
      address,
      emergencyContactName,
      emergencyContactPhone,
    } = req.body;

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const name = String(fullName || `${firstName || ''} ${lastName || ''}`).trim();
    const phone = String(mobileNumber || mobile || '').trim();
    const birthday = new Date(dateOfBirth);

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || normalizedEmail.length > 254 ||
        typeof password !== 'string' || password.length < 8 || password.length > 72 ||
        !name || name.length > 120 || Number.isNaN(birthday.getTime()) ||
        !['male', 'female', 'other'].includes(gender) ||
        !/^\d{10}$/.test(phone) || typeof emergencyContactName !== 'string' ||
        !emergencyContactName.trim() || emergencyContactName.length > 120 ||
        !/^\d{10}$/.test(String(emergencyContactPhone || '')) ||
        (address !== undefined && (typeof address !== 'string' || address.length > 500))) {
      throw makeError('Provide a valid email, password (at least 8 characters), name, date of birth, gender, and 10-digit contact numbers.');
    }
    if (birthday >= new Date()) throw makeError('Date of birth must be in the past.');

    let draft = await getDraft(req, { required: false });
    if (draft) {
      requireInProgress(draft);
      if (draft.user && draft.user.toString()) {
        const existingUser = await User.findById(draft.user).select('+password');
        if (!existingUser || !await existingUser.matchPassword(password)) {
          throw makeError('Enter the password associated with this saved registration.', 401);
        }
        const conflictingUser = await User.findOne({ email: normalizedEmail, _id: { $ne: existingUser._id } });
        if (conflictingUser) throw makeError('User already exists with this email', 409);
        existingUser.email = normalizedEmail;
        await existingUser.save();
      }
      draft.basicDetails = {
        fullName: name,
        dateOfBirth: birthday,
        gender,
        mobileNumber: phone,
        address,
        emergencyContactName: String(emergencyContactName).trim(),
        emergencyContactPhone: String(emergencyContactPhone).trim(),
      };
    } else {
      if (await User.exists({ email: normalizedEmail })) {
        throw makeError('User already exists with this email', 409);
      }
      const rawToken = crypto.randomBytes(32).toString('hex');
      const session = await User.startSession();
      try {
        await session.withTransaction(async () => {
          const [user] = await User.create([{
            email: normalizedEmail,
            password,
            role: 'member',
            isActive: false,
          }], { session });
          draft = new RegistrationDraft({
            user: user._id,
            tokenHash: tokenHash(rawToken),
            basicDetails: {
              fullName: name,
              dateOfBirth: birthday,
              gender,
              mobileNumber: phone,
              address,
              emergencyContactName: emergencyContactName.trim(),
              emergencyContactPhone: String(emergencyContactPhone).trim(),
            },
          });
          await draft.save({ session });
        });
      } finally {
        await session.endSession();
      }
      return res.status(201).json({
        success: true,
        data: { registrationToken: rawToken, status: draft.status },
      });
    }

    await draft.save();
    res.status(200).json({ success: true, data: { status: draft.status } });
  } catch (error) {
    next(error);
  }
};

exports.submitHealthDetails = async (req, res, next) => {
  try {
    const draft = await getDraft(req);
    requireInProgress(draft);
    const { height, weight, fitnessGoal, exerciseExperience, previousDiseases, recentOperations, healthNotes, physicalLimitations } = req.body;
    const allowedGoals = ['weight_loss', 'muscle_gain', 'strength', 'general_fitness', 'flexibility'];
    const allowedExperience = ['beginner', 'intermediate', 'advanced', 'not_applicable'];
    if (!Number.isFinite(Number(height)) || Number(height) <= 0 ||
        Number(height) > 300 ||
        !Number.isFinite(Number(weight)) || Number(weight) <= 0 ||
        Number(weight) > 500 ||
        !allowedGoals.includes(fitnessGoal) ||
        (exerciseExperience && !allowedExperience.includes(exerciseExperience)) ||
        [previousDiseases, recentOperations, healthNotes, physicalLimitations]
          .some((value) => value !== undefined && (typeof value !== 'string' || value.length > 2000))) {
      throw makeError('Provide a valid height, weight, and fitness goal.');
    }
    if (req.body.healthConsent !== true) throw makeError('Consent is required to store health and fitness details');
    draft.healthConsentAt = new Date();
    draft.healthDetails = {
      height: Number(height),
      weight: Number(weight),
      fitnessGoal,
      exerciseExperience: exerciseExperience || 'not_applicable',
      previousDiseases: previousDiseases || 'none',
      recentOperations: recentOperations || 'none',
      healthNotes,
      physicalLimitations,
    };
    await draft.save();
    res.status(200).json({ success: true, data: { status: draft.status } });
  } catch (error) {
    next(error);
  }
};

exports.getAvailablePlans = async (req, res, next) => {
  try {
    const plans = await MembershipPlan.find({ status: 'active' }).sort({ price: 1 });
    res.status(200).json({ success: true, count: plans.length, data: plans });
  } catch (error) {
    next(error);
  }
};

exports.getAvailableSlots = async (req, res, next) => {
  try {
    if (req.query.planId && !mongoose.isValidObjectId(req.query.planId)) {
      return res.status(400).json({ success: false, error: 'Invalid membership plan ID' });
    }
    const query = { status: 'active', dayOfWeek: 'monday' };
    if (req.query.planId) {
      query.$or = [
        { eligiblePlans: { $size: 0 } },
        { eligiblePlans: req.query.planId },
      ];
    }
    const slots = await GymTimeSlot.find(query).sort({ dayOfWeek: 1, startTime: 1 });
    const availableSlots = [];
    for (const slot of slots) {
      if (slot.currentCapacity >= slot.maxCapacity) continue;
      try { await validateSlotHours(slot); availableSlots.push(slot); } catch (error) { if (error.statusCode !== 409) throw error; }
    }
    res.status(200).json({ success: true, count: availableSlots.length, data: availableSlots });
  } catch (error) {
    next(error);
  }
};

exports.getAvailableTrainers = async (req, res, next) => {
  try {
    const slot = mongoose.isValidObjectId(req.query.slotId) ? await GymTimeSlot.findById(req.query.slotId) : null;
    const candidates = await TrainerProfile.find({ status: 'active' }).sort({ fullName: 1 });
    const trainers = [];
    for (const trainer of candidates) {
      try { await checkTrainer(trainer._id, slot); trainers.push(trainer); } catch (error) { if (error.statusCode !== 409) throw error; }
    }
    res.status(200).json({ success: true, count: trainers.length, data: trainers });
  } catch (error) {
    next(error);
  }
};

exports.submitSelection = async (req, res, next) => {
  try {
    const draft = await getDraft(req);
    requireInProgress(draft);
    if (!draft.healthDetails?.height || !draft.healthDetails?.weight) {
      throw makeError('Complete health and fitness details before selecting a plan.');
    }
    const { planId, slotId, trainerId } = req.body;
    if (!mongoose.isValidObjectId(planId) || !mongoose.isValidObjectId(slotId) ||
        (trainerId && !mongoose.isValidObjectId(trainerId))) {
      throw makeError('Provide valid membership plan, time slot, and trainer IDs.');
    }
    const plan = await MembershipPlan.findOne({ _id: planId, status: 'active' });
    if (!plan) throw makeError('Invalid or inactive membership plan');

    const slot = await GymTimeSlot.findOne({
      _id: slotId,
      status: 'active',
      $or: [{ eligiblePlans: { $size: 0 } }, { eligiblePlans: plan._id }],
    });
    if (!slot) throw makeError('Invalid time slot or the selected plan is not eligible');
    if (slot.currentCapacity >= slot.maxCapacity) throw makeError('Time slot has reached maximum capacity');

    await validateSlotHours(slot);
    let trainer = null;
    if (trainerId) {
      trainer = await TrainerProfile.findOne({ _id: trainerId, status: 'active' });
      if (!trainer) throw makeError('Invalid or inactive trainer');
      await checkTrainer(trainerId, slot);
    }
    draft.selection = { plan: plan._id, slot: slot._id, trainer: trainer?._id };
    await draft.save();
    res.status(200).json({
      success: true,
      data: {
        plan,
        slot,
        trainer,
        paymentStatus: 'pending',
        message: 'Selections saved. Membership remains pending until payment is confirmed by an authorized workflow.',
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.completeRegistration = async (req, res, next) => {
  try {
    const draft = await getDraft(req);
    if (['pending_payment', 'completed'].includes(draft.status) && draft.member && draft.membership) {
      return res.status(200).json({
        success: true,
        data: { status: draft.status, memberId: draft.member, membershipId: draft.membership },
      });
    }
    requireInProgress(draft);
    if (!draft.healthDetails?.height || !draft.selection?.plan || !draft.selection?.slot) {
      throw makeError('Complete health details and choose a plan and time slot before submitting.');
    }

    const session = await User.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        const plan = await MembershipPlan.findOne({
          _id: draft.selection.plan,
          status: 'active',
        }).session(session);
        if (!plan) throw makeError('Selected membership plan is no longer available');
        const fresh = await RegistrationDraft.findById(draft._id).session(session);
        if (fresh.status !== 'in_progress') throw makeError('Registration already submitted. Refresh its status.', 409);
        const selectedSlot = await GymTimeSlot.findOne({ _id: draft.selection.slot, status: 'active' }).session(session);
        if (!selectedSlot || selectedSlot.currentCapacity >= selectedSlot.maxCapacity) throw makeError('Selected slot is no longer available', 409);
        await validateSlotHours(selectedSlot, session);
        if (draft.selection.trainer) await checkTrainer(draft.selection.trainer, selectedSlot, session);
        const memberId = await generateMemberId(session);
        const [member] = await MemberProfile.create([{
          user: draft.user,
          memberId,
          ...draft.basicDetails.toObject(),
          ...draft.healthDetails.toObject(),
          healthConsentAt: draft.healthConsentAt,
          registrationStatus: 'pending_payment',
          membershipStatus: 'none',
        }], { session });
        const startDate = new Date();
        const endDate = addMonthsClamped(startDate, plan.duration);
        const [membership] = await MemberMembership.create([{
          member: member._id,
          membershipPlan: plan._id,
          startDate,
          endDate,
          status: 'pending',
          paymentStatus: 'pending',
          action: 'new_membership',
          requestedSlot: draft.selection.slot,
          requestedTrainer: draft.selection.trainer,
          totalAmount: plan.price,
          amountPaid: 0,
          pendingAmount: plan.price,
        }], { session });
        const transactionId = `TXN${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
        await Payment.create([{
          member: member._id,
          membership: membership._id,
          transactionId,
          amount: plan.price,
          paymentMethod: 'cash',
          paymentStatus: 'pending',
          action: 'new_membership',
          notes: 'Registration awaiting authorized payment confirmation',
        }], { session });
        await User.updateOne({ _id: draft.user }, { $set: { isActive: false } }, { session });
        draft.member = member._id;
        draft.membership = membership._id;
        draft.status = 'pending_payment';
        await draft.save({ session });
        result = { memberId: member._id, memberCode: member.memberId, membershipId: membership._id, status: draft.status };
      });
    } finally {
      await session.endSession();
    }
    res.status(201).json({
      success: true,
      message: 'Registration saved and awaiting authorized payment confirmation.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

exports.getRegistrationSummary = async (req, res, next) => {
  try {
    const draft = await getDraft(req);
    const user = await User.findById(draft.user).select('email');
    const plan = draft.selection?.plan ? await MembershipPlan.findById(draft.selection.plan) : null;
    const slot = draft.selection?.slot ? await GymTimeSlot.findById(draft.selection.slot) : null;
    const trainer = draft.selection?.trainer ? await TrainerProfile.findById(draft.selection.trainer) : null;
    res.status(200).json({
      success: true,
      data: {
        email: user?.email,
        basicDetails: draft.basicDetails,
        healthDetails: draft.healthDetails,
        selection: { plan, slot, trainer },
        status: draft.status,
        memberId: draft.member,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.resumeRegistration = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || password.length > 72) throw makeError('Enter your registration email and password', 400);
    const user = await User.findOne({ email: email.trim().toLowerCase(), role: 'member' }).select('+password');
    if (!user || !await user.matchPassword(password)) throw makeError('Invalid registration credentials', 401);
    const draft = await RegistrationDraft.findOne({ user: user._id, status: { $in: ['in_progress', 'pending_payment', 'completed'] } });
    if (!draft) throw makeError('No resumable registration found. Sign in if your account is active.', 404);
    const rawToken = crypto.randomBytes(32).toString('hex');
    draft.tokenHash = tokenHash(rawToken); draft.lastActivityAt = new Date(); await draft.save();
    res.json({ success: true, data: { registrationToken: rawToken, status: draft.status } });
  } catch (error) { next(error); }
};
