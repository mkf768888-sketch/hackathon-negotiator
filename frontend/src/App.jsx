import { useEffect, useRef, useState } from "react";
import { fetchCharacters, startSession, connectNegotiation, fetchDebrief } from "./api";
import CharacterSelect from "./components/CharacterSelect";
import AdminConfigPanel from "./components/AdminConfigPanel";
import ChatWindow from "./components/ChatWindow";
import AvatarHead from "./components/AvatarHead";
import BatnaGauge from "./components/BatnaGauge";
import DebriefPanel from "./components/DebriefPanel";
import { speak, stopSpeaking, speechOutputSupported } from "./voice";
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
  const [voiceOn, setVoiceOn] = useState(speechOutputSupported);
  const [debrief, setDebrief] = useState(null);
  const [loadingDebrief, setLoadingDebrief] = useState(false);
  const [debriefError, setDebriefError] = useState(null);
  const [adminContext, setAdminContext] = useState(null);
  const connRef = useRef(null);
  const voiceOnRef = useRef(voiceOn);
  useEffect(() => { voiceOnRef.current = voiceOn; }, [voiceOn]);
  useEffect(() => { if (!voiceOn) stopSpeaking(); }, [voiceOn]);

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
      const data = await startSession(characterKey, adminContext);
      setSession(data);
      setEmotion(data.opening.hidden_emotion);
      setBatna(data.opening.batna_cumulative);
      if (voiceOnRef.current) speak(data.opening.text);
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
          if (voiceOnRef.current) speak(turn.text);
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

  async function handleFinish() {
    if (!session) return;
    setDebriefError(null);
    setLoadingDebrief(true);
    try {
      const data = await fetchDebrief(session.session_id);
      setDebrief(data);
    } catch (e) {
      setDebriefError(e.message);
    } finally {
      setLoadingDebrief(false);
    }
  }

  function handleRestart() {
    connRef.current?.close();
    connRef.current = null;
    setSession(null);
    setMessages([]);
    setEmotion(null);
    setBatna(0);
    setDebrief(null);
    setDebriefError(null);
  }

  useEffect(() => () => connRef.current?.close(), []);

  if (!session) {
    return (
      <>
        <AdminConfigPanel onChange={setAdminContext} />
        <CharacterSelect
          characters={characters}
          loading={loadingCharacters}
          error={loadError}
          onSelect={handleSelect}
        />
      </>
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
        {speechOutputSupported && (
          <label className="voice-toggle">
            <input type="checkbox" checked={voiceOn} onChange={(e) => setVoiceOn(e.target.checked)} />
            🔊 Озвучивать оппонента
          </label>
        )}
        {!wsReady && <div className="hint hint--error">Соединение с оппонентом потеряно</div>}
        <button className="finish-btn" onClick={handleFinish} disabled={loadingDebrief}>
          {loadingDebrief ? "Считаю разбор…" : "Завершить и посмотреть разбор"}
        </button>
        {debriefError && <div className="hint hint--error">{debriefError}</div>}
      </aside>
      <main className="main-panel">
        <ChatWindow messages={messages} waiting={waiting} disabled={!wsReady || waiting || paused} onSend={handleSend} />
      </main>
      {debrief && (
        <DebriefPanel debrief={debrief} characterName={session.character_name} onRestart={handleRestart} />
      )}
    </div>
  );
}
