const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
(async () => {
  const config = require('./config/env'); config.validate();
  await require('./config/db')();
  try {
    for (const file of fs.readdirSync(path.join(__dirname, 'models')).filter(file => file.endsWith('.js'))) {
      const model = require(path.join(__dirname, 'models', file));
      await model.createIndexes(); console.log(`Indexes verified: ${model.modelName}`);
    }
  } finally { await mongoose.disconnect(); }
})().catch(error => { console.error(`Index verification failed: ${error.message}`); process.exitCode = 1; });
