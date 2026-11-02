const config = require('../config/env');
const local = require('./localMorFinIdentifier');

module.exports = {
  available: () => {
    if (config.biometric.identificationMode === 'disabled') return false;
    if (config.biometric.identificationMode === 'kiosk-assisted') return true;
    if (config.biometric.identificationMode === 'morfin-local-development') return local.available();
    if (local.available()) return true;
    // On remote cloud deployment, automatically enable kiosk-assisted mode
    return config.nodeEnv === 'production';
  },
  status: () => {
    if (config.biometric.identificationMode === 'disabled') {
      return { enabled: false, reason: 'Biometric identification is disabled in settings.' };
    }
    if (config.biometric.identificationMode === 'morfin-local-development') {
      return local.status();
    }
    if (config.biometric.identificationMode === 'kiosk-assisted' || !local.available()) {
      return {
        enabled: true,
        mode: 'kiosk-assisted',
        reason: 'Kiosk-assisted matching is active: the reception workstation compares templates directly via local MorFinAuth.',
      };
    }
    return local.status();
  },
  identify: async input => {
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
    if (config.biometric.identificationMode === 'morfin-local-development') {
      return local.identify(input);
    }
    if (config.biometric.identificationMode === 'kiosk-assisted' || !local.available()) {
      return { outcome: 'unknown', diagnostics: input.diagnostics };
    }
    return local.identify(input);
  },
};
