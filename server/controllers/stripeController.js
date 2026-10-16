const crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('../config/env');
const User = require('../models/User');
const MemberProfile = require('../models/MemberProfile');
const MemberMembership = require('../models/MemberMembership');
const RegistrationDraft = require('../models/RegistrationDraft');
const StripeEvent = require('../models/StripeEvent');
const { settlePayment } = require('./paymentController');
const { failure, validateSlotHours } = require('../utils/schedule');
const { checkTrainer } = require('../services/allocationService');
const GymTimeSlot = require('../models/GymTimeSlot');
const stripeClient = () => {
  if (!config.payment.enabled || !config.payment.stripeSecretKey || !config.payment.stripeWebhookSecret) {
    throw Object.assign(new Error('Stripe is not configured. Your registration is saved; try payment later.'), { statusCode: 503 });
  }
  return require('stripe')(config.payment.stripeSecretKey);
};
const authorizedMembership = async req => {
  let membership;
  const token = req.get('x-registration-token');
  if (token) {
    const draft = await RegistrationDraft.findOne({ tokenHash: crypto.createHash('sha256').update(token).digest('hex'), status: 'pending_payment' });
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
exports.checkout = async (req, res, next) => {
  try {
    const stripe = stripeClient();
    let membership = await authorizedMembership(req);
    if (membership.stripeCheckoutSession) {
      const existing = await stripe.checkout.sessions.retrieve(membership.stripeCheckoutSession);
      if (existing.status === 'open') return res.json({ success: true, data: { url: existing.url } });
      if (existing.payment_status === 'paid' || existing.status === 'complete') throw failure('Payment is processing. Refresh registration status shortly.');
      await MemberMembership.updateOne({ _id: membership._id, stripeCheckoutSession: existing.id }, { $unset: { stripeCheckoutSession: 1, checkoutAttempt: 1 } });
    }
    const slot = membership.requestedSlot && await GymTimeSlot.findById(membership.requestedSlot);
    if (slot) {
      if (slot.currentCapacity >= slot.maxCapacity) throw failure('Requested slot is full. Contact reception to choose another slot before paying.');
      await validateSlotHours(slot);
    }
    if (membership.requestedTrainer) await checkTrainer(membership.requestedTrainer, slot);
    membership = await MemberMembership.findOneAndUpdate({ _id: membership._id, checkoutAttempt: { $exists: false } },
      { $set: { checkoutAttempt: crypto.randomUUID() } }, { returnDocument: 'after' }) || await MemberMembership.findById(membership._id);
    const origin = config.cors.origin[0];
    const path = req.get('x-registration-token') ? '/register' : '/member/payments';
    const session = await stripe.checkout.sessions.create({ mode: 'payment', payment_method_types: ['card'],
      client_reference_id: String(membership._id), metadata: { membershipId: String(membership._id) },
      line_items: [{ quantity: 1, price_data: { currency: 'inr', unit_amount: Math.round(membership.pendingAmount * 100),
        product_data: { name: 'PulseFit membership' } } }],
      success_url: `${origin}${path}?payment=processing`, cancel_url: `${origin}${path}?payment=cancelled`,
    }, { idempotencyKey: `membership-${membership._id}-${membership.checkoutAttempt}` });
    await MemberMembership.updateOne({ _id: membership._id }, { $set: { stripeCheckoutSession: session.id } });
    res.json({ success: true, data: { url: session.url } });
  } catch (error) { next(error); }
};
const fulfill = async (sessionId, eventId) => {
  const stripe = stripeClient();
  const checkout = await stripe.checkout.sessions.retrieve(sessionId);
  if (checkout.payment_status !== 'paid') return;
  const membershipId = checkout.metadata?.membershipId;
  if (!mongoose.isValidObjectId(membershipId)) throw failure('Stripe session has no valid membership reference');
  const record = await StripeEvent.findOneAndUpdate({ sessionId }, { $setOnInsert: { eventId, membership: membershipId } }, { upsert: true, returnDocument: 'after' });
  if (record.status === 'completed') return;
  try {
    const membership = await MemberMembership.findById(membershipId);
    const member = membership && await MemberProfile.findById(membership.member);
    if (!member || !checkout.payment_intent) throw failure('Payment references are incomplete');
    const request = { body: { memberId: String(member._id), membershipId, amount: checkout.amount_total / 100,
      paymentMethod: 'online_gateway', idempotencyKey: `stripe-${checkout.payment_intent}` },
      get: name => name === 'Idempotency-Key' ? `stripe-${checkout.payment_intent}` : undefined,
      user: { id: member.user.toString(), role: 'member' } };
    let status = 200;
    await settlePayment(request, { status(code) { status = code; return this; }, json(data) {
      if (status >= 400 || data.success === false) throw failure(data.error || 'Payment could not be fulfilled');
      return data;
    } }, error => { throw error; }, checkout);
    await StripeEvent.updateOne({ sessionId }, { $set: { status: 'completed' }, $unset: { lastError: 1 } });
  } catch (error) {
    await StripeEvent.updateOne({ sessionId }, { $set: { status: 'needs_attention', lastError: error.message } });
    throw error;
  }
};
exports.webhook = async (req, res, next) => {
  let event;
  try { event = stripeClient().webhooks.constructEvent(req.body, req.get('stripe-signature'), config.payment.stripeWebhookSecret); }
  catch (error) { return res.status(error.statusCode === 503 ? 503 : 400).json({ success: false, error: 'Stripe webhook is unavailable or signature is invalid' }); }
  try {
    if (['refund.created', 'refund.updated'].includes(event.type)) {
      const refund = await stripeClient().refunds.retrieve(event.data.object.id);
      if (refund.status === 'succeeded') {
        const payment = await require('../models/Payment').findOne({ gatewayTransactionId: refund.payment_intent });
        if (payment && payment.paymentStatus !== 'refunded') {
          let status = 200;
          await require('./paymentController').settleRefund({ params: { id: payment.id }, user: { id: payment.refundRequestedBy }, body: { reason: payment.refundReason || 'Refund confirmed by Stripe' } }, { status(code) { status = code; return this; }, json(data) { if (status >= 400) throw failure(data.error); return data; } }, error => { throw error; }, refund);
        }
      }
    }
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) await fulfill(event.data.object.id, event.id);
    res.json({ received: true });
  } catch (error) { error.statusCode = 500; next(error); }
};
exports.getEvents = async (req, res, next) => {
  try { res.json({ success: true, data: await StripeEvent.find().sort({ updatedAt: -1 }).limit(100) }); } catch (error) { next(error); }
};
exports.retry = async (req, res, next) => {
  try {
    const event = await StripeEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, error: 'Stripe event not found' });
    await fulfill(event.sessionId, event.eventId);
    res.json({ success: true });
  } catch (error) { next(error); }
};
exports.cancelCheckout = async (req, res, next) => {
  try {
    const membership = await authorizedMembership(req);
    if (membership.stripeCheckoutSession) {
      const stripe = stripeClient();
      const checkout = await stripe.checkout.sessions.retrieve(membership.stripeCheckoutSession);
      if (checkout.status === 'complete') throw failure('Completed checkout cannot be cancelled; reconcile the payment.');
      if (checkout.status === 'open') await stripe.checkout.sessions.expire(checkout.id);
    }
    await MemberMembership.updateOne({ _id: membership._id }, { $unset: { checkoutAttempt: 1, stripeCheckoutSession: 1 } });
    res.json({ success: true });
  } catch (error) { next(error); }
};

exports.stripeClient = stripeClient;
