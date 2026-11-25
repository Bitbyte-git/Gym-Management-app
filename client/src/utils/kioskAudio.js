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
  'pallavi',
  'valluvar',
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

export function getBestFemaleVoice() {
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
 * Discovers and prioritizes native Tamil voices (ta-IN, ta, Valluvar, Pallavi, Google தமிழ்)
 * with graceful Indian-English female voice fallback.
 */
export function getBestTamilVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // 1. Look for explicit Tamil language voice (ta-IN, ta-LK, Tamil, தமிழ்)
  const tamilVoice = voices.find((v) => {
    const l = (v.lang || '').toLowerCase();
    const n = (v.name || '').toLowerCase();
    return (
      l.startsWith('ta') ||
      n.includes('tamil') ||
      n.includes('தமிழ்') ||
      n.includes('valluvar') ||
      n.includes('pallavi')
    );
  });
  if (tamilVoice) return tamilVoice;

  // 2. Look for Indian multilingual female voices (e.g. en-IN, hi-IN with natural Indian accent)
  const indianFemale = voices.find((v) => {
    const l = (v.lang || '').toLowerCase();
    const n = (v.name || '').toLowerCase();
    const isIndian = l.includes('-in') || l.includes('_in') || n.includes('india') || n.includes('neerja') || n.includes('heera');
    const isFemale = FEMALE_VOICE_NAMES.some((fn) => n.includes(fn)) || !MALE_VOICE_NAMES.some((mn) => n.includes(mn));
    return isIndian && isFemale;
  });
  if (indianFemale) return indianFemale;

  // 3. Fallback to standard female voice
  return getBestFemaleVoice();
}

/**
 * Natural voice announcement in Tamil with proper pronunciation and slow pitch.
 * Accepts either:
 *  - string phrase
 *  - or cue object: { tamil: '...', phonetic: '...', english: '...' }
 */
const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
export const WELCOME_AUDIO_URL = `${cleanBase}/Welcome-message.mp3`;
export const THANKYOU_AUDIO_URL = `${cleanBase}/Thankyou-Audio.mp3`;
export const SUBSCRIPTION_EXPIRED_AUDIO_URL = `${cleanBase}/Subscription-Expired.mp3`;
export const FINGERPRINT_NOT_RECOGNIZED_AUDIO_URL = `${cleanBase}/Fingerprint-Not-Recogonized.mp3`;

export const AUDIO_MODES = {
  ELEVEN_LABS: '11labs',
  TAMIL: 'tamil',
  ENGLISH: 'english',
};

const STORAGE_KEY_AUDIO_MODE = 'pulsefit_kiosk_audio_mode';

export function getAudioMode() {
  if (typeof window === 'undefined') return AUDIO_MODES.ELEVEN_LABS;
  try {
    const val = localStorage.getItem(STORAGE_KEY_AUDIO_MODE);
    if (val && Object.values(AUDIO_MODES).includes(val)) {
      return val;
    }
  } catch { }
  return AUDIO_MODES.ELEVEN_LABS;
}

export function setAudioMode(mode) {
  if (typeof window === 'undefined') return;
  try {
    if (Object.values(AUDIO_MODES).includes(mode)) {
      localStorage.setItem(STORAGE_KEY_AUDIO_MODE, mode);
      window.dispatchEvent(new CustomEvent('pulsefit:audio-mode-changed', { detail: { mode } }));
    }
  } catch { }
}

let currentPlayingAudio = null;

export function stopCurrentAudio() {
  if (currentPlayingAudio) {
    try {
      currentPlayingAudio.pause();
      currentPlayingAudio.currentTime = 0;
    } catch { }
    currentPlayingAudio = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch { }
  }
}

// Preload audio files for zero-latency instant playback
if (typeof window !== 'undefined') {
  try {
    [
      WELCOME_AUDIO_URL,
      THANKYOU_AUDIO_URL,
      SUBSCRIPTION_EXPIRED_AUDIO_URL,
      FINGERPRINT_NOT_RECOGNIZED_AUDIO_URL,
    ].forEach((url) => {
      const p = new Audio();
      p.src = url;
      p.preload = 'auto';
    });
  } catch { }
}

/**
 * Plays an audio file from the public directory with fallback to SpeechSynthesis
 */
export function playAudioFile(url, fallbackCue = null) {
  if (!isAudioEnabled() || typeof window === 'undefined') return Promise.resolve(false);

  return new Promise((resolve) => {
    stopCurrentAudio();

    try {
      const audio = new Audio(url);
      currentPlayingAudio = audio;

      audio.onended = () => {
        if (currentPlayingAudio === audio) currentPlayingAudio = null;
        resolve(true);
      };

      audio.onerror = (e) => {
        console.warn(`[KioskAudio] Failed to play audio file ${url}, falling back to voice cue:`, e);
        if (currentPlayingAudio === audio) currentPlayingAudio = null;
        if (fallbackCue) {
          speakVoiceCue(fallbackCue);
        }
        resolve(false);
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn(`[KioskAudio] Playback prevented for ${url}:`, err.message);
          if (currentPlayingAudio === audio) currentPlayingAudio = null;
          if (fallbackCue) {
            speakVoiceCue(fallbackCue);
          }
          resolve(false);
        });
      }
    } catch (err) {
      console.warn(`[KioskAudio] Audio instantiation error for ${url}:`, err.message);
      if (fallbackCue) {
        speakVoiceCue(fallbackCue);
      }
      resolve(false);
    }
  });
}

/**
 * Plays custom recorded welcome audio from client/public/Welcome-Audio.mp3
 */
export function playWelcomeAudio(memberName = '') {
  const firstName = memberName ? memberName.split(' ')[0] : '';
  const fallbackCue = {
    tamil: firstName
      ? `ஹேய் ${firstName}! வெல்கம் டூ வினோ ஃபிட்னஸ்.`
      : 'ஹேய்! வெல்கம் டூ வினோ ஃபிட்னஸ்.',
    phonetic: firstName
      ? `Hai ${firstName}! Welcome To Vino Fitness`
      : 'Hai! Vino Fitness Studio-vukku nalvaravu.',
    english: firstName
      ? `Welcome ${firstName} to Vino Fitness Studio!`
      : 'Welcome to Vino Fitness Studio!',
  };
  return playAudioFile(WELCOME_AUDIO_URL, fallbackCue);
}

/**
 * Plays custom recorded thank you / send-off audio from client/public/Thankyou-Audio.mp3
 */
export function playThankYouAudio(memberName = '') {
  const firstName = memberName ? memberName.split(' ')[0] : '';
  const fallbackCue = {
    tamil: firstName
      ? `நன்றி ${firstName}!.`
      : 'நன்றி! இந்த நாள் இனிய நாளாக அமையட்டும்.',
    phonetic: firstName
      ? `Nandri ${firstName}!.`
      : 'Nandri! Come Back Soon.',
    english: firstName
      ? `Goodbye ${firstName}! Have a great day.`
      : 'Check-out recorded. Have a great day!',
  };
  return playAudioFile(THANKYOU_AUDIO_URL, fallbackCue);
}

/**
 * Plays custom recorded subscription expired audio from client/public/Subscription-Expired.mp3
 */
export function playExpiredAudio(memberName = '') {
  const firstName = memberName ? memberName.split(' ')[0] : '';
  const fallbackCue = {
    tamil: firstName
      ? `மன்னிக்கவும் ${firstName}, உங்கள் உறுப்பினர் காலம் முடிவடைந்துவிட்டது. தயவுசெய்து வரவேற்பறையை அணுகவும்.`
      : 'உறுப்பினர் காலம் முடிவடைந்துவிட்டது. தயவுசெய்து வரவேற்பறையை அணுகவும்.',
    phonetic: firstName
      ? `Mannikkavum ${firstName}, ungal membership mudivadhaindhadhu. Reception-ai anugavum.`
      : 'Membership mudivadhaindhadhu. Reception-ai anugavum.',
    english: firstName
      ? `Sorry ${firstName}, your membership has expired. Please contact reception.`
      : 'Membership expired. Please visit reception.',
  };
  return playAudioFile(SUBSCRIPTION_EXPIRED_AUDIO_URL, fallbackCue);
}

/**
 * Plays custom recorded unrecognized fingerprint audio from client/public/Fingerprint-Not-Recogonized.mp3
 */
export function playFingerprintNotRecognizedAudio() {
  const fallbackCue = {
    tamil: 'கைரேகை பொருந்தவில்லை. தயவுசெய்து மீண்டும் வைக்கவும்.',
    phonetic: 'Kairaigai porundhavillai. Meendum vaikkavum.',
    english: 'Fingerprint not recognized. Please scan again.',
  };
  return playAudioFile(FINGERPRINT_NOT_RECOGNIZED_AUDIO_URL, fallbackCue);
}

/**
 * Clear, professional English announcement with member's name
 */
export function speakEnglishCue(cue, options = {}) {
  if (!isAudioEnabled() || !cue) return;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  try {
    window.speechSynthesis.cancel();
    const textToSpeak = typeof cue === 'object' ? (cue.english || cue.phonetic || cue.tamil || '') : String(cue);
    if (!textToSpeak) return;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    const femaleVoice = getBestFemaleVoice();
    if (femaleVoice) {
      utterance.voice = femaleVoice;
      utterance.lang = femaleVoice.lang || 'en-US';
    } else {
      utterance.lang = 'en-US';
    }

    utterance.rate = options.rate ?? 0.90;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('[KioskAudio] English speech error:', err.message);
  }
}

export function speakVoiceCue(cue, options = {}) {
  if (!isAudioEnabled() || !cue) return;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  try {
    // Cancel any queued speech to avoid audio backlog
    window.speechSynthesis.cancel();

    // Determine voice availability
    const tamilVoice = getBestTamilVoice();
    const hasNativeTamilVoice = Boolean(
      tamilVoice &&
      ((tamilVoice.lang || '').toLowerCase().startsWith('ta') ||
        (tamilVoice.name || '').toLowerCase().includes('tamil') ||
        (tamilVoice.name || '').includes('தமிழ்'))
    );

    let textToSpeak = '';
    let speechLang = 'ta-IN';

    if (typeof cue === 'object') {
      if (hasNativeTamilVoice || !cue.phonetic) {
        textToSpeak = cue.tamil || cue.phonetic || cue.english || '';
        speechLang = 'ta-IN';
      } else {
        // When system lacks native Tamil voice pack, use phonetic Tamil for clear diction
        textToSpeak = cue.phonetic;
        speechLang = tamilVoice?.lang || 'en-IN';
      }
    } else {
      const containsTamilUnicode = /[\u0B80-\u0BFF]/.test(cue);
      textToSpeak = cue;
      speechLang = containsTamilUnicode ? 'ta-IN' : (tamilVoice?.lang || 'en-IN');
    }

    if (!textToSpeak) return;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = speechLang;

    // Slow tempo & relaxed, dignified pitch for clear, natural Tamil enunciation
    utterance.rate = options.rate ?? 0.82; // Slow, deliberate cadence so every Tamil syllable is distinct
    utterance.pitch = options.pitch ?? 0.92; // Warm, soothing, lower/slow pitch
    utterance.volume = options.volume ?? 1.0;

    if (tamilVoice) {
      utterance.voice = tamilVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('[KioskAudio] Speech synthesis error:', err.message);
  }
}

/**
 * Unified feedback dispatcher for punch confirmations.
 * Features automated welcome and send-off messages in Tamil.
 */
export function playPunchFeedback(popup) {
  if (!popup || !isAudioEnabled()) return;

  const currentMode = getAudioMode();
  const isSuccess = popup.type === 'success';
  const isWarning = popup.type === 'warning';
  const memberName = popup.member?.fullName || popup.errorData?.member?.fullName || '';
  const firstName = memberName ? memberName.split(' ')[0] : '';
  const action = popup.action;
  const subtitle = String(popup.subtitle || '').toLowerCase();
  const title = String(popup.title || '').toLowerCase();
  const isCheckout = action === 'checkout' || action === 'Check out' ||
    String(action).toLowerCase().includes('out') ||
    subtitle.includes('check-out') || subtitle.includes('checkout') ||
    title.includes('check-out') || title.includes('checkout');
  const isReconfirmed = popup.reconfirmed || popup.isReconfirmed;

  // Stop any lingering audio or speech from rapid succession punches
  stopCurrentAudio();

  // 1. Success cases
  if (isSuccess) {
    if (isCheckout) {
      playChime('checkout');
      setTimeout(() => {
        if (currentMode === AUDIO_MODES.ELEVEN_LABS) {
          playThankYouAudio(memberName);
        } else if (currentMode === AUDIO_MODES.ENGLISH) {
          speakEnglishCue({
            english: firstName
              ? `Thank you ${firstName}! Have a great day and come back soon.`
              : 'Thank you! Check-out recorded. Have a great day and come back soon.',
          });
        } else {
          // Tamil mode (TTS with member name)
          speakVoiceCue({
            tamil: firstName
              ? `நன்றி ${firstName}! மீண்டும் வருக. இந்த நாள் இனிய நாளாக அமையட்டும்.`
              : 'நன்றி! மீண்டும் வருக. இந்த நாள் இனிய நாளாக அமையட்டும்.',
            phonetic: firstName
              ? `Nandri ${firstName}! Meendum varuga. Indha naal iniya naalaaga amaiyattum.`
              : 'Nandri! Meendum varuga. Indha naal iniya naalaaga amaiyattum.',
            english: firstName
              ? `Goodbye ${firstName}! Have a great day.`
              : 'Check-out recorded. Have a great day!',
          });
        }
      }, 100);
      return;
    }

    if (isReconfirmed || subtitle.includes('already')) {
      playChime('reconfirmed');
      setTimeout(() => {
        if (currentMode === AUDIO_MODES.ENGLISH) {
          speakEnglishCue({
            english: firstName
              ? `Welcome back ${firstName}, you are already checked in.`
              : 'You are already checked in for this session.',
          });
        } else {
          speakVoiceCue({
            tamil: firstName
              ? `வணக்கம் ${firstName}, நீங்கள் ஏற்கனவே வருகை பதிவு செய்துள்ளீர்கள்.`
              : 'நீங்கள் ஏற்கனவே வருகை பதிவு செய்துள்ளீர்கள்.',
            phonetic: firstName
              ? `Vanakkam ${firstName}, neengal yaerkkanavae varugai padhivu seidhu-vitteergal.`
              : 'Neengal yaerkkanavae varugai padhivu seidhu-vitteergal.',
            english: firstName
              ? `You are already checked in, ${firstName}.`
              : 'Attendance already recorded.',
          });
        }
      }, 350);
      return;
    }

    // Standard Check-in (Welcome)
    playChime('checkin');
    setTimeout(() => {
      if (currentMode === AUDIO_MODES.ELEVEN_LABS) {
        playWelcomeAudio(memberName);
      } else if (currentMode === AUDIO_MODES.ENGLISH) {
        speakEnglishCue({
          english: firstName
            ? `Welcome ${firstName} to Vino Fitness Studio!`
            : 'Welcome to Vino Fitness Studio!',
        });
      } else {
        // Tamil mode (TTS with member name)
        speakVoiceCue({
          tamil: firstName
            ? `வணக்கம் ${firstName}! வினோ ஃபிட்னஸ் ஸ்டுடியோவிற்கு நல்வரவு.`
            : 'வணக்கம்! வினோ ஃபிட்னஸ் ஸ்டுடியோவிற்கு நல்வரவு.',
          phonetic: firstName
            ? `Vanakkam ${firstName}! Vino Fitness Studio-virkku nalvaravu.`
            : 'Vanakkam! Vino Fitness Studio-virkku nalvaravu.',
          english: firstName
            ? `Welcome ${firstName} to Vino Fitness Studio!`
            : 'Welcome to Vino Fitness Studio!',
        });
      }
    }, 100);
    return;
  }

  // 2. Expired / Payment pending messages
  if (popup.isExpired || subtitle.includes('expired') || title.includes('expired')) {
    playChime('expired');
    setTimeout(() => {
      if (currentMode === AUDIO_MODES.ELEVEN_LABS) {
        playExpiredAudio(memberName);
      } else if (currentMode === AUDIO_MODES.ENGLISH) {
        speakEnglishCue({
          english: firstName
            ? `Sorry ${firstName}, your membership has expired. Please contact reception.`
            : 'Your membership has expired. Please contact reception to renew.',
        });
      } else {
        // Tamil mode
        speakVoiceCue({
          tamil: firstName
            ? `மன்னிக்கவும் ${firstName}, உங்கள் உறுப்பினர் காலம் முடிவடைந்துவிட்டது. தயவுசெய்து வரவேற்பறையை அணுகவும்.`
            : 'உறுப்பினர் காலம் முடிவடைந்துவிட்டது. தயவுசெய்து வரவேற்பறையை அணுகவும்.',
          phonetic: firstName
            ? `Mannikkavum ${firstName}, ungal membership mudivadhaindhadhu. Reception-ai anugavum.`
            : 'Membership mudivadhaindhadhu. Reception-ai anugavum.',
          english: firstName
            ? `${firstName}, your membership has expired. Please contact reception.`
            : 'Membership expired. Please visit reception.',
        });
      }
    }, 150);
    return;
  }

  if (subtitle.includes('payment') || title.includes('payment') || subtitle.includes('pending')) {
    playChime('payment_pending');
    setTimeout(() => {
      if (currentMode === AUDIO_MODES.ENGLISH) {
        speakEnglishCue({
          english: firstName
            ? `${firstName}, membership payment is pending. Please contact reception.`
            : 'Membership payment pending. Please contact reception.',
        });
      } else {
        speakVoiceCue({
          tamil: 'கட்டணம் நிலுவையில் உள்ளது. தயவுசெய்து வரவேற்பறையை அணுகவும்.',
          phonetic: 'Kattanam niluvaiyil ulladhu. Reception-ai anugavum.',
          english: 'Membership payment pending. Please visit reception.',
        });
      }
    }, 350);
    return;
  }

  // 3. Unknown Fingerprint or Sensor Errors
  if (subtitle.includes('not recognized') || subtitle.includes('no matching') || title.includes('unrecognized')) {
    playChime('unknown');
    setTimeout(() => {
      if (currentMode === AUDIO_MODES.ELEVEN_LABS) {
        playFingerprintNotRecognizedAudio();
      } else if (currentMode === AUDIO_MODES.ENGLISH) {
        speakEnglishCue({
          english: 'Fingerprint not recognized. Please scan again.',
        });
      } else {
        // Tamil mode
        speakVoiceCue({
          tamil: 'கைரேகை பொருந்தவில்லை. தயவுசெய்து மீண்டும் வைக்கவும்.',
          phonetic: 'Kairaigai porundhavillai. Meendum vaikkavum.',
          english: 'Fingerprint not recognized. Please scan again.',
        });
      }
    }, 150);
    return;
  }

  // 4. Default Warning / Error
  if (isWarning) {
    playChime('warning');
  } else {
    playChime('error');
  }
}
