const express = require('express');
const router = express.Router();
const {
  submitBasicDetails,
  submitHealthDetails,
  getAvailablePlans,
  getAvailableSlots,
  getAvailableTrainers,
  submitSelection,
  completeRegistration,
  getRegistrationSummary,
} = require('../controllers/registrationController');

router.post('/resume', require('../controllers/registrationController').resumeRegistration);
router.post('/basic-details', submitBasicDetails);
router.post('/health-details', submitHealthDetails);
router.get('/plans', getAvailablePlans);
router.get('/slots', getAvailableSlots);
router.get('/trainers', getAvailableTrainers);
router.post('/selection', submitSelection);
router.get('/summary', getRegistrationSummary);
router.post('/complete', completeRegistration);
router.post('/checkout', require('../controllers/stripeController').checkout);
router.post('/cancel-checkout', require('../controllers/stripeController').cancelCheckout);

module.exports = router;
