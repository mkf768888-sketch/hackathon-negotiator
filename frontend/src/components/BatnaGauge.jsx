// Шкала BATNA: -1 (срыв сделки) ... 0 (нейтрально) ... +1 (соглашение)
export default function BatnaGauge({ value }) {
  const pct = ((value + 1) / 2) * 100;

  return (
    <div className="batna-gauge">
      <div className="batna-labels">
        <span>Срыв сделки</span>
        <span>Соглашение</span>
      </div>
      <div className="batna-track">
        <div className="batna-fill" style={{ width: `${pct}%` }} />
        <div className="batna-marker" style={{ left: `${pct}%` }} />
      </div>
      <div className="batna-value">{value.toFixed(2)}</div>
    </div>
  );
}
