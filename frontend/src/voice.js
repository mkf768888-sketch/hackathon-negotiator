// Голосовой ввод/вывод через встроенный в браузер Web Speech API — без бэкенда, без новых
// зависимостей. Chrome/Edge поддерживают оба направления полностью, Safari — TTS надёжно,
// SpeechRecognition (ввод) менее стабильно, отсюда все проверки поддержки ниже.

const SpeechRecognitionCtor =
  (typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;

export const speechInputSupported = !!SpeechRecognitionCtor;
export const speechOutputSupported = typeof window !== "undefined" && !!window.speechSynthesis;

let cachedRuVoice = null;
function pickRuVoice() {
  if (!speechOutputSupported) return null;
  if (cachedRuVoice) return cachedRuVoice;
  const voices = window.speechSynthesis.getVoices();
  cachedRuVoice = voices.find((v) => v.lang?.toLowerCase().startsWith("ru")) || null;
  return cachedRuVoice;
}
if (speechOutputSupported) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedRuVoice = null;
  };
}

export function speak(text) {
  if (!speechOutputSupported || !text) return;
  window.speechSynthesis.cancel(); // не даём репликам накладываться друг на друга
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "ru-RU";
  utter.rate = 1.0;
  const voice = pickRuVoice();
  if (voice) utter.voice = voice;
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
