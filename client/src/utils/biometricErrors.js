/**
 * Parses biometric attendance feedback/errors and provides accurate, mistake-specific
 * titles, messages, and classification so users see the exact reason rather than a generic error.
 */
export function parseBiometricFeedback(next = {}) {
  const code = next.code || next.result?.code || '';
  const rawMsg = next.message || next.result?.message || next.error || '';
  const msgLower = (rawMsg || '').toLowerCase();
  const member = next.result?.member || next.member || null;

  // 1. Duplicate scan / finger held on sensor
  if (
    code === 'DUPLICATE_SCAN' ||
    msgLower.includes('already recorded') ||
    msgLower.includes('remove your finger')
  ) {
    return {
      type: 'warning',
      title: 'Attendance Already Recorded',
      subtitle: rawMsg || 'Attendance has already been recorded — please remove your finger from the sensor.',
      member,
      action: 'duplicate',
      sessionName: next.result?.sessionName,
    };
  }

  // 2. Already checked out for the session
  if (
    code === 'ALREADY_CHECKED_OUT' ||
    msgLower.includes('already checked out') ||
    msgLower.includes('session was already checked out')
  ) {
    return {
      type: 'warning',
      title: 'Session Already Completed',
      subtitle: rawMsg || 'You have already completed check-out for this session today. See you next workout!',
      member,
      action: 'checkout',
      sessionName: next.result?.sessionName,
    };
  }

  // 3. Already checked in (reconfirmation or active session)
  if (
    msgLower.includes('already checked in') ||
    msgLower.includes('check-in confirmed') ||
    msgLower.includes('another open attendance session')
  ) {
    return {
      type: 'info',
      title: 'Already Checked In',
      subtitle: rawMsg || 'Check-in already confirmed for this session. Your workout session is currently active.',
      member,
      action: 'checkin',
      sessionName: next.result?.sessionName,
    };
  }

  // 4. Unknown fingerprint (no match in member records)
  if (
    code === 'UNKNOWN_FINGERPRINT' ||
    msgLower.includes('not recognized') ||
    msgLower.includes('no attendance recorded') ||
    msgLower.includes('no match')
  ) {
    return {
      type: 'error',
      title: 'Fingerprint Not Recognized',
      subtitle: 'Fingerprint does not match any enrolled member. Please press firmly or visit reception to enroll.',
      member: null,
    };
  }

  // 5. Poor capture / image quality / sensor moved
  if (
    code === 'POOR_CAPTURE' ||
    msgLower.includes('poor') ||
    msgLower.includes('partial') ||
    msgLower.includes('quality') ||
    msgLower.includes('moved') ||
    msgLower.includes('unclear')
  ) {
    return {
      type: 'warning',
      title: 'Poor Fingerprint Scan',
      subtitle: 'Fingerprint scan was partial or moved. Please clean the sensor and press firmly in the center.',
      member: null,
    };
  }

  // 6. Ambiguous fingerprint (multiple candidate matches)
  if (
    code === 'AMBIGUOUS_FINGERPRINT' ||
    msgLower.includes('ambiguous')
  ) {
    return {
      type: 'warning',
      title: 'Multiple Matches Found',
      subtitle: 'Multiple member matches detected. Please place your registered finger squarely in the center.',
      member: null,
    };
  }

  // 7. Inactive or expired membership
  if (
    code === 'MEMBERSHIP_INELIGIBLE' ||
    msgLower.includes('no current, paid membership') ||
    msgLower.includes('account is not active') ||
    msgLower.includes('membership is inactive') ||
    msgLower.includes('membership expired')
  ) {
    return {
      type: 'error',
      title: 'Membership Inactive or Expired',
      subtitle: rawMsg || 'Your gym membership is not currently active. Please contact reception to renew your plan.',
      member,
    };
  }

  // 8. Inactive enrollment
  if (
    code === 'ENROLLMENT_INACTIVE' ||
    msgLower.includes('enrollment')
  ) {
    return {
      type: 'error',
      title: 'Biometric Enrollment Inactive',
      subtitle: rawMsg || 'Your fingerprint enrollment is inactive or has changed. Please visit reception.',
      member,
    };
  }

  // 9. Gym closed outside operating hours
  if (
    msgLower.includes('gym is currently closed') ||
    msgLower.includes('operating hours')
  ) {
    return {
      type: 'warning',
      title: 'Gym is Currently Closed',
      subtitle: rawMsg || 'Attendance can only be marked during scheduled gym operating hours.',
      member: null,
    };
  }

  // 10. Time slot restriction
  if (
    msgLower.includes('assigned time') ||
    msgLower.includes('slot') ||
    msgLower.includes('time window')
  ) {
    return {
      type: 'warning',
      title: 'Time Slot Restriction',
      subtitle: rawMsg || 'Check-in is blocked outside your registered time slot.',
      member,
    };
  }

  // 11. Branch mismatch
  if (
    code === 'BRANCH_MISMATCH' ||
    msgLower.includes('branch')
  ) {
    return {
      type: 'error',
      title: 'Branch Mismatch',
      subtitle: rawMsg || 'This attendance record belongs to another gym branch. Please contact front desk staff.',
      member,
    };
  }

  // 12. Stale session review
  if (
    code === 'STALE_SESSION' ||
    msgLower.includes('stale') ||
    msgLower.includes('review')
  ) {
    return {
      type: 'warning',
      title: 'Staff Review Required',
      subtitle: rawMsg || 'An earlier open session needs receptionist review before a new punch can be accepted.',
      member,
    };
  }

  // 13. Device disconnected / service offline
  if (
    code === 'DEVICE_DISCONNECTED' ||
    msgLower.includes('disconnected')
  ) {
    return {
      type: 'error',
      title: 'Scanner Disconnected',
      subtitle: 'Biometric sensor is not connected. Please check USB cable and service.',
      member: null,
    };
  }
  if (
    code === 'SERVICE_UNAVAILABLE' ||
    msgLower.includes('service unavailable') ||
    msgLower.includes('service offline')
  ) {
    return {
      type: 'error',
      title: 'Scanner Service Offline',
      subtitle: 'Biometric RD service is not responding. Please verify scanner software is running.',
      member: null,
    };
  }

  // 14. Scan timeout
  if (
    code === 'CAPTURE_TIMEOUT' ||
    msgLower.includes('timeout') ||
    msgLower.includes('timed out')
  ) {
    return {
      type: 'warning',
      title: 'Scan Timed Out',
      subtitle: 'No finger detected in time. Place your finger firmly on the sensor when the light is active.',
      member: null,
    };
  }

  // 15. Manual validation messages
  if (msgLower.includes('check-out time must be after check-in')) {
    return {
      type: 'error',
      title: 'Invalid Check-out Time',
      subtitle: rawMsg,
      member,
    };
  }
  if (msgLower.includes('correction reason')) {
    return {
      type: 'error',
      title: 'Correction Reason Required',
      subtitle: rawMsg,
      member,
    };
  }

  // Default fallback
  return {
    type: 'error',
    title: 'Verification Failed',
    subtitle: rawMsg || 'Could not verify attendance. Please try scanning your finger again.',
    member,
  };
}

