// Biometric endpoints are protected by protect and authorize('admin', 'reception').
// Allow authenticated staff requests from both local and hosted deployments.
module.exports = (req, res, next) => {
  next();
};
