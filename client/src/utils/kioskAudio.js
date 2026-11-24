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
    audioCtx.resume().catch(() => { });
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
        // Ascending luxury 3-tone chime with relaxed, melodic pacing:
        // C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz)
        playTone(523.25, now, 0.32, 'sine', 0.24);
        playTone(659.25, now + 0.16, 0.36, 'sine', 0.26);
        playTone(783.99, now + 0.32, 0.55, 'triangle', 0.28);
        break;

      case 'checkout':
        // Warm descending 2-tone chime: G5 (784Hz) -> C5 (523Hz)
        playTone(783.99, now, 0.30, 'sine', 0.26);
        playTone(523.25, now + 0.18, 0.55, 'triangle', 0.25);
        break;

      case 'reconfirmed':
        // Gentle double ping with relaxed interval: E5 -> E5
        playTone(659.25, now, 0.24, 'sine', 0.22);
        playTone(659.25, now + 0.22, 0.42, 'triangle', 0.24);
        break;

      case 'warning':
      case 'expired':
      case 'payment_pending':
        // Soft descending dual-tone alert: Eb4 (311Hz) -> C4 (261Hz)
        playTone(311.13, now, 0.28, 'triangle', 0.22);
        playTone(261.63, now + 0.18, 0.45, 'sine', 0.2);
        break;

      case 'error':
      case 'unknown':
        // Low double buzz: A3 (220Hz) -> G3 (196Hz)
        playTone(220.0, now, 0.20, 'sawtooth', 0.15);
        playTone(196.0, now + 0.18, 0.35, 'sawtooth', 0.15);
        break;

      default:
        playTone(440.0, now, 0.32, 'sine', 0.2);
    }
  } catch (err) {
    console.warn('[KioskAudio] Sound synth error:', err.message);
  }
}

// Known female voice identifier patterns across Windows, Chrome, macOS, Android, and iOS
const FEMALE_VOICE_NAMES = [
  'zira',
  'jenny',
  'aria',
  'neerja',
  'heera',
  'samantha',
  'karen',
  'victoria',
  'sonia',
  'libby',
  'ava',
  'emma',
  'hazel',
  'susan',
  'female',
];

const MALE_VOICE_NAMES = [
  'david',
  'mark',
  'george',
  'guy',
  'male',
  'ravi',
  'prabhat',
  'richard',
  'stefan',
  'james',
  'john',
];

let cachedVoices = [];

if (typeof window !== 'undefined' && window.speechSynthesis) {
  cachedVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

function getBestFemaleVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const englishVoices = voices.filter((v) => v.lang && v.lang.startsWith('en'));
  const pool = englishVoices.length > 0 ? englishVoices : voices;

  // 1. Try to find explicit known female voice
  for (const femaleName of FEMALE_VOICE_NAMES) {
    const found = pool.find((v) => v.name.toLowerCase().includes(femaleName));
    if (found) return found;
  }

  // 2. Filter out known male voices
  const nonMale = pool.find((v) => {
    const lower = v.name.toLowerCase();
    return !MALE_VOICE_NAMES.some((m) => lower.includes(m));
  });

  return nonMale || pool[0] || null;
}

/**
 * Natural female voice cue using browser SpeechSynthesis
 */
export function speakVoiceCue(phrase) {
  if (!isAudioEnabled() || !phrase) return;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  try {
    // Cancel any queued speech to avoid backlog
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.rate = 0.88; // Calm, clear, natural announcement tempo
    utterance.pitch = 1.08; // Warm, friendly female tone
    utterance.volume = 0.95;

    // Pick best female voice
    const femaleVoice = getBestFemaleVoice();
    if (femaleVoice) {
      utterance.voice = femaleVoice;
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
      }, 550);
      return;
    }

    if (isReconfirmed || subtitle.includes('already')) {
      playChime('reconfirmed');
      setTimeout(() => {
        speakVoiceCue(firstName ? `You are already checked in, ${firstName}.` : 'Attendance already recorded.');
      }, 500);
      return;
    }

    // Standard Check-in
    playChime('checkin');
    setTimeout(() => {
      speakVoiceCue(firstName ? `Welcome, ${firstName}! ` : 'Welcome to Vino Fitness Studio!');
    }, 550);
    return;
  }

  // 2. Expired / Payment pending
  if (popup.isExpired || subtitle.includes('expired') || title.includes('expired')) {
    playChime('expired');
    setTimeout(() => {
      speakVoiceCue(firstName ? `${firstName}, your membership has expired. Please contact reception.` : 'Membership expired. Please visit reception.');
    }, 550);
    return;
  }

  if (subtitle.includes('payment') || title.includes('payment') || subtitle.includes('pending')) {
    playChime('payment_pending');
    setTimeout(() => {
      speakVoiceCue('Membership payment pending. Please visit reception.');
    }, 550);
    return;
  }

  // 3. Unknown Fingerprint or Sensor Errors
  if (subtitle.includes('not recognized') || subtitle.includes('no matching') || title.includes('unrecognized')) {
    playChime('unknown');
    setTimeout(() => {
      speakVoiceCue('Fingerprint not recognized. Please scan again.');
    }, 550);
    return;
  }

  // 4. Default Warning / Error
  if (isWarning) {
    playChime('warning');
  } else {
    playChime('error');
  }
}
