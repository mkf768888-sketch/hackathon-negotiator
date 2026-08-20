export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

export async function fetchCharacters() {
  const res = await fetch(`${API_BASE}/characters`);
  if (!res.ok) throw new Error(`characters: HTTP ${res.status}`);
  return res.json();
}

export async function startSession(character) {
  const res = await fetch(`${API_BASE}/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ character }),
  });
  if (!res.ok) throw new Error(`session/start: HTTP ${res.status}`);
  return res.json();
}

export function connectNegotiation(sessionId, { onTurn, onOpen, onClose, onError }) {
  const ws = new WebSocket(`${WS_BASE}/ws/${sessionId}`);
  ws.onopen = () => onOpen?.();
  ws.onclose = () => onClose?.();
  ws.onerror = (e) => onError?.(e);
  ws.onmessage = (event) => {
    try {
      onTurn(JSON.parse(event.data));
    } catch (e) {
      onError?.(e);
    }
  };
  return {
    send(message) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ message }));
      }
    },
    close() {
      ws.close();
    },
  };
}
