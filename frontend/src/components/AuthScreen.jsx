import { useState } from "react";
import { supabase } from "../supabaseClient";

const wrap = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--bg)",
  color: "inherit",
};

const card = {
  width: "min(360px, 90vw)",
  background: "var(--panel)",
  borderRadius: 16,
  padding: "32px 28px",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const input = {
  background: "#0f0f13",
  border: "1px solid #2a2a33",
  borderRadius: 8,
  padding: "10px 12px",
  color: "inherit",
  fontSize: 14,
};

const button = {
  background: "var(--accent)",
  color: "#1a1030",
  border: "none",
  borderRadius: 8,
  padding: "10px 12px",
  fontWeight: 600,
  cursor: "pointer",
};

const linkBtn = {
  background: "transparent",
  border: "none",
  color: "var(--text-dim)",
  fontSize: 13,
  cursor: "pointer",
  textDecoration: "underline",
};

// Вход/регистрация компании через Supabase Auth. Появляется только если заданы
// VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY (см. supabaseClient.js) — иначе этот
// компонент вообще не рендерится, и тренажёр работает как раньше, анонимно.
export default function AuthScreen({ onAuthed, onSkip }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        // Первая компания создаётся при регистрации — сотрудников добавляют позже отдельно.
        if (data.session && companyName.trim()) {
          const { data: company, error: companyError } = await supabase
            .from("companies")
            .insert({ name: companyName.trim() })
            .select()
            .single();
          if (!companyError && company) {
            await supabase
              .from("company_members")
              .insert({ company_id: company.id, user_id: data.user.id, role: "owner" });
          }
        }
        if (data.session) onAuthed(data.session);
        else setError("Проверьте почту — нужно подтвердить регистрацию.");
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        onAuthed(data.session);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={wrap}>
      <form style={card} onSubmit={handleSubmit}>
        <h2 style={{ margin: 0, fontSize: 20 }}>
          {mode === "login" ? "Вход для компаний" : "Регистрация компании"}
        </h2>
        <input
          style={input}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          style={input}
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        {mode === "signup" && (
          <input
            style={input}
            type="text"
            placeholder="Название компании"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        )}
        {error && <div style={{ color: "#f87171", fontSize: 13 }}>{error}</div>}
        <button style={button} type="submit" disabled={busy}>
          {busy ? "Секунду…" : mode === "login" ? "Войти" : "Зарегистрироваться"}
        </button>
        <button
          type="button"
          style={linkBtn}
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
        >
          {mode === "login" ? "Нет аккаунта компании? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
        </button>
        <button type="button" style={linkBtn} onClick={onSkip}>
          Пропустить и пройти тренажёр как гость
        </button>
      </form>
    </div>
  );
}
