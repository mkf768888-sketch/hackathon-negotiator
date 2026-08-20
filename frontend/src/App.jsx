import { useEffect, useRef, useState } from "react";
import { fetchCharacters, startSession, connectNegotiation } from "./api";
import CharacterSelect from "./components/CharacterSelect";
import ChatWindow from "./components/ChatWindow";
import AvatarHead from "./components/AvatarHead";
import BatnaGauge from "./components/BatnaGauge";
import "./App.css";

export default function App() {
  const [characters, setCharacters] = useState([]);
  const [loadingCharacters, setLoadingCharacters] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [session, setSession] = useState(null); // {session_id, character, character_name}
  const [messages, setMessages] = useState([]);
  const [emotion, setEmotion] = useState(null);
  const [batna, setBatna] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [wsReady, setWsReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const connRef = useRef(null);

  // «Пауза Лайтмана» — пробел останавливает поток и подсвечивает горячие точки лица оппонента.
  useEffect(() => {
    if (!session) return;
    function onKeyDown(e) {
      if (e.code !== "Space") return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return; // не мешаем печатать реплику
      e.preventDefault();
      setPaused((p) => !p);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [session]);

  useEffect(() => {
    fetchCharacters()
      .then(setCharacters)
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoadingCharacters(false));
  }, []);

  async function handleSelect(characterKey) {
    setLoadError(null);
    try {
      const data = await startSession(characterKey);
      setSession(data);
      setEmotion(data.opening.hidden_emotion);
      setBatna(data.opening.batna_cumulative);
      setMessages([
        {
          role: "opponent",
          text: data.opening.text,
          hidden_interest_revealed: data.opening.hidden_interest_revealed,
          trigger_event: data.opening.trigger_event,
        },
      ]);

      const conn = connectNegotiation(data.session_id, {
        onOpen: () => setWsReady(true),
        onClose: () => setWsReady(false),
        onError: () => setWsReady(false),
        onTurn: (turn) => {
          setWaiting(false);
          setEmotion(turn.hidden_emotion);
          setBatna(turn.batna_cumulative);
          setMessages((prev) => [
            ...prev,
            {
              role: "opponent",
              text: turn.text,
              hidden_interest_revealed: turn.hidden_interest_revealed,
              trigger_event: turn.trigger_event,
            },
          ]);
        },
      });
      connRef.current = conn;
    } catch (e) {
      setLoadError(e.message);
    }
  }

  function handleSend(text) {
    setMessages((prev) => [...prev, { role: "player", text }]);
    setWaiting(true);
    connRef.current?.send(text);
  }

  useEffect(() => () => connRef.current?.close(), []);

  if (!session) {
    return (
      <CharacterSelect
        characters={characters}
        loading={loadingCharacters}
        error={loadError}
        onSelect={handleSelect}
      />
    );
  }

  return (
    <div className="negotiation-screen">
      <aside className="side-panel">
        <AvatarHead
          emotion={emotion}
          characterName={session.character_name}
          characterKey={session.character}
          paused={paused}
        />
        <BatnaGauge value={batna} />
        <div className="pause-hint">Пробел — {paused ? "продолжить" : "Пауза Лайтмана"}</div>
        {!wsReady && <div className="hint hint--error">Соединение с оппонентом потеряно</div>}
      </aside>
      <main className="main-panel">
        <ChatWindow messages={messages} waiting={waiting} disabled={!wsReady || waiting || paused} onSend={handleSend} />
      </main>
    </div>
  );
}
