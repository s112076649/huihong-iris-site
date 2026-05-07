// ═══════════════════════════════════════════════════════════
//  虹膜科技 IRIS · main.js
//  L3 沉浸体验 · Three.js Hero + GSAP 全场动效
// ═══════════════════════════════════════════════════════════

import * as THREE from 'three';

// 真实虹膜照片（本地资源，CC 许可来自 Wikimedia Commons）
const IRIS_PHOTO = './assets/iris-2.jpg';

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

// 读取 CSS 变量（保持颜色"零硬编码"原则）
const css = (name) => getComputedStyle(document.documentElement)
  .getPropertyValue(name).trim();

const COLORS = {
  accent: new THREE.Color(css('--accent')),
  irisCore: new THREE.Color(css('--iris-core')),
  irisViolet: new THREE.Color(css('--iris-violet')),
  irisGold: new THREE.Color(css('--iris-gold')),
};

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 640px)').matches;

function showFallback() {
  const canvas = $('#hero-3d-canvas');
  const fb = $('#hero-3d-fallback');
  if (canvas) canvas.style.display = 'none';
  if (fb) fb.style.display = 'flex';
}

// ═══════════════════════════════════════════════════════════
//  1. HERO H1 — 字符 stagger 入场（DOM API 安全分字）
// ═══════════════════════════════════════════════════════════
function splitHeroH1() {
  const h1 = $('.hero-h1');
  if (!h1) return;
  const text = h1.textContent;
  h1.textContent = '';
  for (const c of text) {
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = c === ' ' ? '\u00A0' : c;
    h1.appendChild(span);
  }
}

function animateHeroEntrance() {
  const chars = $$('.hero-h1 .char');
  if (!chars.length || !window.gsap) return;

  // Tab 后台隐藏时（预览环境 / 其它标签页），不做入场动画，内容保持 CSS 默认可见
  if (document.hidden) return;

  // 用 gsap.from —— 元素从隐藏状态过渡到 CSS 当前的可见状态
  // 若 GSAP ticker 被冻结，CSS 默认显示兜底
  gsap.from('.hero-h1 .char', {
    yPercent: 100, opacity: 0,
    stagger: 0.035, duration: 1.2, ease: 'power4.out', delay: 0.3,
  });
  gsap.from('.hero-h1-en', {
    y: 16, opacity: 0,
    duration: 0.8, ease: 'power3.out', delay: 0.8,
  });
  gsap.from('.hero [data-reveal]', {
    y: 24, opacity: 0,
    stagger: 0.1, duration: 0.8, ease: 'power3.out', delay: 0.9,
  });
}

// ═══════════════════════════════════════════════════════════
//  2. THREE.JS HERO IRIS — 签名 3D 时刻
// ═══════════════════════════════════════════════════════════
let irisRenderer, irisScene, irisCamera, irisGroup, irisClock;
let irisMouse = { x: 0, y: 0 };
let irisAnimId = null;
let irisVisible = true;

function initIrisScene() {
  const canvas = $('#hero-3d-canvas');
  if (!canvas || isMobile || prefersReducedMotion) {
    showFallback();
    return;
  }

  try {
    irisRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch (err) {
    console.warn('[iris] WebGL init failed, showing fallback', err);
    showFallback();
    return;
  }
  irisRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // 不在 init 时调 setSize —— 尺寸交给 onIrisResize() 依据 CSS client size 计算
  irisRenderer.setClearColor(0x000000, 0);

  irisScene = new THREE.Scene();
  irisCamera = new THREE.PerspectiveCamera(
    40,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  irisCamera.position.set(0, 0, 6);

  irisGroup = new THREE.Group();
  irisScene.add(irisGroup);

  // ── 加载真实虹膜本地照片 ──
  const texLoader = new THREE.TextureLoader();
  const irisTex = texLoader.load(IRIS_PHOTO, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = irisRenderer.capabilities.getMaxAnisotropy?.() ?? 4;
  });

  // ── Iris 主体 · 真实照片 + 色散 + 蓝光偏色 + 扫描网格 + 准星 ──
  const irisGeom = new THREE.PlaneGeometry(4.2, 4.2, 1, 1);
  const irisMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTex: { value: irisTex },
      uAccent: { value: COLORS.accent },
      uTechBlue: { value: new THREE.Color('#4CB3FF') },
      uPupilDilate: { value: 0.5 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uTex;
      uniform float uTime;
      uniform vec3 uAccent;
      uniform vec3 uTechBlue;
      uniform float uPupilDilate;

      // ── 7 样本径向模糊（DOF bokeh） ──
      // 照片内瞳孔不在正中央的补偿偏移
      // iris-2.jpg 实测：pupil 在 image (716, 484) of (1347, 957) → texture UV (0.532, 0.494)
      // 偏移 = pupilUV - (0.5, 0.5) → 让 plane UV (0.5, 0.5) 采样到真实瞳孔
      const vec2 uPhotoOffset = vec2(0.032, -0.006);

      vec3 sampleBokeh(vec2 uv, float radius) {
        vec2 p = uv + uPhotoOffset;  // 把 plane 中心 → 照片瞳孔中心
        vec3 sum = texture2D(uTex, p).rgb;
        // 6 个环形采样点（60° 间隔）
        for (int i = 0; i < 6; i++) {
          float a = 6.2831853 * float(i) / 6.0;
          vec2 off = vec2(cos(a), sin(a)) * radius;
          sum += texture2D(uTex, p + off).rgb;
        }
        return sum / 7.0;
      }

      void main() {
        vec2 centered = vUv - 0.5;
        float r = length(centered);
        float ang = atan(centered.y, centered.x);

        // ── 景深（DOF）：内 58% 锐利，外围渐进模糊 ──
        float focalRing = smoothstep(0.28, 0.48, r);
        float blurRadius = focalRing * 0.006;  // 外围最多 ~0.6% UV

        // ── 色散 + DOF：RGB 各自做 bokeh 采样 ──
        vec2 caDir = centered * 2.0;
        float caStrength = 0.012 * (0.3 + r * 1.5);
        float rC = sampleBokeh(vUv + caDir * caStrength, blurRadius).r;
        float gC = sampleBokeh(vUv, blurRadius).g;
        float bC = sampleBokeh(vUv - caDir * caStrength, blurRadius).b;
        vec3 col = vec3(rC, gC, bC);

        // ── Focus ring 高亮（内 35%-45% 区间微微提亮，强调焦平面） ──
        float focusRing = smoothstep(0.32, 0.38, r) * smoothstep(0.45, 0.38, r);
        col += vec3(0.05, 0.08, 0.12) * focusRing;

        // ── 对比度 + 轻度蓝调（收敛，不要霓虹光） ──
        col = (col - 0.5) * 1.10 + 0.5;
        col.r *= 0.88;
        col.g *= 1.02;
        col.b *= 1.18;
        col *= 1.08;
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(lum) * uTechBlue * 0.9, col, 0.85);

        // ── 扫描网格（呼吸脉动）──
        float gridPulse = 0.55 + sin(uTime * 1.2) * 0.45;
        float radialLine = smoothstep(0.03, 0.0, abs(mod(ang * 57.2958, 10.0) - 5.0) - 4.85);
        float circleLine = smoothstep(0.0015, 0.0, abs(fract(r * 16.0) - 0.5) - 0.48);
        float grid = max(radialLine * 0.22, circleLine * 0.28);
        col += uTechBlue * grid * gridPulse * smoothstep(0.48, 0.10, r);

        // ── 橙色扫描横条 ──
        float scanY = sin(uTime * 0.55) * 0.42;
        float scan = smoothstep(0.018, 0.0, abs(centered.y - scanY));
        col += uAccent * scan * 0.85;

        // ── 橙色外缘 rim ──
        float rim = smoothstep(0.38, 0.48, r) * smoothstep(0.50, 0.46, r);
        col += uAccent * rim * 0.5;

        // ── 中心十字准星 ──
        float cross =
          step(0.4985, vUv.x) * step(vUv.x, 0.5015) +
          step(0.4985, vUv.y) * step(vUv.y, 0.5015);
        col += uTechBlue * cross * 0.7 * smoothstep(0.20, 0.08, r);

        // ── 动态瞳孔 ──
        float pupilR = 0.085 + uPupilDilate * 0.055;
        float pupilDark = smoothstep(pupilR + 0.020, pupilR - 0.003, r);
        col = mix(col, vec3(0.005, 0.008, 0.015), pupilDark);
        float pupilRim = smoothstep(pupilR - 0.003, pupilR, r) * smoothstep(pupilR + 0.014, pupilR + 0.002, r);
        col += uAccent * pupilRim * (1.1 - uPupilDilate * 0.6);

        // ── 圆形羽化遮罩 ──
        float alpha = smoothstep(0.50, 0.42, r);

        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const irisMesh = new THREE.Mesh(irisGeom, irisMat);
  irisGroup.add(irisMesh);

  // ── Pupil 光晕（橙色发光环，包住照片里的瞳孔）──
  const glowGeom = new THREE.RingGeometry(0.42, 0.48, 64);
  const glowMat = new THREE.MeshBasicMaterial({
    color: COLORS.accent,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  const pupilGlow = new THREE.Mesh(glowGeom, glowMat);
  pupilGlow.position.z = 0.02;
  irisGroup.add(pupilGlow);

  // ── 外缘 limbus 环 ──
  const limbusGeom = new THREE.RingGeometry(2.0, 2.06, 128);
  const limbusMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
  });
  const limbus = new THREE.Mesh(limbusGeom, limbusMat);
  irisGroup.add(limbus);

  // ── Feature 粒子流 · 从虹膜向外扩散（特征提取动画）──
  const pointsCount = 70;
  const pointsGeom = new THREE.BufferGeometry();
  const positions = new Float32Array(pointsCount * 3);
  const seeds = new Float32Array(pointsCount);
  const angles = new Float32Array(pointsCount);
  for (let i = 0; i < pointsCount; i++) {
    positions[i * 3] = 0;  // 位置由 shader 计算
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;
    seeds[i] = Math.random();
    angles[i] = Math.random() * Math.PI * 2;
  }
  pointsGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pointsGeom.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  pointsGeom.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));

  const pointsMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: COLORS.accent },
      uBlue: { value: new THREE.Color('#4CB3FF') },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: `
      attribute float aSeed;
      attribute float aAngle;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vLife;
      varying float vSeed;

      void main() {
        // 每颗粒子独立生命周期（seed 错开起点，防止同步）
        float cycle = 3.2;   // 3.2 秒一个循环
        float life = mod(uTime * (0.6 + aSeed * 0.4) + aSeed * cycle, cycle) / cycle;
        vLife = life;
        vSeed = aSeed;

        // 半径从 1.6（虹膜内）扩散到 3.2（外缘）
        // 粒子只在虹膜外圈 1.9 → 2.5 飘动，不要形成大光晕
        float r = mix(1.9, 2.5, pow(life, 0.85));

        // 角度：基础角度 + 生命期内轻微漂移（造成"流"感而非"辐射"）
        float angle = aAngle + life * (0.15 + aSeed * 0.3) - 0.15;
        // 每颗粒子小幅抖动（模拟激光扫描噪声）
        angle += sin(uTime * 2.0 + aSeed * 6.28) * 0.03;

        vec3 pos = vec3(cos(angle) * r, sin(angle) * r, 0.05);

        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPos;

        // 粒子大小：刚出生时大一点（凝聚），之后变小（扩散）
        float size = mix(7.0, 1.8, life);
        gl_PointSize = size * uPixelRatio * (340.0 / -mvPos.z);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uBlue;
      varying float vLife;
      varying float vSeed;

      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float dist = length(d);
        if (dist > 0.5) discard;

        // 圆形粒子 + 柔边
        float core = smoothstep(0.5, 0.0, dist);

        // 生命期 alpha：出生 0 → 10% 峰值 → 尾部慢衰减
        float alpha = smoothstep(0.0, 0.08, vLife) * smoothstep(1.0, 0.5, vLife);
        alpha *= core;

        // 颜色：初期蓝（刚从虹膜提取），末期橙（被系统吸收）
        vec3 col = mix(uBlue, uColor, smoothstep(0.2, 0.8, vLife));

        // 随机 20% 粒子稍亮一些（随机焦点）
        if (vSeed > 0.8) { col *= 1.4; alpha *= 1.2; }

        gl_FragColor = vec4(col, alpha * 0.45);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const featurePoints = new THREE.Points(pointsGeom, pointsMat);
  irisGroup.add(featurePoints);

  // Save named refs（避免用 children[index] 脆弱索引）
  irisGroup.userData = {
    iris: irisMesh,
    pupilGlow,
    limbus,
    points: featurePoints,
  };

  // Initial position — 偏右上，让文字有呼吸空间
  // 对齐 HUD 瞄准圆中心：
  // HUD 屏幕位置 = right:4%, 宽 min(62vh,620px)，水平中心 ≈ 76.6% of viewport
  // 换算到 Three.js 世界坐标（camera z=6, fov 40°）→ x ≈ 1.86, y = 0
  irisGroup.position.set(1.86, 0, 0);
  irisGroup.scale.setScalar(1.0);

  irisClock = new THREE.Clock();

  // Mouse parallax
  window.addEventListener('pointermove', (e) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    irisMouse.x = nx;
    irisMouse.y = ny;
  });

  window.addEventListener('resize', onIrisResize);
  // 初始对齐一次（确保 position.x/y 跟 HUD 对齐，不依赖硬编码）
  onIrisResize();

  // IntersectionObserver — 不可见时暂停渲染
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      irisVisible = entry.isIntersecting;
      if (irisVisible && !irisAnimId) renderIris();
    });
  }, { threshold: 0.01 });
  io.observe($('#hero'));

  renderIris();
}

function onIrisResize() {
  if (!irisRenderer || !irisGroup) return;
  const canvas = $('#hero-3d-canvas');
  canvas.style.width = '';
  canvas.style.height = '';
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w <= 0 || h <= 0) return;
  irisRenderer.setSize(w, h, false);
  irisCamera.aspect = w / h;
  irisCamera.updateProjectionMatrix();

  // Canvas 全屏铺开，plane 按 HUD 目标中心定位 —— 保证虹膜圆心和 HUD 圆心重合
  // HUD 在 CSS 里定位在 right: 4% (或 2%)，width: min(62vh, 620px)
  const hudSize = w <= 1024 ? h * 0.46 : Math.min(h * 0.62, 620);
  const rightInset = w <= 1024 ? w * 0.02 : w * 0.04;
  const hudCenterX = w - rightInset - hudSize / 2;
  const hudCenterRatio = hudCenterX / w;

  const fov = (irisCamera.fov * Math.PI) / 180;
  const visibleH = 2 * Math.tan(fov / 2) * Math.abs(irisCamera.position.z);
  const visibleW = visibleH * irisCamera.aspect;
  const worldX = (hudCenterRatio - 0.5) * visibleW;
  irisGroup.position.set(worldX, 0, 0);
}

let currentPupilDilate = 0.5;

function renderIris() {
  if (!irisVisible) {
    irisAnimId = null;
    return;
  }
  irisAnimId = requestAnimationFrame(renderIris);

  const t = irisClock.getElapsedTime();
  const { iris, pupilGlow, points } = irisGroup.userData;

  // Breathing + slow rotation
  const breath = 1 + Math.sin(t * 0.6) * 0.012;
  irisGroup.scale.setScalar(breath);
  irisGroup.rotation.z = t * 0.04;

  // Mouse parallax (subtle tilt)
  irisGroup.rotation.y += (irisMouse.x * 0.15 - irisGroup.rotation.y) * 0.04;
  irisGroup.rotation.x += (-irisMouse.y * 0.15 - irisGroup.rotation.x) * 0.04;

  // ── 瞳孔扩张：鼠标远离 → dilate，靠近 → constrict ──
  // irisMouse.x/y 已经是 [-1, 1] 的屏幕归一化
  // 虹膜在屏幕右侧约 70% 位置 → normalize space 里 x≈0.4
  const irisNormX = 0.4, irisNormY = 0.0;
  const dx = irisMouse.x - irisNormX;
  const dy = irisMouse.y - irisNormY;
  const mouseDist = Math.min(1.0, Math.sqrt(dx * dx + dy * dy) / 1.2);
  const targetDilate = 0.25 + mouseDist * 0.75;  // 0.25 (close) → 1.0 (far)
  currentPupilDilate += (targetDilate - currentPupilDilate) * 0.04;

  // Update iris shader uniforms
  if (iris?.material?.uniforms) {
    iris.material.uniforms.uTime.value = t;
    iris.material.uniforms.uPupilDilate.value = currentPupilDilate;
  }

  // Pupil glow pulse（收缩态更亮）
  if (pupilGlow) {
    const glowBase = 0.35 + (1 - currentPupilDilate) * 0.2;
    pupilGlow.material.opacity = glowBase + Math.sin(t * 1.6) * 0.1;
  }

  // 粒子流 uTime 驱动
  if (points?.material?.uniforms) {
    points.material.uniforms.uTime.value = t;
  }

  irisRenderer.render(irisScene, irisCamera);
}

// ═══════════════════════════════════════════════════════════
//  3. GSAP · Scroll Reveal · Counters · Pin · Marquee
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
//  自定义光标（双圈 · ring 缓追 dot · 状态机）
// ═══════════════════════════════════════════════════════════
function initCursor() {
  const cursor = $('.cursor');
  const dot = $('.cursor-dot');
  const ring = $('.cursor-ring');
  if (!cursor || !dot || !ring) return;
  // 触屏不开启
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) {
    cursor.style.display = 'none';
    return;
  }

  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let rx = mx, ry = my;
  let visible = false;

  document.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    if (!visible) {
      visible = true;
      cursor.style.opacity = '1';
    }
    // dot 立即跟随
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    visible = false;
    cursor.style.opacity = '0';
  });

  // ring 用 lerp 缓追
  const tick = () => {
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // 状态切换：hover 在文字 → is-text，hover 在交互元素 → is-interactive
  const setState = (state) => {
    cursor.classList.remove('is-text', 'is-interactive');
    if (state) cursor.classList.add(state);
  };

  const interactive = 'a, button, .btn, [role="button"], .case-card, .bento-main, .compare-row';
  const textish = 'h1, h2, h3, p, li, dd, dt, span, .hero-h1';

  document.addEventListener('mouseover', (e) => {
    if (e.target.closest(interactive)) {
      setState('is-interactive');
    } else if (e.target.closest(textish)) {
      setState('is-text');
    } else {
      setState(null);
    }
  });

  cursor.style.opacity = '0';
}

// ═══════════════════════════════════════════════════════════
//  Magnetic 按钮（鼠标在范围内吸附）
// ═══════════════════════════════════════════════════════════
function initMagneticButtons() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const buttons = $$('.btn, .nav-cta');
  buttons.forEach((btn) => {
    const strength = 0.35;          // 吸附强度（0-1）
    const radius = 80;              // 触发半径（px）
    let raf = null;

    const onMove = (e) => {
      const r = btn.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) return;
      const fall = 1 - dist / radius;     // 越近越强
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        btn.style.transform = `translate(${dx * strength * fall}px, ${dy * strength * fall}px)`;
      });
    };

    const onLeave = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        btn.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
        btn.style.transform = '';
        setTimeout(() => { btn.style.transition = ''; }, 500);
      });
    };

    // 监听更大范围（按钮 + 周围 80px）
    document.addEventListener('mousemove', onMove);
    btn.addEventListener('mouseleave', onLeave);
  });
}

// ═══════════════════════════════════════════════════════════
//  字符级 Reveal — section H2 / hero-h1 · 滚动触发 clip-path 揭示
// ═══════════════════════════════════════════════════════════
function initCharReveal() {
  if (prefersReducedMotion) return;
  // 收集所有 H2 + hero-h1 + statement-big
  const targets = $$('.section-h2, .statement-big, .hero-h1');
  if (!targets.length) return;

  // 把每个目标包装成 char-reveal 容器
  targets.forEach((el) => {
    if (el.classList.contains('char-reveal')) return;
    if (el.classList.contains('hero-h1')) return; // hero-h1 已有 splitHeroH1 单独处理
    // 处理顶层文本节点 + 已有的 inline span（保留嵌套结构）
    const text = el.textContent;
    if (!text || !text.trim()) return;
    const chars = [...text];
    el.textContent = '';
    el.classList.add('char-reveal', 'pending');
    chars.forEach((c) => {
      const span = document.createElement('span');
      span.className = 'char';
      span.textContent = c === ' ' ? ' ' : c;
      el.appendChild(span);
    });
  });

  if (!window.gsap || !window.ScrollTrigger) return;

  $$('.char-reveal.pending').forEach((el) => {
    const chars = el.querySelectorAll('.char');
    if (!chars.length) return;
    gsap.to(chars, {
      clipPath: 'inset(0% 0 0 0)',
      yPercent: 0,
      opacity: 1,
      stagger: 0.025,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        once: true,
        onEnter: () => el.classList.remove('pending'),
      },
    });
  });
}

// ═══════════════════════════════════════════════════════════
//  数字 Scramble — stat 数字进入视口时"乱码 → 锁定"
// ═══════════════════════════════════════════════════════════
function initNumberScramble() {
  if (prefersReducedMotion) return;
  const els = $$('[data-count]');
  if (!els.length) return;

  const chars = '0123456789ABCDEF#@%$';
  const randChar = () => chars[Math.floor(Math.random() * chars.length)];

  els.forEach((el) => {
    const target = parseFloat(el.dataset.count);
    if (isNaN(target)) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        runScramble(el, target);
      });
    }, { threshold: 0.6 });
    observer.observe(el);
  });

  function runScramble(el, target) {
    const targetStr = Math.floor(target).toLocaleString();
    const totalDuration = 900;
    const scrambleDuration = 500;
    const start = performance.now();

    const tick = (now) => {
      const elapsed = now - start;
      if (elapsed < scrambleDuration) {
        // Scramble 阶段：乱码
        let s = '';
        for (let i = 0; i < targetStr.length; i++) {
          s += /[\d]/.test(targetStr[i]) ? randChar() : targetStr[i];
        }
        el.textContent = s;
        requestAnimationFrame(tick);
      } else if (elapsed < totalDuration) {
        // Reveal 阶段：从左到右逐个锁定
        const lockProgress = (elapsed - scrambleDuration) / (totalDuration - scrambleDuration);
        const lockUntil = Math.floor(targetStr.length * lockProgress);
        let s = '';
        for (let i = 0; i < targetStr.length; i++) {
          if (i < lockUntil) s += targetStr[i];
          else s += /[\d]/.test(targetStr[i]) ? randChar() : targetStr[i];
        }
        el.textContent = s;
        requestAnimationFrame(tick);
      } else {
        el.textContent = targetStr;
      }
    };
    requestAnimationFrame(tick);
  }
}

// ═══════════════════════════════════════════════════════════
//  Outline → Fill 标题（杂志封面感）
//  · 默认是空心字，滚动进入视口后 0.5s delay 平滑填实
// ═══════════════════════════════════════════════════════════
function initOutlineFill() {
  if (prefersReducedMotion) return;
  // 给所有 H2（除 hero）+ statement-big 应用 outline-fill 入场
  const targets = $$('.section-h2:not(.hero-h1), .statement-big');
  targets.forEach((el) => {
    el.classList.add('outline-fill', 'is-outline');
  });

  if (!('IntersectionObserver' in window)) {
    // 降级：直接显示
    targets.forEach((el) => el.classList.remove('is-outline'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      // 0.5s delay 让 char-reveal 先开始
      setTimeout(() => {
        entry.target.classList.remove('is-outline');
      }, 500);
    });
  }, { threshold: 0.4 });

  targets.forEach((el) => io.observe(el));
}

// ═══════════════════════════════════════════════════════════
//  Lenis 平滑滚动 + GSAP 共用 ticker
// ═══════════════════════════════════════════════════════════
let lenisInstance = null;
function initLenis() {
  if (!window.Lenis || prefersReducedMotion) return;
  lenisInstance = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 1.0,
    touchMultiplier: 1.5,
  });
  // 给 anchor 链接（#xxx）使用 lenis 平滑跳转
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length <= 1) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenisInstance.scrollTo(target, { offset: -64, duration: 1.4 });
    });
  });
  // ScrollTrigger 同步
  if (window.ScrollTrigger) {
    lenisInstance.on('scroll', ScrollTrigger.update);
  }
}

function initGsap() {
  if (!window.gsap) return;
  if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power3.out', duration: 1.0 });

  // GSAP 主导 rAF · Lenis 跟随 GSAP 时钟
  if (lenisInstance) {
    gsap.ticker.add((time) => lenisInstance.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // ── Generic reveal (non-hero) —— 用 gsap.from 渐进增强，CSS 默认可见
  if (!document.hidden) {
    $$('[data-reveal]').forEach((el) => {
      if (el.closest('.hero')) return;
      gsap.from(el, {
        y: 40, opacity: 0, duration: 1.0,
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      });
    });
  }

  // ── 数字 counter 已被 initNumberScramble 接管（更"贵"的乱码→锁定效果）

  // ── Marquee 横滚
  if (!prefersReducedMotion) {
    const track = $('.marquee-track');
    if (track) {
      gsap.to(track, {
        xPercent: -50,
        repeat: -1,
        duration: 32,
        ease: 'none',
      });
    }
  }

  // ── Pin-scrub 虹膜解剖（tech section）
  if (!isMobile && !prefersReducedMotion && window.ScrollTrigger) {
    ScrollTrigger.create({
      trigger: '#tech-pin',
      start: 'top top',
      end: '+=200%',
      pin: true,
      scrub: 1,
      onUpdate: (self) => {
        const p = self.progress;
        const layers = [
          { el: $('#iris-layer-1'), step: $$('.tech-step')[0], from: 0, to: 0.4 },
          { el: $('#iris-layer-2'), step: $$('.tech-step')[1], from: 0.33, to: 0.7 },
          { el: $('#iris-layer-3'), step: $$('.tech-step')[2], from: 0.66, to: 1.0 },
        ];
        layers.forEach(({ el, step, from, to }) => {
          const visible = p >= from && p <= to;
          if (el) el.style.opacity = visible ? 1 : 0;
          if (step) step.classList.toggle('active', visible);
        });
      },
    });
  } else {
    // Mobile fallback — 显示所有 layer 中的第一个，其他靠文案阅读
    const l1 = $('#iris-layer-1');
    if (l1) l1.style.opacity = 1;
    $$('.tech-step').forEach(s => s.classList.add('active'));
  }
}

// ═══════════════════════════════════════════════════════════
//  3.4 SCROLL PROGRESS — 章节计数器 + 进度条
// ═══════════════════════════════════════════════════════════
function initScrollProgress() {
  const wrap = $('#scrollProgress');
  const now = $('#progNow');
  const total = $('#progTotal');
  const name = $('#progName');
  const bar = $('#progBar');
  if (!wrap || !now || !name || !bar) return;

  // 按文档顺序抓 section（有 id 或 aria-label 的）
  const sections = $$('section[id], section[aria-label]').map((el, i) => {
    const id = el.id || el.getAttribute('aria-label') || '';
    // 根据 id 映射到显示名（短 mono 标签）
    const labelMap = {
      hero: 'HERO',
      compare: 'BENCHMARK',
      stats: 'METRICS',
      scenarios: 'SCENARIOS',
      cases: 'CASES',
      tech: 'ENGINE',
      about: 'ABOUT',
      contact: 'CONTACT',
    };
    let label = labelMap[id];
    if (!label) {
      if (el.classList.contains('cert-strip')) label = 'COMPLIANCE';
      else if (el.classList.contains('marquee-section')) label = 'MANIFESTO';
      else if (el.classList.contains('statement-section')) label = 'STATEMENT';
      else label = (id || 'SECTION').toUpperCase().replace(/[-_]/g, ' ');
    }
    return { el, label };
  });

  const totalN = sections.length;
  total.textContent = String(totalN).padStart(2, '0');

  let currentIdx = -1;

  const update = () => {
    const scrollY = window.scrollY;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const progress = Math.max(0, Math.min(1, scrollY / Math.max(1, docH)));
    bar.style.width = (progress * 100) + '%';

    // 找当前 section —— viewport 上缘之上最近的一个
    let idx = 0;
    for (let i = 0; i < sections.length; i++) {
      const top = sections[i].el.getBoundingClientRect().top;
      if (top <= window.innerHeight * 0.4) idx = i;
    }
    if (idx !== currentIdx) {
      currentIdx = idx;
      now.textContent = String(idx + 1).padStart(2, '0');
      name.textContent = sections[idx].label;
    }

    // 出现条件：滚过 Hero 一半以上
    wrap.classList.toggle('visible', scrollY > window.innerHeight * 0.4);
  };

  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
}

// ═══════════════════════════════════════════════════════════
//  3.5 HUD 频谱线 — 独立 rAF，不依赖 WebGL
// ═══════════════════════════════════════════════════════════
function initHudSpectrum() {
  const path = $('.hud-spectrum');
  const liveDot = $('.hud-live-dot');
  if (!path || prefersReducedMotion) return;

  const startX = 120, endX = 320;
  const baseY = 360;
  const segs = 48;

  let hudRaf = null;
  let hudActive = true;
  let lastTick = 0;

  const update = (now) => {
    if (!hudActive) { hudRaf = null; return; }
    hudRaf = requestAnimationFrame(update);

    // ~30 FPS 已足够，省一半开销
    if (now - lastTick < 33) return;
    lastTick = now;

    const t = now / 1000;
    const pts = [];

    // 偶发"心跳尖峰"（每 3 秒一次）
    const heartbeat = Math.max(0, 1 - Math.abs(Math.sin(t * 1.05)) * 3) * 6;
    const spikePhase = (t % 3.0) / 3.0;

    for (let i = 0; i <= segs; i++) {
      const x = startX + (i / segs) * (endX - startX);
      const phase = t * 2.6 + i * 0.22;

      // 基础波形：三层正弦叠加
      let y = baseY
        + Math.sin(phase) * 3.5
        + Math.sin(phase * 2.3 + 0.5) * 1.8
        + Math.sin(phase * 4.7) * 0.9
        + (Math.random() - 0.5) * 0.6;  // 细微噪声

      // 心跳尖峰（在波形中段）
      const normI = i / segs;
      const spikePos = Math.abs(normI - spikePhase);
      if (spikePos < 0.03 && heartbeat > 0) {
        y -= heartbeat * (1 - spikePos / 0.03);
      }

      pts.push((i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(2));
    }

    path.setAttribute('d', pts.join(' '));

    // Live dot pulse
    if (liveDot) {
      const pulse = 0.6 + Math.sin(t * 3.2) * 0.4;
      liveDot.setAttribute('r', (1.6 + pulse * 1.4).toFixed(2));
    }
  };
  hudRaf = requestAnimationFrame(update);

  // Pause when hero not visible
  const heroEl = $('#hero');
  if (heroEl && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        hudActive = e.isIntersecting;
        if (hudActive && !hudRaf) {
          hudRaf = requestAnimationFrame(update);
        }
      });
    }, { threshold: 0.01 });
    io.observe(heroEl);
  }
}

// ═══════════════════════════════════════════════════════════
//  4. Spotlight Cards — rAF 节流的 --mx/--my
// ═══════════════════════════════════════════════════════════
function initSpotlightCards() {
  let raf = null;
  $$('.card, .stat-card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - rect.left) + 'px');
        card.style.setProperty('--my', (e.clientY - rect.top) + 'px');
      });
    });
  });
}

// ═══════════════════════════════════════════════════════════
//  5. NAV scrolled state
// ═══════════════════════════════════════════════════════════
function initNav() {
  const nav = $('#nav');
  if (!nav) return;
  const update = () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
}

// ═══════════════════════════════════════════════════════════
//  6. Iris SVG — Feature points & Binary grid（layer 2 / 3）
// ═══════════════════════════════════════════════════════════
const SVG_NS = 'http://www.w3.org/2000/svg';

function drawFeaturePoints() {
  const g = $('.feature-points');
  if (!g) return;
  const cx = 200, cy = 200;
  const rings = [
    { r: 70, count: 12 },
    { r: 110, count: 20 },
    { r: 140, count: 24 },
  ];
  rings.forEach(({ r, count }, ringIdx) => {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + ringIdx * 0.2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
      circle.setAttribute('r', '2');
      g.appendChild(circle);
    }
  });
}

function drawBinaryGrid() {
  const g = $('.binary-grid');
  if (!g) return;
  const cols = 16, rows = 16;
  const cellW = 20, cellH = 18;
  const startX = 40, startY = 40;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Hide cells that would overlap with center circle
      const x = startX + c * cellW;
      const y = startY + r * cellH;
      const dx = x - 200, dy = y - 200;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 70 || dist > 160) continue;
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', x);
      text.setAttribute('y', y);
      text.textContent = Math.random() > 0.5 ? '1' : '0';
      g.appendChild(text);
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  7. Footer year
// ═══════════════════════════════════════════════════════════
function initYear() {
  const el = $('#year');
  if (el) el.textContent = new Date().getFullYear();
}

// ═══════════════════════════════════════════════════════════
//  BOOT — 每个步骤独立 try/catch，避免单点错误影响全局
// ═══════════════════════════════════════════════════════════
function safeRun(name, fn) {
  try { fn(); }
  catch (err) { console.warn('[iris] ' + name + ' failed:', err); }
}

function boot() {
  safeRun('initLenis', initLenis);     // 必须先于 GSAP，让 ScrollTrigger 用 lenis scroll 事件同步
  safeRun('splitHeroH1', splitHeroH1);
  safeRun('drawFeaturePoints', drawFeaturePoints);
  safeRun('drawBinaryGrid', drawBinaryGrid);
  safeRun('initNav', initNav);
  safeRun('initYear', initYear);
  safeRun('initSpotlightCards', initSpotlightCards);
  safeRun('initCursor', initCursor);
  safeRun('initMagneticButtons', initMagneticButtons);
  safeRun('initIrisScene', initIrisScene);
  safeRun('initHudSpectrum', initHudSpectrum);
  safeRun('initScrollProgress', initScrollProgress);
  safeRun('initCharReveal', initCharReveal);
  safeRun('initNumberScramble', initNumberScramble);
  safeRun('initOutlineFill', initOutlineFill);

  // GSAP 在模块执行前已由 CDN 同步加载，因此通常立即可用
  const runGsap = () => {
    if (!window.gsap) { setTimeout(runGsap, 80); return; }
    safeRun('animateHeroEntrance', animateHeroEntrance);
    safeRun('initGsap', initGsap);
  };
  runGsap();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
