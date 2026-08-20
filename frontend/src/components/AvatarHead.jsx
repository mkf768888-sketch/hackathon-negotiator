import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildTargetInfluences, getActiveZones, ZONE_POSITION } from "../facsMapping";
import { EMOTION_LABEL } from "../emotions";

const PAUSE_TIME_SCALE = 0.06; // «замедление», не стоп-кадр — лицо еле заметно продолжает жить

const MODEL_URL = "/models/facecap.glb";
const ATTACK_SPEED = 8; // 1/s — как быстро лицо доезжает до целевого выражения
const RELEASE_SPEED = 5; // 1/s — как быстро "утечка" гаснет обратно
const MICROEXPRESSION_HOLD_MS = 650; // видимая длительность утечки (реальные длятся ~40-200мс — незаметно для демо)

// Индексы блендшейпов для фоновой "жизни" лица — не завязаны на эмоцию с бэкенда,
// без них лицо превращается в неподвижную маску между репликами.
const IDLE_BLINK_SHAPES = ["eyeBlink_L", "eyeBlink_R"];
const IDLE_GAZE_SHAPES = {
  eyeLookIn_L: 1, eyeLookOut_R: 1, // взгляд вправо от лица
  eyeLookOut_L: -1, eyeLookIn_R: -1, // взгляд влево от лица
};

// Один и тот же риг (52 ARKit blendshape) на всех трёх персонажей — FACS-пайплайн и механика
// "Пауза Лайтмана" не меняются. Различие только в перекраске/аксессуарах, чтобы персонаж
// читался по описанию из characters.py, а не выглядел одной болванкой на троих.
const CHARACTER_VISUALS = {
  torgash: { // Жёсткий Торгаш — уверенный, давит силой
    skinTint: 0xb98567,
    hairColor: 0x1c130d,
    hairCoverage: 0.40,
    hairRoughness: 0.9,
    glasses: false,
  },
  burokrat: { // Бюрократ-Стекловата — блёклый, пуглив, прячется за очками и регламентами
    skinTint: 0xd9c6ab,
    hairColor: 0x8a8983,
    hairCoverage: 0.26, // залысины
    hairRoughness: 0.95,
    glasses: true,
  },
  partner: { // Партнёр-Вэн — тёплый, располагающий к себе
    skinTint: 0xe0b48f,
    hairColor: 0x6b4a2a,
    hairCoverage: 0.38,
    hairRoughness: 0.82,
    glasses: false,
  },
  molchun: { // Молчун-Стратег — холодный, собранный, аккуратная короткая стрижка
    skinTint: 0xc7b8a8,
    hairColor: 0x2b2b2e,
    hairCoverage: 0.30,
    hairRoughness: 0.7,
    glasses: false,
  },
  panicker: { // Паникёр-Драматург — раскрасневшийся от тревоги, растрёпанные волосы
    skinTint: 0xe8a878,
    hairColor: 0x7a3a1e,
    hairCoverage: 0.46,
    hairRoughness: 0.95,
    glasses: false,
  },
  znatok: { // Всезнайка-Эксперт — солидная седина, очки "профессора"
    skinTint: 0xcfa87e,
    hairColor: 0x6e6a63,
    hairCoverage: 0.34,
    hairRoughness: 0.75,
    glasses: true,
  },
  praktik: { // Ледяная Прагматик — холодный тон, гладкие тёмные волосы, никаких сантиментов
    skinTint: 0xdcc9b4,
    hairColor: 0x15100c,
    hairCoverage: 0.32,
    hairRoughness: 0.6,
    glasses: false,
  },
  zhertva: { // Жертва-Манипулятор — усталый вид, мягкие растрёпанные волосы
    skinTint: 0xe6cdb5,
    hairColor: 0x8a6a52,
    hairCoverage: 0.42,
    hairRoughness: 0.88,
    glasses: false,
  },
  idealist: { // Идеалист-Принципиалист — собранный, строгий, очки "человека принципов"
    skinTint: 0xc79a72,
    hairColor: 0x2e2419,
    hairCoverage: 0.36,
    hairRoughness: 0.7,
    glasses: true,
  },
};
const DEFAULT_VISUAL = CHARACTER_VISUALS.torgash;
// Волосы (процедурный джиттер, потом canvas-альфа-текстура) и очки-торы обе итерации давали
// либо рваный край, либо гигантский плавающий блин над головой (скриншоты 15.08 и 19.08) —
// на дедлайне отключаем оба и оставляем чистый лысый скан, различия только по тону кожи.
const ADD_HAIR_CAP = false;

// Фолбэк из заметки 15.08 (idea #4): вместо джиттера вершин низкополигональной сферы (даёт рваную
// ленту — джиттер борется с разрешением сетки 32×20) рисуем пряди 2D-штрихами на canvas и используем
// как alphaMap. Антиалиасинг canvas-обводки даёт естественно мягкий волосяной край без правки геометрии.
function buildHairAlphaTexture(width = 512, height = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // База почти полностью непрозрачна — волосы должны примыкать к голове сплошным объёмом, а не
  // висеть отдельным островом над лбом. Растушёвка только в последних ~12% у самого края (линия
  // волос), иначе получается "шляпа в воздухе": именно так и выглядел первый прогон этого фикса —
  // плотность гасла уже с середины канвы, и вся нижняя половина шапки становилась невидимой.
  const density = ctx.createLinearGradient(0, 0, 0, height);
  density.addColorStop(0, "rgba(255,255,255,1)");
  density.addColorStop(0.88, "rgba(255,255,255,1)");
  density.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = density;
  ctx.fillRect(0, 0, width, height);

  const strandCount = 260;
  for (let i = 0; i < strandCount; i++) {
    const x0 = Math.random() * width;
    const topY = Math.random() * height * 0.15;
    const len = height * (0.55 + Math.random() * 0.5);
    const bendX = (Math.random() - 0.5) * width * 0.12;
    const midY = topY + len * 0.5;
    const endY = Math.min(height, topY + len);

    const grad = ctx.createLinearGradient(x0, topY, x0, endY);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1 + Math.random() * 1.8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, topY);
    ctx.quadraticCurveTo(x0 + bendX, midY, x0 + bendX * 1.6, endY);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  // SphereGeometry: v=0 у thetaStart (наша макушка), v=1 у края cap — ровно как рисовали канву сверху
  // вниз, поэтому выключаем стандартный flip.
  texture.flipY = false;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

// Настоящий 3D-риг с ARKit-blendshapes (facecap.glb, three.js examples) вместо цветной заглушки.
// FACS Action Units из бэкенда мапятся на morphTargetInfluences через facsMapping.js.
export default function AvatarHead({ emotion, characterName, characterKey, paused }) {
  const visual = CHARACTER_VISUALS[characterKey] || DEFAULT_VISUAL;
  const containerRef = useRef(null);
  const headRef = useRef(null); // { mesh, currentInfluences, targetInfluences, releaseAt }
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = !!paused; }, [paused]);

  useEffect(() => {
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a21);

    const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 20);
    camera.position.set(0, 0.05, 0.85);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    // Студийное окружение — без него у PBR-материалов (кожа, глаза) нет ни одного блика,
    // и даже с корректной текстурой лицо выглядит плоским пластиком.
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(0.5, 0.6, 1);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8899ff, 0.4);
    fill.position.set(-0.6, 0.2, 0.4);
    scene.add(fill);

    const ktx2Loader = new KTX2Loader().setTranscoderPath("/basis/").detectSupport(renderer);

    const loader = new GLTFLoader().setKTX2Loader(ktx2Loader).setMeshoptDecoder(MeshoptDecoder);

    let disposed = false;

    loader.load(
      MODEL_URL,
      (gltf) => {
        if (disposed) return;
        try {
          const model = gltf.scene;
          scene.add(model);

          // Голова, оба глаза и зубы в этой модели используют ОДИН общий материал (общий текстурный
          // атлас) — чтобы дать коже "восковой" отклик (дешёвая имитация подкожного рассеивания через
          // clearcoat/sheen), а глазам отдельный мокрый блеск, материал приходится клонировать по мешам.
          model.traverse((obj) => {
            if (!obj.isMesh) return;
            const src = obj.material;
            const physical = new THREE.MeshPhysicalMaterial({
              map: src.map,
              normalMap: src.normalMap,
              color: src.color,
              metalness: src.metalness,
            });
            const region = obj.parent?.name;
            if (region === "head") {
              physical.roughness = 0.55;
              physical.clearcoat = 0.25;
              physical.clearcoatRoughness = 0.35;
              physical.sheen = 0.15;
              physical.sheenColor = new THREE.Color(0xffe0c0);
              // Тон по фото-референсу (не сырые пиксели — на фото сильный холодный засвет от окна за
              // спиной, поэтому тёплый смуглый тон подобран вручную по фото, а не сэмплирован буквально).
              physical.color = new THREE.Color(visual.skinTint);
            } else if (region === "eyeLeft" || region === "eyeRight") {
              physical.roughness = 0.05;
              physical.clearcoat = 0.6;
              physical.clearcoatRoughness = 0.05;
            } else if (region === "teeth") {
              physical.roughness = 0.4;
              physical.clearcoat = 0.1;
            } else {
              physical.roughness = src.roughness;
            }
            obj.material = physical;
          });

          // Голова — меш с наибольшим числом морф-таргетов (в facecap.glb это mesh_2 / 52 таргета)
          let headMesh = null;
          model.traverse((obj) => {
            const count = obj.morphTargetInfluences?.length || 0;
            if (count > (headMesh?.morphTargetInfluences.length || 0)) headMesh = obj;
          });

          if (!headMesh) {
            setStatus("error");
            return;
          }

          // facecap.glb хранит мировые координаты скана как есть (не центрирован в нуле),
          // поэтому кадрируем камеру по фактическому bounding box головы, а не по угаданным цифрам.
          const box = new THREE.Box3().setFromObject(headMesh);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const distance = Math.max(size.x, size.y) * 1.7;
          camera.position.set(center.x, center.y, center.z + distance);
          camera.lookAt(center);
          key.position.set(center.x + 0.5, center.y + 0.6, center.z + distance);
          fill.position.set(center.x - 0.6, center.y + 0.2, center.z + distance * 0.5);

          if (ADD_HAIR_CAP) {
            try {
              // facecap.glb — лысый скан без волос. Точную геометрию по фото не восстановить локальным
              // кодом (нужна фотограмметрия/Ready Player Me) — это грубая шапка по bbox головы,
              // условно передающая волосы, а не точная причёска.
              // Радиус заметно больше head-bbox — волосам нужен объём, вплотную к черепу они
              // читаются как обтягивающая шапка, а не причёска.
              const capRadius = size.x * 0.58;
              const capThetaLength = Math.PI * visual.hairCoverage;
              const hairGeom = new THREE.SphereGeometry(capRadius, 32, 20, 0, Math.PI * 2, 0, capThetaLength);

              const hairMat = new THREE.MeshStandardMaterial({
                color: new THREE.Color(visual.hairColor),
                roughness: visual.hairRoughness,
                metalness: 0,
                alphaMap: buildHairAlphaTexture(),
                transparent: true,
                alphaTest: 0.05,
                side: THREE.DoubleSide,
              });
              const hair = new THREE.Mesh(hairGeom, hairMat);
              // Верхняя точка сферы (theta=0) всегда на local Y=+capRadius от центра сферы —
              // размещаем так, чтобы эта точка была чуть выше макушки (box.max.y). Смещение 0.06
              // (было 0.03) вместе с меньшим hairCoverage поднимает линию волос выше — на прошлой
              // версии край шёл прямо по бровям и читался как каска.
              hair.position.set(center.x, box.max.y + 0.06 - capRadius, center.z);
              // Слегка сплющиваем по глубине — иначе шапка бугром торчит вперёд/назад от черепа.
              hair.scale.set(1, 1, 0.85);
              model.add(hair);

              if (visual.glasses) {
                // Позиция на глаз (нет landmark-данных модели) — по bbox головы, как и вся остальная
                // разметка в этом файле (камера/свет тоже кадрируются от size/center, не от точных точек).
                const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.35, metalness: 0.5 });
                // Было 0.15 — на реальном рендере линзы перекрывали половину лица (скриншот 19.08).
                const lensR = size.x * 0.1;
                const eyeY = center.y + size.y * 0.06;
                const eyeZ = box.max.z + 0.005;
                const ringGeom = new THREE.TorusGeometry(lensR, lensR * 0.12, 8, 24);
                const leftRing = new THREE.Mesh(ringGeom, frameMat);
                const rightRing = new THREE.Mesh(ringGeom, frameMat);
                leftRing.position.set(center.x - size.x * 0.18, eyeY, eyeZ);
                rightRing.position.set(center.x + size.x * 0.18, eyeY, eyeZ);
                const bridgeGeom = new THREE.CylinderGeometry(lensR * 0.09, lensR * 0.09, size.x * 0.08, 6);
                const bridge = new THREE.Mesh(bridgeGeom, frameMat);
                bridge.rotation.z = Math.PI / 2;
                bridge.position.set(center.x, eyeY, eyeZ);
                model.add(leftRing, rightRing, bridge);
              }
            } catch (hairErr) {
              console.error("AvatarHead: hair cap failed, skipping", hairErr);
            }
          }

          const dict = headMesh.morphTargetDictionary;
          const idleBlinkIdx = IDLE_BLINK_SHAPES.map((n) => dict[n]).filter((i) => i !== undefined);
          const idleGazeIdx = Object.entries(IDLE_GAZE_SHAPES)
            .map(([name, sign]) => [dict[name], sign])
            .filter(([i]) => i !== undefined);

          headRef.current = {
            mesh: headMesh,
            currentInfluences: new Array(headMesh.morphTargetInfluences.length).fill(0),
            targetInfluences: new Array(headMesh.morphTargetInfluences.length).fill(0),
            releaseAt: null,
            idleBlinkIdx,
            idleGazeIdx,
            nextBlinkAt: performance.now() + 2000 + Math.random() * 3000,
            blinkStart: null,
          };
          setStatus("ready");
        } catch (e) {
          console.error("AvatarHead: onLoad callback threw", e);
          setStatus("error");
        }
      },
      undefined,
      (err) => {
        console.error("AvatarHead: failed to load facecap.glb", err);
        if (!disposed) setStatus("error");
      }
    );

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const rawDt = clock.getDelta();
      const dt = pausedRef.current ? rawDt * PAUSE_TIME_SCALE : rawDt;
      const t = clock.getElapsedTime();
      const head = headRef.current;
      if (head) {
        const { mesh, currentInfluences, targetInfluences, releaseAt } = head;
        const isReleasing = releaseAt !== null && performance.now() > releaseAt;
        const speed = isReleasing ? RELEASE_SPEED : ATTACK_SPEED;
        const lerpAmount = 1 - Math.exp(-speed * dt);

        for (let i = 0; i < currentInfluences.length; i++) {
          const targetValue = isReleasing ? 0 : targetInfluences[i];
          currentInfluences[i] += (targetValue - currentInfluences[i]) * lerpAmount;
          mesh.morphTargetInfluences[i] = currentInfluences[i];
        }

        // Фоновая жизнь лица — не участвует в lerp выше, просто накладывается сверху,
        // чтобы не мешать распознаванию эмоционального тега от бэкенда.
        const now = performance.now();
        if (now > head.nextBlinkAt) {
          head.blinkStart = now;
          head.nextBlinkAt = now + 2500 + Math.random() * 3500;
        }
        let blinkPulse = 0;
        const BLINK_MS = 140;
        if (head.blinkStart !== null) {
          const elapsed = now - head.blinkStart;
          if (elapsed < BLINK_MS) {
            blinkPulse = Math.sin((elapsed / BLINK_MS) * Math.PI);
          } else {
            head.blinkStart = null;
          }
        }
        for (const idx of head.idleBlinkIdx) {
          mesh.morphTargetInfluences[idx] = Math.max(mesh.morphTargetInfluences[idx], blinkPulse);
        }

        const gazeDrift = Math.sin(t * 0.35) * 0.12;
        for (const [idx, sign] of head.idleGazeIdx) {
          mesh.morphTargetInfluences[idx] = Math.max(0, mesh.morphTargetInfluences[idx] + Math.max(0, gazeDrift * sign));
        }
      }
      renderer.render(scene, camera);
    });

    function handleResize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", handleResize);
      renderer.setAnimationLoop(null);
      renderer.dispose();
      ktx2Loader.dispose();
      pmremGenerator.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const head = headRef.current;
    if (!head || !emotion) return;

    const target = buildTargetInfluences(
      head.mesh.morphTargetDictionary,
      head.mesh.morphTargetInfluences.length,
      emotion
    );
    head.targetInfluences = target;
    head.releaseAt = emotion.is_microexpression ? performance.now() + MICROEXPRESSION_HOLD_MS : null;
  }, [emotion, status]);

  const primary = emotion?.primary;
  const isLeak = emotion?.is_microexpression && emotion?.leak_type === "incongruent_with_text";
  const activeZones = paused ? getActiveZones(emotion) : [];

  return (
    <div className="avatar-panel">
      <div className={"avatar-canvas" + (paused ? " avatar-canvas--paused" : "")} ref={containerRef}>
        {status === "loading" && <div className="avatar-canvas-hint">Загружаем 3D-модель…</div>}
        {status === "error" && <div className="avatar-canvas-hint">Не удалось загрузить 3D-риг</div>}
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
