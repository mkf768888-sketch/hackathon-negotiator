// Карточка результата после переговоров — радар-чарт по 6 осям + текстовый разбор.
// Свой SVG без сторонних библиотек графиков — быстрее и надёжнее для дедлайна.

const AXES = [
  { key: "goal_completion", label: "Цель" },
  { key: "batna_defense", label: "Защита BATNA" },
  { key: "information_discipline", label: "Инф. дисциплина" },
  { key: "rapport", label: "Отношения" },
  { key: "tactic_variety", label: "Тактики" },
  { key: "emotional_composure", label: "Самообладание" },
];

const SIZE = 260;
const CENTER = SIZE / 2;
const MAX_R = SIZE / 2 - 40;

function pointAt(index, total, value) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
  const r = MAX_R * Math.max(0, Math.min(1, value));
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

function ringPath(total, fraction) {
  const pts = Array.from({ length: total }, (_, i) => pointAt(i, total, fraction));
  return pts.map((p) => p.join(",")).join(" ");
}

export default function DebriefPanel({ debrief, characterName, onRestart }) {
  if (!debrief) return null;
  const { score, rounds, final_batna, character_reservation_value: reservation } = debrief;
  const beatReservation = typeof reservation === "number" && final_batna >= reservation;
  const polygonPoints = AXES.map((axis, i) => pointAt(i, AXES.length, score[axis.key] ?? 0).join(",")).join(" ");

  return (
    <div className="debrief-overlay">
      <div className="debrief-card">
        <h2>Разбор полётов</h2>
        <p className="debrief-sub">
          {characterName} · {rounds} раунд(ов) · итоговый баланс BATNA: {final_batna >= 0 ? "+" : ""}
          {final_batna.toFixed(2)}
        </p>
        {typeof reservation === "number" && (
          <p className="debrief-sub debrief-sub--reveal">
            Раскрываем задним числом: реальный предел оппонента был {reservation >= 0 ? "+" : ""}
            {reservation.toFixed(2)} — {beatReservation
              ? "вы дожали его дальше этого предела, отличный результат."
              : "вы остановились раньше его настоящего предела — было куда давить."}
          </p>
        )}

        <svg width={SIZE} height={SIZE} className="radar-svg">
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <polygon key={f} points={ringPath(AXES.length, f)} className="radar-grid" />
          ))}
          {AXES.map((axis, i) => {
            const [x, y] = pointAt(i, AXES.length, 1);
            return <line key={axis.key} x1={CENTER} y1={CENTER} x2={x} y2={y} className="radar-axis" />;
          })}
          <polygon points={polygonPoints} className="radar-shape" />
          {AXES.map((axis, i) => {
            const [x, y] = pointAt(i, AXES.length, 1.18);
            return (
              <text key={axis.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="radar-label">
                {axis.label}
              </text>
            );
          })}
        </svg>

        {score.summary && <p className="debrief-summary">{score.summary}</p>}

        <div className="debrief-columns">
          {score.strengths?.length > 0 && (
            <div>
              <h4>Сильные стороны</h4>
              <ul>
                {score.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {score.improvements?.length > 0 && (
            <div>
              <h4>Куда расти</h4>
              <ul>
                {score.improvements.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <button className="debrief-restart" onClick={onRestart}>
          Начать заново
        </button>
      </div>
    </div>
  );
}
