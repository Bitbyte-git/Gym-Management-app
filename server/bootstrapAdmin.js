const mongoose = require('mongoose');
const config = require('./config/env');
const User = require('./models/User');
(async () => {
  config.validate();
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email) || !password || password.length < 12 || password.length > 72) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12?72 characters)');
  await require('./config/db')();
  try {
    await User.init();
    if (await User.exists({ role: 'admin' })) throw new Error('An administrator already exists. Use staff account management.');
    await User.create({ email, password, role: 'admin' });
    console.log('Initial administrator created. Remove ADMIN_PASSWORD from your environment.');
  } finally { await mongoose.disconnect(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
