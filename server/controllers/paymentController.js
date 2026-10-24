const dateRange = require('../utils/dateRange');
const { assignTrainer } = require('../services/allocationService');
const { validateSlotHours } = require('../utils/schedule');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const Payment = require('../models/Payment');
const MemberMembership = require('../models/MemberMembership');
const MemberProfile = require('../models/MemberProfile');
const MemberSlotAllocation = require('../models/MemberSlotAllocation');
const GymTimeSlot = require('../models/GymTimeSlot');
const RegistrationDraft = require('../models/RegistrationDraft');
const TrainerProfile = require('../models/TrainerProfile');
const TrainerClientAllocation = require('../models/TrainerClientAllocation');
const TrainerAvailability = require('../models/TrainerAvailability');
const User = require('../models/User');
const MembershipPlan = require('../models/MembershipPlan');
const SystemSetting = require('../models/SystemSetting');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { addMonthsClamped } = require('../utils/date');
const config = require('../config/env');

// Generate unique transaction ID
const generateTransactionId = () => {
  return `TXN${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};
const matchesIdempotentPaymentRequest = (payment, { memberId, membershipId, amount }) =>
  payment.member.toString() === String(memberId) &&
  payment.membership?.toString() === String(membershipId) &&
  Number(payment.amount) === Number(amount);

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private (Admin, Reception)
exports.getPayments = async (req, res, next) => {
  try {
    const payments = await Payment.find((req.query.startDate || req.query.endDate) ? { paymentDate: dateRange(req.query.startDate, req.query.endDate) } : {})
      .populate('member', 'memberId fullName mobileNumber')
      .populate('membership', 'startDate endDate')
      .sort({ paymentDate: -1 });

    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single payment
// @route   GET /api/payments/:id
// @access  Private
exports.getPayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('member', 'memberId fullName mobileNumber address')
      .populate({
        path: 'membership',
        select: 'membershipPlan startDate endDate totalAmount amountPaid pendingAmount status paymentStatus action',
        populate: { path: 'membershipPlan', select: 'name duration description' },
      });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ...payment.toObject(),
        receiptIssuer: {
          name: config.gym.name,
          address: config.gym.address,
          phone: config.gym.phone,
          email: config.gym.email,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get member's payment history
// @route   GET /api/payments/member/:memberId
// @access  Private
exports.getMemberPayments = async (req, res, next) => {
  try {
    const payments = await Payment.find({ member: req.params.memberId })
      .populate('membership')
      .sort({ paymentDate: -1 });

    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create payment record
// @route   POST /api/payments
// @access  Private (Admin, Reception)
exports.createPayment = (req, res, next) => exports.settlePayment(req, res, next);
exports.settlePayment = async (req, res, next, verifiedCheckout = null) => {
  try {
    const { memberId, membershipId, amount, paymentMethod, action, notes, cashReceived } = req.body;
    const rawIdempotencyKey = req.get('Idempotency-Key') || req.body.idempotencyKey;
    const idempotencyKey = typeof rawIdempotencyKey === 'string' ? rawIdempotencyKey.trim() : '';
    if (!idempotencyKey || idempotencyKey.length > 128) {
      return res.status(400).json({ success: false, error: 'A valid Idempotency-Key is required' });
    }
    if (!mongoose.isValidObjectId(memberId) || !mongoose.isValidObjectId(membershipId)) {
      return res.status(400).json({ success: false, error: 'Valid member and membership IDs are required' });
    }
    if (action !== undefined &&
        !['new_membership', 'renewal', 'upgrade', 'downgrade', 'pending_dues'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid payment action' });
    }
    if (notes !== undefined && (typeof notes !== 'string' || notes.length > 500)) {
      return res.status(400).json({ success: false, error: 'Payment notes must be 500 characters or fewer' });
    }
    if (!verifiedCheckout && (paymentMethod !== 'cash' || cashReceived !== true)) {
      return res.status(400).json({
        success: false,
        error: 'Only staff-confirmed cash receipts can be recorded through this endpoint. Other payment methods require gateway verification.',
      });
    }
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0 || Math.abs(Number(amount) * 100 - Math.round(Number(amount) * 100)) > 0.000001) {
      return res.status(400).json({ success: false, error: 'Payment amount must be greater than zero' });
    }

    const prior = await Payment.findOne({ idempotencyKey });
    if (prior) {
      if (!matchesIdempotentPaymentRequest(prior, { memberId, membershipId, amount })) {
        return res.status(409).json({ success: false, error: 'Idempotency key was already used for a different payment request' });
      }
      return res.status(200).json({ success: true, data: prior, idempotentReplay: true });
    }
    const session = await MemberProfile.startSession();
    let payment;
    try {
      await session.withTransaction(async () => {
        const member = await MemberProfile.findById(memberId).session(session);
        if (!member) {
          const error = new Error('Member not found');
          error.statusCode = 404;
          throw error;
        }
        const membership = await MemberMembership.findById(membershipId).session(session);
        if (!membership || !membership.member.equals(member._id)) {
          const error = new Error('Membership not found for this member');
          error.statusCode = 404;
          throw error;
        }
        if (['cancelled', 'frozen', 'expired'].includes(membership.status)) {
          const error = new Error('Payments cannot reactivate a cancelled, frozen, or expired membership. Create an eligible renewal instead.');
          error.statusCode = 409;
          throw error;
        }
        if (membership.status === 'active' && membership.endDate < new Date()) {
          const error = new Error('This membership has expired. Create a renewal instead of paying against the expired term.');
          error.statusCode = 409;
          throw error;
        }
        if (!verifiedCheckout && (membership.gatewayOrderId || membership.checkoutAttempt)) {
          throw Object.assign(new Error('An online checkout is pending. Cancel it before recording cash.'), { statusCode: 409 });
        }
        if (verifiedCheckout && (membership.gatewayOrderId !== verifiedCheckout.id ||
            verifiedCheckout.payment_status !== 'paid' || verifiedCheckout.currency !== 'inr' ||
            verifiedCheckout.amount_total !== Math.round(membership.pendingAmount * 100))) {
          throw Object.assign(new Error('Gateway payment does not match this membership balance'), { statusCode: 409 });
        }
        const due = Number(membership.pendingAmount);
        const paymentAmount = Number(amount);
        const partialSetting = await SystemSetting.findOne({ key: 'allow_partial_payments' }).session(session);
        const partialPaymentsEnabled = partialSetting?.value === true;
        if (membership.paymentStatus === 'paid' || due <= 0) {
          const error = new Error('This membership has no outstanding balance');
          error.statusCode = 409;
          throw error;
        }
        if (paymentAmount > due || (paymentAmount < due && !partialPaymentsEnabled)) {
          const error = new Error(paymentAmount > due
            ? 'Payment cannot exceed the outstanding balance'
            : 'Partial payments are disabled; the amount must equal the outstanding balance');
          error.statusCode = 400;
          throw error;
        }

        if (membership.action === 'new_membership' && await MemberMembership.exists({
          member: member._id, _id: { $ne: membership._id }, status: 'active', paymentStatus: 'paid',
          endDate: { $gt: new Date() },
        }).session(session)) throw Object.assign(new Error('A current membership exists. Use renewal or upgrade.'), { statusCode: 409 });
        const registration = await RegistrationDraft.findOne({ member: member._id }).session(session);
        const planId = membership.membershipPlan;
        const fullyPaid = paymentAmount === due;
        let existingAllocation;
        if (fullyPaid) {
          existingAllocation = await MemberSlotAllocation.findOne({
            member: member._id,
            status: 'active',
          }).session(session);
          const requestedTrainer = membership.requestedTrainer !== undefined ? membership.requestedTrainer : registration?.selection?.trainer;
          if (requestedTrainer && !await TrainerClientAllocation.exists({ member: member._id, status: 'active' }).session(session)) {
            const requestedSlotId = membership.requestedSlot || registration?.selection?.slot || existingAllocation?.timeSlot;
            const slot = await GymTimeSlot.findById(requestedSlotId).session(session);
            await assignTrainer({ trainerId: requestedTrainer, memberId: member._id, slot, session, assignedBy: req.user.id });
          }
        }

        const pendingPayment = await Payment.findOne({
          membership: membership._id,
          paymentStatus: 'pending',
        }).session(session);
        if (pendingPayment) {
          pendingPayment.amount = paymentAmount;
          pendingPayment.paymentMethod = verifiedCheckout ? 'online_gateway' : 'cash';
          if (verifiedCheckout) pendingPayment.gatewayTransactionId = verifiedCheckout.payment_intent;
          pendingPayment.paymentStatus = 'completed';
          pendingPayment.paymentDate = new Date();
          pendingPayment.processedBy = req.user.id;
          pendingPayment.idempotencyKey = idempotencyKey;
          pendingPayment.notes = notes || pendingPayment.notes;
          payment = await pendingPayment.save({ session });
        } else {
          [payment] = await Payment.create([{
            member: member._id,
            membership: membership._id,
            transactionId: generateTransactionId(),
            idempotencyKey,
            amount: paymentAmount,
            paymentMethod: verifiedCheckout ? 'online_gateway' : 'cash',
            gatewayTransactionId: verifiedCheckout?.payment_intent,
            paymentStatus: 'completed',
            action: action || 'pending_dues',
            notes,
            processedBy: req.user.id,
          }], { session });
        }

        membership.amountPaid += paymentAmount;
        membership.pendingAmount = Math.max(0, due - paymentAmount);
        membership.paymentStatus = membership.pendingAmount === 0
          ? 'paid'
          : (membership.amountPaid > 0 ? 'partial' : 'pending');
        membership.lastPaymentDate = new Date();
        if (verifiedCheckout) {
          membership.gatewayOrderId = undefined;
          membership.checkoutAttempt = undefined;
        }
        if (membership.status === 'pending' && fullyPaid) {
          const plan = await MembershipPlan.findById(membership.membershipPlan).session(session);
          if (!plan) {
            const error = new Error('Membership plan is no longer available');
            error.statusCode = 409;
            throw error;
          }
          membership.status = 'active';
          if (membership.action === 'new_membership') {
            membership.startDate = new Date();
            membership.endDate = addMonthsClamped(membership.startDate, plan.duration);
          } else if (membership.action === 'renewal') {
            const current = await MemberMembership.findOne({
              member: member._id,
              status: 'active',
              _id: { $ne: membership._id },
            }).sort({ endDate: -1 }).session(session);
            membership.startDate = current && current.endDate > new Date()
              ? current.endDate
              : new Date();
            membership.endDate = addMonthsClamped(membership.startDate, plan.duration);
          }
        }
        if (fullyPaid) {
          const requestedSlot = membership.requestedSlot ||
            registration?.selection?.slot ||
            existingAllocation?.timeSlot;
          const renewalStartsLater = membership.action === 'renewal' &&
            membership.startDate > new Date() &&
            Boolean(existingAllocation);
          if (renewalStartsLater && requestedSlot &&
              !existingAllocation.timeSlot.equals(requestedSlot)) {
            const error = new Error('A future renewal must retain the current time slot; schedule slot changes separately after the renewal starts.');
            error.statusCode = 409;
            throw error;
          }
          if (renewalStartsLater) {
            existingAllocation.endDate = membership.endDate;
            await existingAllocation.save({ session });
          }
          if (!renewalStartsLater && requestedSlot &&
              (!existingAllocation || !existingAllocation.timeSlot.equals(requestedSlot))) {
            const slot = await GymTimeSlot.findOneAndUpdate({
              _id: requestedSlot,
              status: 'active',
              $expr: { $lt: ['$currentCapacity', '$maxCapacity'] },
              $or: [{ eligiblePlans: { $size: 0 } }, { eligiblePlans: planId }],
            }, { $inc: { currentCapacity: 1 } }, { returnDocument: 'after', session });
            if (!slot) {
              const error = new Error('The requested time slot is no longer available. Select another slot before accepting payment.');
              error.statusCode = 409;
              throw error;
            }
            await validateSlotHours(slot, session);
            if (existingAllocation) {
              existingAllocation.status = 'cancelled';
              existingAllocation.endDate = new Date();
              await existingAllocation.save({ session });
              const oldSlot = await GymTimeSlot.findOneAndUpdate({
                _id: existingAllocation.timeSlot,
                currentCapacity: { $gt: 0 },
              }, { $inc: { currentCapacity: -1 } }, { session });
              if (!oldSlot) {
                const error = new Error('Existing slot capacity is inconsistent; payment was not accepted');
                error.statusCode = 409;
                throw error;
              }
            }
            await MemberSlotAllocation.create([{
              member: member._id,
              timeSlot: slot._id,
              membership: membership._id,
              startDate: membership.startDate,
              endDate: membership.endDate,
              allocatedBy: req.user.id,
            }], { session });
          } else if (existingAllocation && !renewalStartsLater) {
            const retainedSlot = await GymTimeSlot.findOne({ _id: existingAllocation.timeSlot, status: 'active',
              $or: [{ eligiblePlans: { $size: 0 } }, { eligiblePlans: planId }] }).session(session);
            if (!retainedSlot) throw Object.assign(new Error('Current slot is not eligible for this plan'), { statusCode: 409 });
            await validateSlotHours(retainedSlot, session);
            existingAllocation.membership = membership._id;
            existingAllocation.startDate = membership.startDate;
            existingAllocation.endDate = membership.endDate;
            await existingAllocation.save({ session });
          }
        }
        if (fullyPaid && membership.action === 'upgrade') {
          await MemberMembership.updateMany({
            member: member._id,
            status: 'active',
            _id: { $ne: membership._id },
          }, { $set: { status: 'expired' } }, { session });
        }
        await membership.save({ session });

        const membershipIsCurrent = membership.status === 'active' &&
          membership.paymentStatus === 'paid' &&
          membership.startDate <= new Date() &&
          membership.endDate >= new Date();
        if (fullyPaid && membershipIsCurrent) {
          if (member.registrationStatus === 'pending_payment') {
            member.registrationStatus = 'active';
            await User.updateOne({ _id: member.user, isActive: false }, { $set: { isActive: true } }, { session });
          }
          member.membershipStatus = 'active';
          await member.save({ session });
        }
        await Notification.create([{
          recipient: member.user, type: 'payment_receipt', title: 'Payment received',
          message: `Payment ${payment.transactionId}: INR ${payment.amount}. Membership ${membership.status}.`,
          relatedData: { payment: payment._id, membership: membership._id }, deliveryStatus: 'sent', sentVia: ['in_app'],
        }], { session });
        await AuditLog.create([{ user: req.user.id, action: 'settle_payment', entityType: 'payment',
          entityId: payment._id, changes: { transactionId: payment.transactionId, method: payment.paymentMethod } }], { session });
        if (registration && fullyPaid && membershipIsCurrent) {
          registration.status = 'completed';
          await registration.save({ session });
        }
      });
    } finally {
      await session.endSession();
    }
    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    if (error.code === 11000 && (req.get('Idempotency-Key') || req.body.idempotencyKey)) {
      const prior = await Payment.findOne({ idempotencyKey: req.get('Idempotency-Key') || req.body.idempotencyKey });
      if (prior && matchesIdempotentPaymentRequest(prior, req.body)) {
        return res.status(200).json({ success: true, data: prior, idempotentReplay: true });
      }
      if (prior) {
        return res.status(409).json({ success: false, error: 'Idempotency key was already used for a different payment request' });
      }
    }
    next(error);
  }
};

// @desc    Process online payment (gateway integration placeholder)
// @route   POST /api/payments/online
// @access  Public
exports.processOnlinePayment = async (req, res, next) => {
  const error = new Error('Online payment processing is unavailable until a payment provider and server-side verification flow are configured.');
  error.statusCode = 503;
  next(error);
};

// @desc    Refund payment
// @route   POST /api/payments/:id/refund
// @access  Private (Admin)
exports.refundPayment = (req, res, next) => exports.settleRefund(req, res, next);
exports.settleRefund = async (req, res, next, verifiedRefund = null) => {
  try {
    const { reason, cashRefunded } = req.body;
    if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500) {
      return res.status(400).json({ success: false, error: 'A refund reason of 1-500 characters is required' });
    }
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found',
      });
    }

    if (payment.paymentStatus === 'refunded') return res.json({ success: true, data: payment, idempotentReplay: true });
    if (payment.paymentStatus !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Can only refund completed payments',
      });
    }

    if (payment.paymentMethod === 'online_gateway' && !verifiedRefund) {
      await Payment.findOneAndUpdate({ _id: payment._id, refundRequestedBy: { $exists: false } },
        { $set: { refundRequestedBy: req.user.id, refundReason: reason.trim() } }, { returnDocument: 'after' });
      if (!payment.gatewayTransactionId?.startsWith('pay_')) {
        throw Object.assign(new Error('This payment was not created by Razorpay and requires manual provider reconciliation'), { statusCode: 409 });
      }
      const providerRefund = await require('./razorpayController').refund(
        payment.gatewayTransactionId,
        Math.round(payment.amount * 100),
        `refund-${payment._id}`,
      );
      const refund = {
        id: providerRefund.id,
        payment_intent: providerRefund.payment_id,
        amount: providerRefund.amount,
        currency: providerRefund.currency?.toLowerCase(),
        status: providerRefund.status === 'processed' ? 'succeeded' : providerRefund.status,
      };
      await Payment.updateOne({ _id: payment._id }, { $set: { gatewayRefundId: refund.id } });
      if (refund.status !== 'succeeded') return res.status(202).json({ success: true, message: 'Razorpay refund requested. Waiting for provider confirmation.', data: { refundStatus: refund.status } });
      verifiedRefund = refund;
    }
    if (verifiedRefund && (verifiedRefund.status !== 'succeeded' || verifiedRefund.payment_intent !== payment.gatewayTransactionId ||
        verifiedRefund.amount !== Math.round(payment.amount * 100) || verifiedRefund.currency !== 'inr')) {
      await Payment.updateOne({ _id: payment._id }, { $set: { refundError: 'Provider refund does not match the full payment. Manual reconciliation required.' } });
      throw Object.assign(new Error('Provider refund requires manual reconciliation'), { statusCode: 409 });
    }
    if (!verifiedRefund && (payment.paymentMethod !== 'cash' || cashRefunded !== true)) {
      return res.status(503).json({
        success: false,
        error: 'Confirm an actual cash refund or use the configured provider refund workflow. No refund was recorded.',
      });
    }

    const session = await Payment.startSession();
    try {
      await session.withTransaction(async () => {
        const currentPayment = await Payment.findOne({
          _id: payment._id,
          paymentStatus: 'completed',
        }).session(session);
        if (!currentPayment) {
          const error = new Error('Payment has already been refunded or changed');
          error.statusCode = 409;
          throw error;
        }
        currentPayment.paymentStatus = 'refunded';
        currentPayment.refunds.push({
          amount: currentPayment.amount,
          reason: reason.trim(),
          processedBy: req.user.id,
          gatewayRefundId: verifiedRefund?.id,
        });
        await currentPayment.save({ session });
        if (currentPayment.membership) {
          const membership = await MemberMembership.findById(currentPayment.membership).session(session);
          if (membership) {
            membership.amountPaid = Math.max(0, membership.amountPaid - currentPayment.amount);
            membership.pendingAmount = Math.min(
              membership.totalAmount,
              membership.pendingAmount + currentPayment.amount
            );
            membership.paymentStatus = membership.pendingAmount === 0
              ? 'paid'
              : (membership.amountPaid > 0 ? 'partial' : 'pending');
            membership.gatewayOrderId = undefined;
            membership.checkoutAttempt = undefined;
            await membership.save({ session });
          }
        }
        await AuditLog.create([{ user: req.user.id, action: 'refund_confirmed', entityType: 'payment', entityId: payment._id, changes: { amount: payment.amount, gatewayRefundId: verifiedRefund?.id } }], { session });
      });
    } finally {
      await session.endSession();
    }

    const updatedPayment = await Payment.findById(payment._id);
    res.status(200).json({
      success: true,
      data: updatedPayment,
      message: 'Refund confirmed. Original transaction and refund reason are retained for audit.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get pending dues
// @route   GET /api/payments/pending-dues
// @access  Private (Admin, Reception)
exports.getPendingDues = async (req, res, next) => {
  try {
    const pendingMemberships = await MemberMembership.find({
      paymentStatus: { $in: ['pending', 'partial', 'overdue'] },
      status: { $ne: 'cancelled' },
    })
      .populate('member', 'memberId fullName mobileNumber')
      .populate('membershipPlan', 'name price')
      .sort({ endDate: 1 });

    const totalPending = pendingMemberships.reduce((sum, m) => sum + m.pendingAmount, 0);

    res.status(200).json({
      success: true,
      count: pendingMemberships.length,
      totalPending,
      data: pendingMemberships,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get revenue report
// @route   GET /api/payments/revenue
// @access  Private (Admin)
exports.getRevenueReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    const matchQuery = {
      paymentStatus: 'completed',
    };
    
    if (startDate || endDate) {
      matchQuery.paymentDate = dateRange(startDate, endDate);
    }

    const revenue = await Payment.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            year: { $year: '$paymentDate' },
            month: { $month: '$paymentDate' },
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
    ]);

    const totalRevenue = await Payment.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        monthlyRevenue: revenue,
        totalRevenue: totalRevenue[0] || { total: 0, count: 0 },
      },
    });
  } catch (error) {
    next(error);
  }
};
