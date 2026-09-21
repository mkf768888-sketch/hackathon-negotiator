import { useEffect, useRef, useState } from "react";
import { getActiveZones, ZONE_POSITION } from "../facsMapping";
import { EMOTION_LABEL } from "../emotions";

// Замена AvatarHead.jsx на видео из HeyGen вместо 3D-рига — см. VITE_AVATAR_MODE
// в App.jsx. Повторяет ту же разметку и те же CSS-классы, что и AvatarHead
// (avatar-panel/avatar-canvas/hotspot/…), поэтому не требует новых стилей и
// «Пауза Лайтмана» выглядит идентично.
//
// Ожидает 8 файлов в frontend/public/avatar-clips/: idle.mp4 (тихий фоновый
// луп) + joy.mp4, anger.mp4, fear.mp4, surprise.mp4, disgust.mp4, sadness.mp4,
// contempt.mp4 (короткие вспышки под каждую из 7 эмоций Экмана). Если файлов
// ещё нет — компонент не падает, а честно показывает подсказку вместо ролика.

const CLIPS_BASE = "/avatar-clips";
const FLASH_MIN_INTENSITY = 0.3;
const FLASH_MIN_MS = 700;

export default function AvatarVideo({ emotion, characterName, paused }) {
  const idleRef = useRef(null);
  const [flashKey, setFlashKey] = useState(null);
  const [clipsMissing, setClipsMissing] = useState(false);
  const flashTimer = useRef(null);

  useEffect(() => {
    const el = idleRef.current;
    if (!el) return;
    if (paused) el.pause();
    else el.play().catch(() => {}); // автоплей может быть заблокирован до первого клика — не критично
  }, [paused]);

  useEffect(() => {
    if (!emotion || paused) return;
    if ((emotion.intensity ?? 0) < FLASH_MIN_INTENSITY) return;
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
        <video
          ref={idleRef}
          src={`${CLIPS_BASE}/idle.mp4`}
          autoPlay
          loop
          muted
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover", display: clipsMissing ? "none" : "block" }}
          onError={() => setClipsMissing(true)}
        />
        {!clipsMissing && flashKey && (
          <video
            key={flashKey}
            src={`${CLIPS_BASE}/${flashKey}.mp4`}
            autoPlay
            muted
            playsInline
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            onEnded={() => setFlashKey(null)}
            onError={() => setClipsMissing(true)}
          />
        )}
        {clipsMissing && (
          <div className="avatar-canvas-hint">
            Видео-ролики аватара ещё не загружены — положите 8 файлов в frontend/public/avatar-clips/
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
