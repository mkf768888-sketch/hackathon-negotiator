export default function CharacterSelect({ characters, loading, error, onSelect }) {
  return (
    <div className="select-screen">
      <h1>Симулятор живого человека</h1>
      <p className="select-sub">Выберите оппонента, чтобы начать раунд переговоров</p>

      {loading && <div className="hint">Загружаем список персонажей…</div>}
      {error && (
        <div className="hint hint--error">
          Не удалось связаться с backend ({error}). Проверьте, что сервер запущен и VITE_API_BASE указывает на него.
        </div>
      )}

      <div className="character-grid">
        {characters.map((c) => (
          <button key={c.key} className="character-card" onClick={() => onSelect(c.key)}>
            <div className="character-name">{c.name}</div>
            <div className="character-desc">{c.short_description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
