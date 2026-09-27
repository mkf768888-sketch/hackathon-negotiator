export default function CharacterSelect({ characters, loading, error, startingKey, onSelect }) {
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
      {startingKey && (
        <div className="hint">
          <span className="avatar-spinner" /> Готовим оппонента… Если сервер «спал» — первый запуск может занять до минуты.
        </div>
      )}

      <div className="character-grid">
        {characters.map((c) => (
          <button
            key={c.key}
            className={"character-card" + (startingKey === c.key ? " character-card--starting" : "")}
            onClick={() => onSelect(c.key)}
            disabled={!!startingKey}
          >
            <div className="character-name">{c.name}</div>
            <div className="character-desc">{c.short_description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
