import { useState } from "react";

// Настройки администратора — контекст, под который подстраивается сценарий
// переговоров (ТЗ, п. 2 «Конфигурируемость под контекст»). В MVP это тот же
// экран, что видит игрок, а не отдельный админ-логин — но поля ровно те,
// что требует ТЗ: сфера/тема, сложность, тон оппонента, роль и цели.
const DIFFICULTY_OPTIONS = [
  { value: "", label: "По умолчанию (как задано характером)" },
  { value: "easy", label: "Лёгкая" },
  { value: "medium", label: "Средняя" },
  { value: "hard", label: "Сложная" },
];

export default function AdminConfigPanel({ onChange }) {
  const [open, setOpen] = useState(false);
  const [sphere, setSphere] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [tone, setTone] = useState("");
  const [opponentRole, setOpponentRole] = useState("");
  const [opponentGoals, setOpponentGoals] = useState("");

  function emit(next) {
    const merged = {
      sphere, difficulty, tone,
      opponent_role: opponentRole, opponent_goals: opponentGoals,
      ...next,
    };
    const context = {};
    if (merged.sphere) context.sphere = merged.sphere;
    if (merged.difficulty) context.difficulty = merged.difficulty;
    if (merged.tone) context.tone = merged.tone;
    if (merged.opponent_role) context.opponent_role = merged.opponent_role;
    if (merged.opponent_goals) context.opponent_goals = merged.opponent_goals;
    onChange(Object.keys(context).length ? context : null);
  }

  return (
    <div className="admin-config-panel">
      <button
        type="button"
        className="admin-config-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "▾" : "▸"} Настройки администратора: контекст сценария (необязательно)
      </button>

      {open && (
        <div className="admin-config-fields">
          <label>
            Сфера и тема переговоров
            <input
              type="text"
              placeholder="например: продажа B2B-подписки, наём разработчика, аренда офиса"
              value={sphere}
              onChange={(e) => { setSphere(e.target.value); emit({ sphere: e.target.value }); }}
            />
          </label>

          <label>
            Сложность
            <select
              value={difficulty}
              onChange={(e) => { setDifficulty(e.target.value); emit({ difficulty: e.target.value }); }}
            >
              {DIFFICULTY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label>
            Тон собеседника
            <input
              type="text"
              placeholder="например: холодный и формальный, дружелюбный, раздражённый"
              value={tone}
              onChange={(e) => { setTone(e.target.value); emit({ tone: e.target.value }); }}
            />
          </label>

          <label>
            Роль оппонента
            <input
              type="text"
              placeholder="например: закупщик крупной сети, HR-директор, арендодатель"
              value={opponentRole}
              onChange={(e) => { setOpponentRole(e.target.value); emit({ opponent_role: e.target.value }); }}
            />
          </label>

          <label>
            Явные цели оппонента
            <textarea
              placeholder="например: снизить цену минимум на 10% и получить отсрочку платежа"
              value={opponentGoals}
              onChange={(e) => { setOpponentGoals(e.target.value); emit({ opponent_goals: e.target.value }); }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
