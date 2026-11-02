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
  sendReceiptWhatsApp,
  downloadReceiptPdf,
} = require('../controllers/paymentController');

const razorpay = require('../controllers/razorpayController');
router.post('/razorpay/checkout', protect, razorpay.checkout);
router.post('/razorpay/verify', protect, razorpay.verify);
router.post('/razorpay/cancel', protect, razorpay.cancelCheckout);

// Public route for PDF receipt download (used by external WhatsApp Cloud & direct links)
router.get('/public/:id/receipt-pdf', downloadReceiptPdf);

// Specific routes first
router.post('/online', protect, processOnlinePayment);
router.get('/pending-dues', protect, authorize('admin', 'reception'), getPendingDues);
router.get('/revenue', protect, authorize('admin'), getRevenueReport);
router.get('/member/:memberId', protect, authorizeMemberParam('memberId', { allowTrainer: false }), getMemberPayments);

// Send WhatsApp payment receipt (Admin and Reception staff only)
router.post('/:id/send-whatsapp', protect, authorize('admin', 'reception'), auditLogger('send_whatsapp_receipt', 'payment'), sendReceiptWhatsApp);

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
