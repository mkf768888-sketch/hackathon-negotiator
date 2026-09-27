// Голосовой ввод/вывод через встроенный в браузер Web Speech API — без бэкенда, без новых
// зависимостей. Chrome/Edge поддерживают оба направления полностью, Safari — TTS надёжно,
// SpeechRecognition (ввод) менее стабильно, отсюда все проверки поддержки ниже.

const SpeechRecognitionCtor =
  (typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;

export const speechInputSupported = !!SpeechRecognitionCtor;
export const speechOutputSupported = typeof window !== "undefined" && !!window.speechSynthesis;

// Web Speech API не даёт пол голоса как поле — определяем по известным именам мужских
// русских голосов у основных движков (macOS "Yuri", Windows/Edge "Pavel"/"Dmitry" и т.п.).
// Аватар — персонаж-мужчина, поэтому мужской голос предпочитаем, даже если он локальный,
// а не облачный.
const MALE_VOICE_HINTS = /yuri|pavel|dmitr|maxim|egor|nikolai|ruslan|vladimir|male/i;

let cachedRuVoice = null;
function pickRuVoice() {
  if (!speechOutputSupported) return null;
  if (cachedRuVoice) return cachedRuVoice;
  const voices = window.speechSynthesis.getVoices();
  const ruVoices = voices.filter((v) => v.lang?.toLowerCase().startsWith("ru"));
  const maleVoices = ruVoices.filter((v) => MALE_VOICE_HINTS.test(v.name));
  const candidates = maleVoices.length ? maleVoices : ruVoices;
  // Внутри отобранных: localService:false (облачный голос, например "Google русский" в
  // Chrome) звучит заметно естественнее локального синтезатора ОС — берём его, если есть.
  cachedRuVoice = candidates.find((v) => v.localService === false) || candidates[0] || null;
  return cachedRuVoice;
}
if (speechOutputSupported) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedRuVoice = null;
  };
}

// Стабильный хэш строки → небольшая, но повторяемая для одного персонажа вариация
// pitch/rate, чтобы 9 разных оппонентов не звучали одним и тем же голосом-роботом.
function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function speak(text, characterKey) {
  if (!speechOutputSupported || !text) return;
  window.speechSynthesis.cancel(); // не даём репликам накладываться друг на друга
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "ru-RU";
  const voice = pickRuVoice();
  if (voice) utter.voice = voice;
  if (characterKey) {
    const h = hashString(characterKey);
    utter.rate = 0.92 + (h % 10) / 50; // ~0.92–1.12
    utter.pitch = 0.82 + ((h >> 4) % 10) / 45; // ~0.82–1.02, не уводим тембр в женский диапазон
  } else {
    utter.rate = 1.0;
  }
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking() {
  if (speechOutputSupported) window.speechSynthesis.cancel();
}

// Возвращает { start, stop } — start() слушает один раз и вызывает onResult(text) по готовности.
export function createSpeechInput({ onResult, onStart, onEnd, onError }) {
  if (!speechInputSupported) return null;
  const recognition = new SpeechRecognitionCtor();
  recognition.lang = "ru-RU";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onstart = () => onStart?.();
  recognition.onend = () => onEnd?.();
  recognition.onerror = (e) => onError?.(e);
  recognition.onresult = (e) => {
    const text = e.results[0]?.[0]?.transcript;
    if (text) onResult?.(text);
  };
  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
  };
}
