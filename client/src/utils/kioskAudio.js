/**
 * Vino Fitness Studio - Biometric Kiosk Audio & Speech Synthesis Engine
 * Provides synthesized multi-tone chime sound effects and natural voice cues
 * using Web Audio API and SpeechSynthesis (zero external mp3 dependencies).
 */

const STORAGE_KEY = 'pulsefit_kiosk_sound';

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export const isAudioEnabled = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) !== 'false';
};

export const setAudioEnabled = (enabled) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
};

/**
 * Plays synthesized harmonic chimes via Web Audio API
 */
export function playChime(type = 'checkin') {
  if (!isAudioEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    const playTone = (freq, startTime, duration, wave = 'sine', maxVol = 0.28) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = wave;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(maxVol, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    };

    switch (type) {
      case 'checkin':
        // Ascending luxury 3-tone chime: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz)
        playTone(523.25, now, 0.25, 'sine', 0.24);
        playTone(659.25, now + 0.1, 0.28, 'sine', 0.26);
        playTone(783.99, now + 0.2, 0.45, 'triangle', 0.28);
        break;

      case 'checkout':
        // Warm descending 2-tone chime: G5 (784Hz) -> C5 (523Hz)
        playTone(783.99, now, 0.22, 'sine', 0.26);
        playTone(523.25, now + 0.12, 0.45, 'triangle', 0.25);
        break;

      case 'reconfirmed':
        // Gentle double ping: E5 -> E5
        playTone(659.25, now, 0.18, 'sine', 0.22);
        playTone(659.25, now + 0.14, 0.35, 'triangle', 0.24);
        break;

      case 'warning':
      case 'expired':
      case 'payment_pending':
        // Soft descending dual-tone alert: Eb4 (311Hz) -> C4 (261Hz)
        playTone(311.13, now, 0.2, 'triangle', 0.22);
        playTone(261.63, now + 0.12, 0.35, 'sine', 0.2);
        break;

      case 'error':
      case 'unknown':
        // Low double buzz: A3 (220Hz) -> G3 (196Hz)
        playTone(220.0, now, 0.15, 'sawtooth', 0.15);
        playTone(196.0, now + 0.12, 0.25, 'sawtooth', 0.15);
        break;

      default:
        playTone(440.0, now, 0.25, 'sine', 0.2);
    }
  } catch (err) {
    console.warn('[KioskAudio] Sound synth error:', err.message);
  }
}

/**
 * Natural voice cue using browser SpeechSynthesis
 */
export function speakVoiceCue(phrase) {
  if (!isAudioEnabled() || !phrase) return;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  try {
    // Cancel any queued speech to avoid backlog
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.rate = 1.05; // Slightly brisk and modern
    utterance.pitch = 1.0;
    utterance.volume = 0.9;

    // Pick a natural English voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) =>
        (v.lang.startsWith('en') && v.name.includes('Natural')) ||
        (v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Microsoft') || v.name.includes('Samantha')))
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('[KioskAudio] Speech synthesis error:', err.message);
  }
}

/**
 * Unified feedback dispatcher for punch confirmations
 */
export function playPunchFeedback(popup) {
  if (!popup || !isAudioEnabled()) return;

  const isSuccess = popup.type === 'success';
  const isWarning = popup.type === 'warning';
  const memberName = popup.member?.fullName || '';
  const firstName = memberName ? memberName.split(' ')[0] : '';
  const action = popup.action;
  const isCheckout = action === 'checkout' || action === 'Check out';
  const isReconfirmed = popup.reconfirmed || popup.isReconfirmed;
  const subtitle = String(popup.subtitle || '').toLowerCase();
  const title = String(popup.title || '').toLowerCase();

  // 1. Success cases
  if (isSuccess) {
    if (isCheckout) {
      playChime('checkout');
      setTimeout(() => {
        speakVoiceCue(firstName ? `Goodbye ${firstName}! Have a great day.` : 'Check-out recorded. Have a great day!');
      }, 250);
      return;
    }

    if (isReconfirmed || subtitle.includes('already')) {
      playChime('reconfirmed');
      setTimeout(() => {
        speakVoiceCue(firstName ? `You are already checked in, ${firstName}.` : 'Attendance already recorded.');
      }, 250);
      return;
    }

    // Standard Check-in
    playChime('checkin');
    setTimeout(() => {
      speakVoiceCue(firstName ? `Welcome, ${firstName}!` : 'Welcome to Vino Fitness Studio!');
    }, 250);
    return;
  }

  // 2. Expired / Payment pending
  if (popup.isExpired || subtitle.includes('expired') || title.includes('expired')) {
    playChime('expired');
    setTimeout(() => {
      speakVoiceCue(firstName ? `${firstName}, your membership has expired. Please contact reception.` : 'Membership expired. Please visit reception.');
    }, 250);
    return;
  }

  if (subtitle.includes('payment') || title.includes('payment') || subtitle.includes('pending')) {
    playChime('payment_pending');
    setTimeout(() => {
      speakVoiceCue('Membership payment pending. Please visit reception.');
    }, 250);
    return;
  }

  // 3. Unknown Fingerprint or Sensor Errors
  if (subtitle.includes('not recognized') || subtitle.includes('no matching') || title.includes('unrecognized')) {
    playChime('unknown');
    setTimeout(() => {
      speakVoiceCue('Fingerprint not recognized. Please scan again.');
    }, 250);
    return;
  }

  // 4. Default Warning / Error
  if (isWarning) {
    playChime('warning');
  } else {
    playChime('error');
  }
}
