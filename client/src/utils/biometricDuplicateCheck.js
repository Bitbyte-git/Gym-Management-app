import api from '../services/api';

/**
 * Compares a newly captured MorFinAuth FMR_V2005 template against all other
 * active enrolled members' templates using the local MorFinAuth verify endpoint.
 * Throws an Error if a duplicate fingerprint is found on another member profile.
 */
export async function assertNoDuplicateCapture({ adapter, captureData, targetMemberId, signal }) {
  if (!captureData?.templateBase64 || !adapter) return;
  let candidates = [];
  try {
    const res = await api.get('/attendance/biometric/candidates', { signal });
    candidates = res.data?.data || [];
  } catch {
    // If candidates endpoint is unavailable (e.g. member self-service), backend checks handle it.
    return;
  }

  for (const candidate of candidates) {
    if (signal?.aborted) return;
    if (String(candidate.memberId) === String(targetMemberId)) continue;
    try {
      const check = await adapter.verify({
        probeTemplate: captureData.templateBase64,
        galleryTemplate: candidate.galleryTemplate,
        templateFormat: 'FMR_V2005',
        signal,
      });
      if (check?.matched) {
        const owner = candidate.fullName
          ? `${candidate.fullName}${candidate.memberCode ? ` (${candidate.memberCode})` : ''}`
          : 'another member';
        throw new Error(
          `Duplicate fingerprint detected! This fingerprint is already enrolled for ${owner}. A fingerprint cannot be added to multiple profiles.`
        );
      }
    } catch (err) {
      if (err?.message?.startsWith('Duplicate fingerprint detected')) throw err;
      if (['DEVICE_DISCONNECTED', 'SERVICE_UNAVAILABLE'].includes(err?.code)) throw err;
    }
  }
}

