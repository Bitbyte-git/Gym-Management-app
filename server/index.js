const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const config = require('./config/env');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const memberRoutes = require('./routes/members');
const trainerRoutes = require('./routes/trainers');
const membershipPlanRoutes = require('./routes/membershipPlans');
const membershipRoutes = require('./routes/memberships');
const paymentRoutes = require('./routes/payments');
const attendanceRoutes = require('./routes/attendance');
const biometricRoutes = require('./routes/biometrics');
const trainerAllocationRoutes = require('./routes/trainerAllocations');
const trainerAvailabilityRoutes = require('./routes/trainerAvailabilities');
const gymTimingRoutes = require('./routes/gymTimings');
const timeSlotRoutes = require('./routes/timeSlots');
const notificationRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');
const reportRoutes = require('./routes/reports');
const settingRoutes = require('./routes/settings');
const auditLogRoutes = require('./routes/auditLogs');
const registrationRoutes = require('./routes/registration');

const app = express();

// Middleware
app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', 1);
app.use(helmet());
app.use(cors(config.cors));
app.post('/api/payments/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), require('./controllers/stripeController').webhook);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

const createRateLimiter = (windowMs, limit, message) => rateLimit({
  windowMs,
  limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ success: false, error: message }),
});
app.use('/api/auth', createRateLimiter(15 * 60 * 1000, 10, 'Too many authentication attempts. Try again later.'));
app.use('/api/registration', createRateLimiter(15 * 60 * 1000, 30, 'Too many registration requests. Try again later.'));
app.use('/api/payments', createRateLimiter(60 * 1000, 20, 'Too many payment requests. Try again later.'));
app.use('/api/attendance', createRateLimiter(60 * 1000, 30, 'Too many attendance requests. Try again later.'));

app.use('/api', require('./middleware/queryValidation'));

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/trainers', trainerRoutes);
app.use('/api/membership-plans', membershipPlanRoutes);
app.use('/api/memberships', membershipRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/biometrics', biometricRoutes);
app.use('/api/trainer-allocations', trainerAllocationRoutes);
app.use('/api/trainer-availabilities', trainerAvailabilityRoutes);
app.use('/api/gym-timings', gymTimingRoutes);
app.use('/api/time-slots', timeSlotRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/registration', registrationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const databaseReady = require('mongoose').connection.readyState === 1;
  res.status(databaseReady ? 200 : 503).json({
    success: databaseReady,
    message: databaseReady ? 'PulseFit API is ready' : 'PulseFit API database is unavailable',
    database: databaseReady ? 'connected' : 'unavailable',
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use(errorHandler);

const PORT = config.port;

const start = async () => {
  config.validate();
  await connectDB();
  await require('./services/lifecycleService').reconcile();
  const lifecycleTimer = setInterval(() => require('./services/lifecycleService').reconcile().catch(error => console.error(JSON.stringify({ event: 'lifecycle_error', message: error.message }))), 60000);
  lifecycleTimer.unref();
  return app.listen(PORT, () => {
    console.log(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
};

if (require.main === module) {
  start().then((server) => {
    let shuttingDown = false;
    const shutdown = (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`Received ${signal}; closing HTTP and database connections`);
      server.close((error) => {
        if (error) {
          console.error(`HTTP server shutdown failed: ${error.message}`);
          process.exitCode = 1;
        }
        require('mongoose').disconnect().catch((disconnectError) => {
          console.error(`MongoDB shutdown failed: ${disconnectError.message}`);
          process.exitCode = 1;
        });
      });
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }).catch((error) => {
    console.error(`Server startup failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { app, start };
