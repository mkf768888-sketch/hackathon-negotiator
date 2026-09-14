import { useEffect, useRef, useState } from "react";
import { createSpeechInput, speechInputSupported } from "../voice";

export default function ChatWindow({ messages, waiting, disabled, onSend }) {
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const listRef = useRef(null);
  const speechRef = useRef(null);

  function toggleListening() {
    if (listening) {
      speechRef.current?.stop();
      return;
    }
    const speech = createSpeechInput({
      onResult: (text) => setDraft((prev) => (prev ? `${prev} ${text}` : text)),
      onStart: () => setListening(true),
      onEnd: () => setListening(false),
      onError: () => setListening(false),
    });
    if (!speech) return;
    speechRef.current = speech;
    speech.start();
  }

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, waiting]);

  function submit(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || disabled) return;
    onSend(text);
    setDraft("");
  }

  return (
    <div className="chat-window">
      <div className="chat-list" ref={listRef}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble chat-bubble--${m.role}`}>
            <div className="chat-bubble-text">{m.text}</div>
            {m.hidden_interest_revealed && (
              <div className="chat-bubble-tag">💡 приоткрыт интерес: {m.hidden_interest_revealed}</div>
            )}
            {m.trigger_event && <div className="chat-bubble-tag chat-bubble-tag--trigger">💥 {m.trigger_event}</div>}
          </div>
        ))}
        {waiting && (
          <div className="chat-bubble chat-bubble--opponent chat-bubble--thinking">
            оппонент думает…
          </div>
        )}
      </div>
      <form className="chat-input" onSubmit={submit}>
        {speechInputSupported && (
          <button
            type="button"
            className={"mic-btn" + (listening ? " mic-btn--active" : "")}
            onClick={toggleListening}
            disabled={disabled}
            title={listening ? "Слушаю… нажми, чтобы остановить" : "Голосовой ввод"}
          >
            {listening ? "🔴" : "🎤"}
          </button>
        )}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={listening ? "Слушаю…" : disabled ? "Соединение…" : "Ваша реплика…"}
          disabled={disabled}
        />
        <button type="submit" disabled={disabled || !draft.trim()}>
          Отправить
        </button>
      </form>
    </div>
  );
}
