const CircuitBreaker = require('opossum');

const defaultOptions = {
  timeout: Number(process.env.CIRCUIT_BREAKER_TIMEOUT) || 6000, // 6 seconds before timeout
  errorThresholdPercentage: Number(process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD) || 50, // 50% failures trigger trip
  resetTimeout: Number(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT) || 15000, // Wait 15s in open state before half-open probe
  volumeThreshold: 4, // Minimum 4 requests in sliding window before tripping
};

/**
 * Creates a monitored circuit breaker for an external service call
 * @param {Function} asyncAction - The external call action function
 * @param {string} serviceName - Descriptive name for logging (e.g., 'Razorpay', 'WhatsApp')
 * @param {Object} customOptions - Overrides for circuit breaker options
 * @param {Function} fallbackAction - Optional fallback if breaker is open or call fails
 */
function createCircuitBreaker(asyncAction, serviceName, customOptions = {}, fallbackAction = null) {
  const options = { ...defaultOptions, ...customOptions };
  const breaker = new CircuitBreaker(asyncAction, options);

  breaker.on('open', () => {
    console.error(`[CircuitBreaker] ⚠️ CIRCUIT OPEN for "${serviceName}". External service is failing. Failing fast to protect server.`);
  });

  breaker.on('halfOpen', () => {
    console.warn(`[CircuitBreaker] 🔄 CIRCUIT HALF-OPEN for "${serviceName}". Testing recovery with canary request...`);
  });

  breaker.on('close', () => {
    console.log(`[CircuitBreaker] ✅ CIRCUIT CLOSED for "${serviceName}". External service has recovered and is healthy.`);
  });

  breaker.on('fallback', (result) => {
    console.warn(`[CircuitBreaker] 🛡️ Fallback executed for "${serviceName}".`);
  });

  if (typeof fallbackAction === 'function') {
    breaker.fallback(fallbackAction);
  }

  return breaker;
}

module.exports = {
  createCircuitBreaker,
};
