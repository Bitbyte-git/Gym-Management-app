const config = require('../config/env');
const local = require('./localMorFinIdentifier');

module.exports = {
  available: () => {
    if (config.biometric.identificationMode === 'kiosk-assisted') return true;
    return local.available();
  },
  status: () => {
    if (config.biometric.identificationMode === 'kiosk-assisted') {
      return {
        enabled: true,
        mode: 'kiosk-assisted',
        reason: 'Kiosk-assisted matching is active: the reception workstation compares templates directly via local MorFinAuth.',
      };
    }
    return local.status();
  },
  identify: async input => {
    if (config.biometric.identificationMode === 'kiosk-assisted') {
      if (input.memberId && input.enrollmentReference) {
        return {
          outcome: 'identified',
          memberId: String(input.memberId),
          enrollmentReference: input.enrollmentReference,
          challenge: input.challenge,
          eventId: input.eventId,
          stationContext: input.stationContext,
          diagnostics: input.diagnostics || { comparisons: 1, elapsedMs: 50 },
        };
      }
      return { outcome: 'unknown', diagnostics: input.diagnostics };
    }
    return local.identify(input);
  },
};
