import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const wrap = {
  minHeight: "100vh",
  background: "var(--bg)",
  color: "inherit",
  padding: "40px 24px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 20,
};

const panel = {
  width: "min(720px, 95vw)",
  background: "var(--panel)",
  borderRadius: 16,
  padding: 24,
};

const row = {
  display: "grid",
  gridTemplateColumns: "1.2fr 0.6fr 0.6fr 1fr",
  gap: 12,
  padding: "10px 0",
  borderBottom: "1px solid #2a2a33",
  fontSize: 14,
};

const button = {
  background: "var(--accent)",
  color: "#1a1030",
  border: "none",
  borderRadius: 8,
  padding: "10px 16px",
  fontWeight: 600,
  cursor: "pointer",
};

// История сессий компании — читается напрямую из Supabase (не через FastAPI-бэкенд),
// доступ ограничен политиками RLS из 0001_init.sql: видно только свою компанию.
export default function CompanyDashboard({ onStartSession, onLogout }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("sessions")
      .select("session_id, character, rounds, final_batna, created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) setError(fetchError.message);
        else setRows(data || []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={wrap}>
      <div style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>История сессий компании</h2>
          <button style={button} onClick={onStartSession}>Новая сессия</button>
        </div>
        {loading && <div style={{ color: "var(--text-dim)" }}>Загружаю…</div>}
        {error && <div style={{ color: "#f87171" }}>{error}</div>}
        {!loading && !error && rows.length === 0 && (
          <div style={{ color: "var(--text-dim)" }}>Пока ни одной завершённой сессии.</div>
        )}
        {rows.length > 0 && (
          <div>
            <div style={{ ...row, color: "var(--text-dim)", fontWeight: 600 }}>
              <span>Персонаж</span>
              <span>Раунды</span>
              <span>BATNA</span>
              <span>Дата</span>
            </div>
            {rows.map((r) => (
              <div style={row} key={r.session_id}>
                <span>{r.character}</span>
                <span>{r.rounds}</span>
                <span>{typeof r.final_batna === "number" ? r.final_batna.toFixed(2) : "—"}</span>
                <span>{new Date(r.created_at).toLocaleString("ru-RU")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <button type="button" style={{ ...button, background: "transparent", color: "var(--text-dim)" }} onClick={onLogout}>
        Выйти из аккаунта
      </button>
    </div>
  );
}
