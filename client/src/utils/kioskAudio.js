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
      // Send-off message in Tamil
      playChime('checkout');
      setTimeout(() => {
        speakVoiceCue({
          tamil: firstName
            ? `நன்றி ${firstName}! இன்றைய உடற்பயிற்சி முடிந்தது, மீண்டும் வருக. இந்த நாள் இனிய நாளாக அமையட்டும்.`
            : 'நன்றி! இன்றைய உடற்பயிற்சி முடிந்தது, மீண்டும் வருக. இந்த நாள் இனிய நாளாக அமையட்டும்.',
          phonetic: firstName
            ? `Nandri ${firstName}! Udar-payirchi mudindhadhu, meendum varuga. Iniya naalaaga amaiyattum.`
            : 'Nandri! Udar-payirchi mudindhadhu, meendum varuga. Iniya naalaaga amaiyattum.',
          english: firstName
            ? `Goodbye ${firstName}! Have a great day.`
            : 'Check-out recorded. Have a great day!',
        });
      }, 550);
      return;
    }

    if (isReconfirmed || subtitle.includes('already')) {
      // Already checked in message in Tamil
      playChime('reconfirmed');
      setTimeout(() => {
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
      }, 500);
      return;
    }

    // Standard Check-in (Auto-Welcome message in Tamil)
    playChime('checkin');
    setTimeout(() => {
      speakVoiceCue({
        tamil: firstName
          ? `வணக்கம் ${firstName}! வினோ ஃபிட்னஸ் ஸ்டுடியோவிற்கு நல்வரவு. உடற்பயிற்சியை தொடங்குங்கள்.`
          : 'வணக்கம்! வினோ ஃபிட்னஸ் ஸ்டுடியோவிற்கு நல்வரவு. உடற்பயிற்சியை தொடங்குங்கள்.',
        phonetic: firstName
          ? `Vanakkam ${firstName}! Vino Fitness Studio-vukku nalvaravu.`
          : 'Vanakkam! Vino Fitness Studio-vukku nalvaravu.',
        english: firstName
          ? `Welcome ${firstName} to Vino Fitness Studio!`
          : 'Welcome to Vino Fitness Studio!',
      });
    }, 550);
    return;
  }

  // 2. Expired / Payment pending messages in Tamil
  if (popup.isExpired || subtitle.includes('expired') || title.includes('expired')) {
    playChime('expired');
    setTimeout(() => {
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
    }, 550);
    return;
  }

  if (subtitle.includes('payment') || title.includes('payment') || subtitle.includes('pending')) {
    playChime('payment_pending');
    setTimeout(() => {
      speakVoiceCue({
        tamil: 'கட்டணம் நிலுவையில் உள்ளது. தயவுசெய்து வரவேற்பறையை அணுகவும்.',
        phonetic: 'Kattanam niluvaiyil ulladhu. Reception-ai anugavum.',
        english: 'Membership payment pending. Please visit reception.',
      });
    }, 550);
    return;
  }

  // 3. Unknown Fingerprint or Sensor Errors in Tamil
  if (subtitle.includes('not recognized') || subtitle.includes('no matching') || title.includes('unrecognized')) {
    playChime('unknown');
    setTimeout(() => {
      speakVoiceCue({
        tamil: 'கைரேகை பொருந்தவில்லை. தயவுசெய்து மீண்டும் வைக்கவும்.',
        phonetic: 'Kairaigai porundhavillai. Meendum vaikkavum.',
        english: 'Fingerprint not recognized. Please scan again.',
      });
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
