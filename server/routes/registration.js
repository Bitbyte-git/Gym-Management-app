const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
  submitBasicDetails,
  submitHealthDetails,
  getAvailablePlans,
  getAvailableSlots,
  getAvailableTrainers,
  submitSelection,
  completeRegistration,
  getRegistrationSummary,
  uploadAvatar,
} = require('../controllers/registrationController');

router.post('/upload-avatar', upload.single('avatar'), uploadAvatar);
router.post('/resume', require('../controllers/registrationController').resumeRegistration);
router.post('/basic-details', submitBasicDetails);
router.post('/health-details', submitHealthDetails);
router.get('/plans', getAvailablePlans);
router.get('/slots', getAvailableSlots);
router.get('/trainers', getAvailableTrainers);
router.post('/selection', submitSelection);
router.get('/summary', getRegistrationSummary);
router.post('/complete', completeRegistration);
router.post('/checkout', require('../controllers/razorpayController').checkout);
router.post('/verify-payment', require('../controllers/razorpayController').verify);
router.post('/cancel-checkout', require('../controllers/razorpayController').cancelCheckout);

module.exports = router;
