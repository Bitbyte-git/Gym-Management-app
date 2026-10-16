const express = require('express');
const router = express.Router();
const { protect, authorize, authorizeMemberParam, authorizeMemberRecord } = require('../middleware/auth');
const Payment = require('../models/Payment');
const auditLogger = require('../middleware/auditLogger');
const {
  getPayments,
  getPayment,
  getMemberPayments,
  createPayment,
  processOnlinePayment,
  refundPayment,
  getPendingDues,
  getRevenueReport,
} = require('../controllers/paymentController');

const stripe = require('../controllers/stripeController');
router.post('/stripe/checkout', protect, stripe.checkout);
router.post('/stripe/cancel', protect, stripe.cancelCheckout);
router.get('/stripe/events', protect, authorize('admin'), stripe.getEvents);
router.post('/stripe/events/:id/retry', protect, authorize('admin'), stripe.retry);

// Specific routes first
router.post('/online', protect, processOnlinePayment);
router.get('/pending-dues', protect, authorize('admin', 'reception'), getPendingDues);
router.get('/revenue', protect, authorize('admin'), getRevenueReport);
router.get('/member/:memberId', protect, authorizeMemberParam('memberId', { allowTrainer: false }), getMemberPayments);

// Generic routes
router
  .route('/')
  .get(protect, authorize('admin', 'reception'), getPayments)
  .post(protect, authorize('admin', 'reception'), auditLogger('record_payment', 'payment'), createPayment);

router
  .route('/:id')
  .get(
    protect,
    authorizeMemberRecord(async (req) => {
      const payment = await Payment.findById(req.params.id).select('member');
      return payment?.member;
    }, { allowTrainer: false }),
    getPayment
  );

router.post('/:id/refund', protect, authorize('admin'), auditLogger('refund', 'payment'), refundPayment);

module.exports = router;
