const User = require('../models/User');

exports.ensureKioskAccount = async () => {
  try {
    const kioskEmail = 'kiosk@pulsefit.com';
    const exists = await User.findOne({ email: kioskEmail });
    if (!exists) {
      await User.create({
        email: kioskEmail,
        password: 'kiosk123',
        role: 'kiosk',
        isActive: true,
      });
      console.log('Default attendance kiosk account initialized: kiosk@pulsefit.com');
    } else if (exists.role !== 'kiosk') {
      exists.role = 'kiosk';
      await exists.save();
    }
  } catch (err) {
    // Non-fatal if database already has user or concurrent start
    console.error('Kiosk account bootstrap notice:', err.message);
  }
};
