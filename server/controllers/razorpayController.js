const crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('../config/env');
const MemberProfile = require('../models/MemberProfile');
const MemberMembership = require('../models/MemberMembership');
const RegistrationDraft = require('../models/RegistrationDraft');
const GymTimeSlot = require('../models/GymTimeSlot');
const { settlePayment } = require('./paymentController');
const { failure, validateSlotHours } = require('../utils/schedule');
const { checkTrainer } = require('../services/allocationService');

const credentials = () => {
  const { keyId, keySecret } = config.payment.razorpay;
  if (!config.payment.enabled || !keyId || !keySecret) {
    throw Object.assign(new Error('Razorpay is not configured. Your registration is saved; try payment later.'), { statusCode: 503 });
  }
  return { keyId, keySecret };
};

const razorpayRequest = async (path, options = {}) => {
  const { keyId, keySecret } = credentials();
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data.error?.description || 'Razorpay request failed'), { statusCode: response.status >= 500 ? 502 : 400 });
  }
  return data;
};

const authorizedMembership = async (req) => {
  let membership;
  const token = req.get('x-registration-token');
  if (token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const draft = await RegistrationDraft.findOne({ tokenHash, status: 'pending_payment' });
    membership = draft?.membership && await MemberMembership.findById(draft.membership);
  } else if (req.user) {
    membership = mongoose.isValidObjectId(req.body.membershipId) && await MemberMembership.findById(req.body.membershipId);
    if (membership && req.user.role === 'member' && !await MemberProfile.exists({ _id: membership.member, user: req.user.id })) membership = null;
    if (!['admin', 'reception', 'member'].includes(req.user.role)) membership = null;
  }
  if (!membership) throw Object.assign(new Error('Membership unavailable'), { statusCode: 403 });
  if (!['pending', 'active'].includes(membership.status) || membership.pendingAmount <= 0) throw failure('Membership has no payable balance');
  return membership;
};

const checkoutData = (order) => ({
  keyId: credentials().keyId,
  orderId: order.id,
  amount: order.amount,
  currency: order.currency,
  name: config.gym.name,
  description: 'Vino Fitness Studio membership',
});

const settleCapturedPayment = async (membership, order, payment) => {
  const member = await MemberProfile.findById(membership.member);
  if (!member) throw failure('Member profile is unavailable');
  const verifiedCheckout = {
    id: order.id,
    payment_status: 'paid',
    currency: 'inr',
    amount_total: order.amount,
    payment_intent: payment.id,
  };
  const request = {
    body: { memberId: String(member._id), membershipId: String(membership._id), amount: order.amount / 100,
      paymentMethod: 'online_gateway', idempotencyKey: `razorpay-${payment.id}` },
    get: (name) => name === 'Idempotency-Key' ? `razorpay-${payment.id}` : undefined,
    user: { id: member.user.toString(), role: 'member' },
  };
  return new Promise((resolve, reject) => {
    let status = 200;
    settlePayment(request, {
      status(code) { status = code; return this; },
      json(data) {
        if (status >= 400 || data.success === false) reject(failure(data.error || 'Payment could not be fulfilled'));
        else resolve(data);
        return data;
      },
    }, reject, verifiedCheckout);
  });
};

exports.checkout = async (req, res, next) => {
  try {
    let membership = await authorizedMembership(req);
    if (membership.gatewayOrderId?.startsWith('order_')) {
      const existing = await razorpayRequest(`/orders/${membership.gatewayOrderId}`);
      if (['created', 'attempted'].includes(existing.status)) return res.json({ success: true, data: checkoutData(existing) });
      if (existing.status === 'paid') {
        const payments = await razorpayRequest(`/orders/${existing.id}/payments`);
        const captured = payments.items?.find((payment) => payment.status === 'captured');
        if (!captured) throw failure('Payment is processing. Refresh registration status shortly.');
        await settleCapturedPayment(membership, existing, captured);
        return res.json({ success: true, data: { completed: true } });
      }
    }
    const slot = membership.requestedSlot && await GymTimeSlot.findById(membership.requestedSlot);
    if (slot) {
      if (slot.currentCapacity >= slot.maxCapacity) throw failure('Requested slot is full. Contact reception to choose another slot before paying.');
      await validateSlotHours(slot);
    }
    if (membership.requestedTrainer) await checkTrainer(membership.requestedTrainer, slot);
    membership = await MemberMembership.findOneAndUpdate(
      { _id: membership._id, checkoutAttempt: { $exists: false } },
      { $set: { checkoutAttempt: crypto.randomUUID() } },
      { returnDocument: 'after' },
    ) || await MemberMembership.findById(membership._id);
    const order = await razorpayRequest('/orders', {
      method: 'POST',
      body: JSON.stringify({
        amount: Math.round(membership.pendingAmount * 100),
        currency: 'INR',
        receipt: `membership_${membership._id}_${membership.checkoutAttempt}`.slice(0, 40),
        notes: { membershipId: String(membership._id) },
      }),
    });
    await MemberMembership.updateOne({ _id: membership._id }, { $set: { gatewayOrderId: order.id } });
    res.json({ success: true, data: checkoutData(order) });
  } catch (error) { next(error); }
};

exports.verify = async (req, res, next) => {
  try {
    const membership = await authorizedMembership(req);
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
    if (![orderId, paymentId, signature].every((value) => typeof value === 'string' && value.length > 0)) throw failure('Razorpay payment response is incomplete');
    if (membership.gatewayOrderId !== orderId) throw failure('Razorpay order does not match this membership');
    const expected = crypto.createHmac('sha256', credentials().keySecret).update(`${orderId}|${paymentId}`).digest('hex');
    const validSignature = signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!validSignature) throw Object.assign(new Error('Razorpay payment signature is invalid'), { statusCode: 400 });
    const [order, payment] = await Promise.all([
      razorpayRequest(`/orders/${orderId}`),
      razorpayRequest(`/payments/${paymentId}`),
    ]);
    if (payment.order_id !== orderId || payment.status !== 'captured' || order.status !== 'paid' ||
        payment.currency !== 'INR' || payment.amount !== order.amount || order.amount !== Math.round(membership.pendingAmount * 100)) {
      throw failure('Razorpay payment is not captured or does not match the membership balance');
    }
    const result = await settleCapturedPayment(membership, order, payment);
    res.status(201).json(result);
  } catch (error) { next(error); }
};

exports.cancelCheckout = async (req, res, next) => {
  try {
    const membership = await authorizedMembership(req);
    if (membership.gatewayOrderId?.startsWith('order_')) {
      const order = await razorpayRequest(`/orders/${membership.gatewayOrderId}`);
      if (order.status !== 'created') throw failure('A payment attempt exists; verify its status before starting another checkout.');
    }
    await MemberMembership.updateOne({ _id: membership._id }, { $unset: { checkoutAttempt: 1, gatewayOrderId: 1 } });
    res.json({ success: true });
  } catch (error) { next(error); }
};

exports.refund = async (paymentId, amount, receipt) => razorpayRequest(`/payments/${paymentId}/refund`, {
  method: 'POST',
  body: JSON.stringify({ amount, speed: 'normal', notes: { receipt } }),
});

exports.razorpayRequest = razorpayRequest;
