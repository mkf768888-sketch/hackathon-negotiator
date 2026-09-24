import { useEffect, useRef, useState } from "react";
import { getActiveZones, ZONE_POSITION } from "../facsMapping";
import { EMOTION_LABEL } from "../emotions";

// Фото-версия аватара (реальное лицо актёра вместо 3D-рига или видео) — см.
// VITE_AVATAR_MODE в App.jsx. Повторяет разметку и CSS-классы AvatarHead/
// AvatarVideo (avatar-panel/avatar-canvas/hotspot/…), поэтому «Пауза
// Лайтмана» выглядит идентично во всех трёх режимах.
//
// Ожидает файлы в frontend/public/avatar-photos/: idle.jpg (нейтральный фон)
// + joy.jpg, anger.jpg, disgust.jpg, sadness.jpg, surprise.jpg, fear.jpg,
// contempt.jpg (по одному кадру на эмоцию). Каких-то файлов может не быть
// (эмоция ещё не отснята дизайнером) — тогда при обнаруженной эмоции просто
// не показываем вспышку и остаёмся на нейтральном кадре, без ошибок и без
// намёка на "битую картинку".

const PHOTOS_BASE = "/avatar-photos";
const FLASH_MIN_INTENSITY = 0.3;
const FLASH_MIN_MS = 900;

export default function AvatarPhoto({ emotion, characterName, paused }) {
  const [flashKey, setFlashKey] = useState(null);
  const [idleMissing, setIdleMissing] = useState(false);
  const [idleLoaded, setIdleLoaded] = useState(false);
  const [brokenFlashes, setBrokenFlashes] = useState({});
  const flashTimer = useRef(null);

  useEffect(() => {
    if (!emotion || paused) return;
    if ((emotion.intensity ?? 0) < FLASH_MIN_INTENSITY) return;
    if (brokenFlashes[emotion.primary]) return; // кадр для этой эмоции ещё не прислали
    setFlashKey(emotion.primary);
    clearTimeout(flashTimer.current);
    const ms = Math.max(FLASH_MIN_MS, emotion.duration_ms || FLASH_MIN_MS);
    flashTimer.current = setTimeout(() => setFlashKey(null), ms);
    return () => clearTimeout(flashTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emotion?.primary, emotion?.intensity, paused]);

  const primary = emotion?.primary;
  const isLeak = emotion?.is_microexpression && emotion?.leak_type === "incongruent_with_text";
  const activeZones = paused ? getActiveZones(emotion) : [];

  return (
    <div className="avatar-panel">
      <div className={"avatar-canvas" + (paused ? " avatar-canvas--paused" : "")} style={{ position: "relative", overflow: "hidden" }}>
        <img
          src={`${PHOTOS_BASE}/idle.jpg`}
          alt=""
          className="avatar-photo-base"
          style={{ display: idleMissing ? "none" : "block", opacity: idleLoaded ? 1 : 0 }}
          onLoad={() => setIdleLoaded(true)}
          onError={() => setIdleMissing(true)}
        />
        {!idleMissing && !idleLoaded && (
          <div className="avatar-canvas-hint">
            <span className="avatar-spinner" /> Загружаем портрет собеседника…
          </div>
        )}
        {!idleMissing && flashKey && (
          <img
            key={flashKey}
            src={`${PHOTOS_BASE}/${flashKey}.jpg`}
            alt=""
            className="avatar-photo-flash"
            onError={() => {
              setBrokenFlashes((prev) => ({ ...prev, [flashKey]: true }));
              setFlashKey(null);
            }}
          />
        )}
        {idleMissing && (
          <div className="avatar-canvas-hint">
            Фото аватара ещё не загружены — положите файлы в frontend/public/avatar-photos/
          </div>
        )}
        {paused && (
          <>
            <div className="pause-vignette" />
            <div className="pause-label">⏸ Пауза Лайтмана</div>
            {activeZones.map((z) => (
              <div
                key={z.zone}
                className="hotspot"
                style={{ top: ZONE_POSITION[z.zone].top, left: ZONE_POSITION[z.zone].left }}
              >
                <span className="hotspot-dot" />
                <span className="hotspot-label">{z.label}</span>
              </div>
            ))}
            {activeZones.length === 0 && (
              <div className="pause-label pause-label--sub">Нейтральное выражение — утечек не видно</div>
            )}
          </>
        )}
      </div>
      <div className="avatar-meta">
        <div className="avatar-name">{characterName || "Оппонент"}</div>
        <div className="avatar-emotion">
          {EMOTION_LABEL[primary] || primary || "…"}
          {isLeak && <span className="avatar-leak-tag">⚠ утечка (блеф?)</span>}
        </div>
        {emotion?.facs_action_units?.length > 0 && (
          <div className="avatar-au">{emotion.facs_action_units.join(" · ")}</div>
        )}
      </div>
    </div>
  );
}
