const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const config = {
  port: process.env.PORT === undefined ? 5000 : Number(process.env.PORT),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI,
  mongodbFallbackHosts: (process.env.MONGODB_FALLBACK_HOSTS || '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean),
  mongodbReplicaSet: process.env.MONGODB_REPLICA_SET,
  trustProxy: process.env.TRUST_PROXY === 'true',
  jwt: {
    secret: process.env.JWT_SECRET,
    expire: process.env.JWT_EXPIRE || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpire: process.env.JWT_REFRESH_EXPIRE || '30d',
  },
  cors: {
    origin: (process.env.FRONTEND_URL || 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: false,
  },
  biometric: {
    rdServiceUrl: process.env.MANTRA_RD_SERVICE_URL || 'http://localhost:10000',
    deviceId: process.env.MANTRA_DEVICE_ID || 'MFS110',
  },
  payment: {
    enabled: process.env.PAYMENT_GATEWAY_ENABLED === 'true',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    currency: 'inr',
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID,
      keySecret: process.env.RAZORPAY_KEY_SECRET,
    },
  },
  sms: {
    enabled: process.env.SMS_ENABLED === 'true',
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    },
  },
  email: {
    enabled: process.env.EMAIL_ENABLED === 'true',
    smtp: {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },
  gym: {
    timezone: process.env.GYM_TIMEZONE || 'Asia/Kolkata',
    name: process.env.GYM_NAME || 'PulseFit Central',
    address: process.env.GYM_ADDRESS || 'MG Road, Bengaluru',
    phone: process.env.GYM_PHONE,
    email: process.env.GYM_EMAIL,
  },
};

config.validate = () => {
  if (!config.mongodbUri) throw new Error('MONGODB_URI must be configured');
  if (config.mongodbFallbackHosts.length > 0 && !config.mongodbReplicaSet) {
    throw new Error('MONGODB_REPLICA_SET is required when MONGODB_FALLBACK_HOSTS is configured');
  }
  const port = Number(config.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port');
  }
  if (config.nodeEnv === 'production') {
    for (const [name, secret] of [
      ['JWT_SECRET', config.jwt.secret],
      ['JWT_REFRESH_SECRET', config.jwt.refreshSecret],
    ]) {
      if (!secret || secret.length < 32 || /change_this|your_super_secret/i.test(secret)) {
        throw new Error(`${name} must be a unique secret of at least 32 characters in production`);
      }
    }
    if (config.jwt.secret === config.jwt.refreshSecret) {
      throw new Error('JWT access and refresh secrets must be different');
    }
    if (!process.env.FRONTEND_URL) {
      throw new Error('FRONTEND_URL must be configured in production');
    }
    for (const origin of config.cors.origin) {
      let parsedOrigin;
      try {
        parsedOrigin = new URL(origin);
      } catch {
        throw new Error('FRONTEND_URL must contain valid origin URLs');
      }
      if (parsedOrigin.protocol !== 'https:' || parsedOrigin.origin !== origin) {
        throw new Error('FRONTEND_URL origins must use HTTPS and must not contain paths');
      }
    }
  }
};

module.exports = config;
