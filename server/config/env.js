const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const configuredOrigins = (process.env.FRONTEND_URL || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const productionAllowedOrigins = [
  'https://gym-management-app-wine-ten.vercel.app',
  /https:\/\/.*\.vercel\.app$/,
];
const localDevelopmentOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
];

function biometricKeys() {
  try {
    const keys = JSON.parse(process.env.BIOMETRIC_ENCRYPTION_KEYS || '{}');
    if (!keys || typeof keys !== 'object' || Array.isArray(keys)) throw new Error();
    return keys;
  } catch { throw new Error('BIOMETRIC_ENCRYPTION_KEYS must be a JSON keyring object'); }
}

const config = {
  port: process.env.PORT === undefined ? 5000 : Number(process.env.PORT),
  nodeEnv,
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
    origin: [/.*/, ...productionAllowedOrigins, ...new Set([...configuredOrigins, ...localDevelopmentOrigins])],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Registration-Token'],
    optionsSuccessStatus: 204,
  },
  biometric: {
    keyVersion: process.env.BIOMETRIC_KEY_VERSION || 'v1',
    keys: biometricKeys(),
    retainImages: process.env.BIOMETRIC_RETAIN_IMAGES === 'true',
    cooldownSeconds: Number(process.env.BIOMETRIC_COOLDOWN_SECONDS || 60),
    rearmSeconds: Number(process.env.BIOMETRIC_REARM_SECONDS || 5),
    staleHours: Number(process.env.BIOMETRIC_STALE_SESSION_HOURS || 16),
    stalePolicy: process.env.BIOMETRIC_STALE_SESSION_POLICY || 'review',
    identificationMode: process.env.BIOMETRIC_IDENTIFICATION_MODE || 'disabled',
    localServiceUrl: process.env.MORFIN_AUTH_SERVICE_URL || 'https://localhost:8030/morfinauth',
    searchMaxCandidates: Number(process.env.BIOMETRIC_SEARCH_MAX_CANDIDATES || 100),
    searchTimeoutMs: Number(process.env.BIOMETRIC_SEARCH_TIMEOUT_MS || 15000),
  },
  payment: {
    enabled: process.env.PAYMENT_GATEWAY_ENABLED === 'true',
    currency: 'inr',
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID,
      keySecret: process.env.RAZORPAY_KEY_SECRET,
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
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
    branchId: process.env.GYM_BRANCH_ID || 'main',
    timezone: process.env.GYM_TIMEZONE || 'Asia/Kolkata',
    name: process.env.GYM_NAME || 'Vino Fitness Studio',
    address: process.env.GYM_ADDRESS || 'MG Road, Bengaluru',
    phone: process.env.GYM_PHONE,
    email: process.env.GYM_EMAIL,
  },
};

config.validate = () => {
  if (!['disabled', 'morfin-local-development', 'kiosk-assisted'].includes(config.biometric.identificationMode)) throw new Error('Invalid BIOMETRIC_IDENTIFICATION_MODE');
  if (config.biometric.identificationMode === 'morfin-local-development' && config.nodeEnv === 'production' && !process.env.ALLOW_LOCAL_BIOMETRICS_IN_PROD) {
    throw new Error('Local MorFinAuth template search requires local Windows PC; set BIOMETRIC_IDENTIFICATION_MODE=kiosk-assisted for hosted production');
  }
  if (!Number.isInteger(config.biometric.searchMaxCandidates) || config.biometric.searchMaxCandidates < 1 || config.biometric.searchMaxCandidates > 500) throw new Error('BIOMETRIC_SEARCH_MAX_CANDIDATES must be between 1 and 500');
  if (!Number.isInteger(config.biometric.searchTimeoutMs) || config.biometric.searchTimeoutMs < 1000 || config.biometric.searchTimeoutMs > 20000) throw new Error('BIOMETRIC_SEARCH_TIMEOUT_MS must be between 1000 and 20000');

  for (const [key, max] of [['cooldownSeconds', 3600], ['rearmSeconds', 60], ['staleHours', 168]]) {
    if (!Number.isInteger(config.biometric[key]) || config.biometric[key] < 1 || config.biometric[key] > max) throw new Error('Invalid biometric policy: ' + key);
  }
  if (!['review', 'allow_checkout'].includes(config.biometric.stalePolicy)) throw new Error('Invalid biometric stale-session policy');

  if (!/^[A-Za-z0-9_-]{1,64}$/.test(config.gym.branchId)) throw new Error('Invalid GYM_BRANCH_ID');
  const versions = Object.keys(config.biometric.keys);
  if (versions.length) {
    for (const version of versions) require('../services/biometricCrypto').keyFor(version);
    require('../services/biometricCrypto').keyFor(config.biometric.keyVersion);
  }
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
    if (process.env.FRONTEND_URL && process.env.FRONTEND_URL !== '*') {
      for (const origin of config.cors.origin) {
        if (origin instanceof RegExp || origin === '*') continue;
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
  }
};

module.exports = config;
