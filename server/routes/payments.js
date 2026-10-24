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

const razorpay = require('../controllers/razorpayController');
router.post('/razorpay/checkout', protect, razorpay.checkout);
router.post('/razorpay/verify', protect, razorpay.verify);
router.post('/razorpay/cancel', protect, razorpay.cancelCheckout);

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
