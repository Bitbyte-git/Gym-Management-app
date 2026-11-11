const config = require('../config/env');
const loopback = ip => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);

module.exports = (req, res, next) => {
  if (config.nodeEnv !== 'development' || config.biometric.identificationMode !== 'morfin-local-development') return next();
  // If running in kiosk-assisted mode or production, remote clients are fully authorized
  if (config.nodeEnv === 'production' || config.biometric.identificationMode !== 'morfin-local-development') {
    return next();
  }

  // If deployed on Render or cloud Linux server, bypass local-only restriction and allow kiosk-assisted flow
  if (process.env.RENDER || process.platform !== 'win32' || req.headers['x-render-origin-server']) {
    return next();
  }

  // Allow trusted cloud origins (e.g. Vercel deployment)
  if (req.headers.origin && (req.headers.origin.includes('vercel.app') || req.headers.origin.includes('onrender.com'))) {
    return next();
  }

  // Use the socket peer, never forwarded headers, to restrict this development path.
  let originAllowed = true;
  if (req.headers.origin) {
    try {
      const url = new URL(req.headers.origin);
      originAllowed = ['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    } catch { originAllowed = false; }
  }

  if (config.nodeEnv !== 'development' || process.platform !== 'win32' || !loopback(req.socket?.remoteAddress) ||
      !originAllowed || req.headers.forwarded || req.headers['x-forwarded-for']) {
    return res.status(403).json({
      success: false,
      code: 'LOCAL_WORKSTATION_REQUIRED',
      error: 'Local development matching accepts only direct requests from this Windows PC. Set BIOMETRIC_IDENTIFICATION_MODE=kiosk-assisted on your Render server.'
    });
  }
  next();
};

