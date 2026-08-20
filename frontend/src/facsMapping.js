// FACS Action Unit → blendshape name(s) на модели facecap.glb (52 ARKit-совместимых морф-таргета).
// Симметричные AU (без явного L/R в данных бэкенда) применяются на обе стороны лица одинаково —
// это упрощение MVP; настоящая асимметрия (например, кривая улыбка при блефе) — доработка Фазы 2+.
export const AU_TO_SHAPES = {
  AU1: ["browInnerUp"],
  AU2: ["browOuterUp_L", "browOuterUp_R"],
  AU4: ["browDown_L", "browDown_R"],
  AU5: ["eyeWide_L", "eyeWide_R"],
  AU6: ["cheekSquint_L", "cheekSquint_R"],
  AU7: ["eyeSquint_L", "eyeSquint_R"],
  AU9: ["noseSneer_L", "noseSneer_R"],
  AU10: ["mouthUpperUp_L", "mouthUpperUp_R"],
  AU12: ["mouthSmile_L", "mouthSmile_R"],
  AU14: ["mouthDimple_L", "mouthDimple_R"],
  AU15: ["mouthFrown_L", "mouthFrown_R"],
  AU17: ["mouthShrugLower"],
  AU20: ["mouthStretch_L", "mouthStretch_R"],
  AU23: ["mouthPress_L", "mouthPress_R"],
  AU24: ["mouthPress_L", "mouthPress_R"],
  AU25: ["jawOpen"],
  AU26: ["jawOpen"],
  AU43: ["eyeBlink_L", "eyeBlink_R"],
};

// AU → человекочитаемая зона лица, для оверлея «Пауза Лайтмана». Позиции — фиксированные проценты
// внутри .avatar-canvas: камера всегда кадрирует лицо одинаково (см. AvatarHead.jsx), настоящая
// 3D→screen проекция для MVP избыточна.
export const AU_TO_ZONE = {
  AU1: { zone: "brows", label: "Брови" },
  AU2: { zone: "brows", label: "Брови" },
  AU4: { zone: "brows", label: "Брови" },
  AU5: { zone: "eyes", label: "Глаза" },
  AU6: { zone: "eyes", label: "Глаза" },
  AU7: { zone: "eyes", label: "Глаза" },
  AU43: { zone: "eyes", label: "Глаза" },
  AU9: { zone: "nose", label: "Нос" },
  AU10: { zone: "mouth", label: "Губы" },
  AU12: { zone: "mouth", label: "Губы" },
  AU14: { zone: "mouth", label: "Губы" },
  AU15: { zone: "mouth", label: "Губы" },
  AU17: { zone: "mouth", label: "Губы" },
  AU20: { zone: "mouth", label: "Губы" },
  AU23: { zone: "mouth", label: "Губы" },
  AU24: { zone: "mouth", label: "Губы" },
  AU25: { zone: "mouth", label: "Губы" },
  AU26: { zone: "mouth", label: "Губы" },
};

export const ZONE_POSITION = {
  brows: { top: "29%", left: "50%" },
  eyes: { top: "39%", left: "50%" },
  nose: { top: "51%", left: "50%" },
  mouth: { top: "64%", left: "50%" },
};

// Возвращает список уникальных активных зон (макс. одна запись на зону) для текущего emotion-тега.
export function getActiveZones(hiddenEmotion) {
  if (!hiddenEmotion) return [];
  const seen = new Set();
  const zones = [];
  for (const rawAU of hiddenEmotion.facs_action_units || []) {
    const z = AU_TO_ZONE[rawAU.toUpperCase()];
    if (z && !seen.has(z.zone)) {
      seen.add(z.zone);
      zones.push(z);
    }
  }
  return zones;
}

// Строит целевой вектор влияний морф-таргетов под текущую эмоцию.
export function buildTargetInfluences(morphTargetDictionary, influenceCount, hiddenEmotion) {
  const target = new Array(influenceCount).fill(0);
  if (!hiddenEmotion) return target;

  const intensity = Math.min(1, Math.max(0, hiddenEmotion.intensity ?? 0));
  for (const rawAU of hiddenEmotion.facs_action_units || []) {
    const shapes = AU_TO_SHAPES[rawAU.toUpperCase()];
    if (!shapes) continue;
    for (const shapeName of shapes) {
      const idx = morphTargetDictionary[shapeName];
      if (idx !== undefined) target[idx] = Math.max(target[idx], intensity);
    }
  }
  return target;
}
