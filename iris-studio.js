// ═══════════════════════════════════════════════════════════
//  Iris Studio · R3F + Drei + Bloom
//  · 可拖拽旋转的 3D 虹膜（球体 + 自定义 GLSL shader）
//  · 双击触发 "scan" 脉冲动画
//  · 自动慢转，鼠标交互时停转
// ═══════════════════════════════════════════════════════════

import { createElement, useRef, useMemo, useState, useEffect, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useTexture } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'https://esm.sh/postprocessing@6.35.5?deps=three@0.160.0';
import * as THREE from 'three';
import htm from 'htm';

const html = htm.bind(createElement);

// 仅真鼠标设备显示（移动端跳过 R3F · 太重）
const SUPPORTS_INTERACTIVE = matchMedia('(hover: hover) and (pointer: fine)').matches;
const PREFERS_REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ═══════════════════════════════════════════════════════════
//  IrisSphere · 球面 + 着色器
// ═══════════════════════════════════════════════════════════
function IrisSphere({ scanPulse }) {
  const meshRef = useRef();
  const matRef = useRef();
  const tex = useTexture('./assets/iris-2.jpg');

  useEffect(() => {
    if (tex) tex.colorSpace = THREE.SRGBColorSpace;
  }, [tex]);

  const onBeforeCompile = useMemo(() => (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uScanPulse = { value: 0 };
    shader.uniforms.uAccent = { value: new THREE.Color('#CD7F32') };
    shader.uniforms.uBlue = { value: new THREE.Color('#4CB3FF') };

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `
      #include <common>
      uniform float uTime;
      uniform float uScanPulse;
      uniform vec3 uAccent;
      uniform vec3 uBlue;
      varying vec3 vWorldPos;
      `
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `
      #include <worldpos_vertex>
      vWorldPos = worldPosition.xyz;
      `
    ).replace(
      '#include <common>',
      `
      #include <common>
      varying vec3 vWorldPos;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      #include <dithering_fragment>
      vec3 col = gl_FragColor.rgb;
      col.r *= 0.85;
      col.b *= 1.30;
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(lum) * uBlue, col, 0.78);
      col *= 1.10;
      float scanY = sin(uTime * 0.8) * 1.4;
      float scan = smoothstep(0.06, 0.0, abs(vWorldPos.y - scanY));
      col += uAccent * scan * 0.55;
      if (uScanPulse > 0.01) {
        float dist = length(vWorldPos.xy);
        float ringR = uScanPulse * 2.0;
        float ring = smoothstep(0.08, 0.0, abs(dist - ringR));
        col += uAccent * ring * (1.0 - uScanPulse) * 1.5;
      }
      gl_FragColor = vec4(col, gl_FragColor.a);
      `
    );

    matRef.current.userData.shader = shader;
  }, []);

  useFrame((state) => {
    const shader = matRef.current?.userData?.shader;
    if (shader) {
      shader.uniforms.uTime.value = state.clock.elapsedTime;
      shader.uniforms.uScanPulse.value = scanPulse.current;
    }
    if (scanPulse.current > 0) {
      scanPulse.current = Math.max(0, scanPulse.current - 0.018);
    }
  });

  return html`
    <mesh ref=${meshRef} scale=${[1.6, 1.6, 1.6]}>
      <sphereGeometry args=${[1, 96, 96]} />
      <meshStandardMaterial
        ref=${matRef}
        map=${tex}
        roughness=${0.32}
        metalness=${0.18}
        emissive=${new THREE.Color('#0A1A2E')}
        emissiveIntensity=${0.4}
        onBeforeCompile=${onBeforeCompile}
      />
    </mesh>
  `;
}

function Lights() {
  return html`
    <${'ambientLight'} intensity=${0.25} />
    <${'directionalLight'} position=${[3, 2, 5]} intensity=${1.4} color="#FFFFFF" />
    <${'pointLight'} position=${[-4, 0, 2]} intensity=${1.2} color="#4CB3FF" />
    <${'pointLight'} position=${[4, 0, -2]} intensity=${0.8} color="#CD7F32" />
  `;
}

function AutoRotate({ enabled }) {
  const { scene } = useThree();
  useFrame((_, delta) => {
    if (!enabled) return;
    const iris = scene.children.find((c) => c.type === 'Mesh');
    if (iris) iris.rotation.y += delta * 0.18;
  });
  return null;
}

function Stage() {
  const scanPulse = useRef(0);
  const [autoRotate, setAutoRotate] = useState(true);

  const onUserStart = () => setAutoRotate(false);
  const onUserEnd = () => setTimeout(() => setAutoRotate(true), 3000);
  const onDoubleClick = () => { scanPulse.current = 1.0; };

  return html`
    <${Suspense} fallback=${null}>
      <${IrisSphere} scanPulse=${scanPulse} />
      <${Lights} />
      <${AutoRotate} enabled=${autoRotate && !PREFERS_REDUCED_MOTION} />
      <${OrbitControls}
        enableZoom=${false}
        enablePan=${false}
        minPolarAngle=${Math.PI * 0.25}
        maxPolarAngle=${Math.PI * 0.75}
        rotateSpeed=${0.6}
        dampingFactor=${0.08}
        onStart=${onUserStart}
        onEnd=${onUserEnd}
      />
      <${EffectComposer}>
        <${Bloom}
          intensity=${0.85}
          luminanceThreshold=${0.45}
          luminanceSmoothing=${0.3}
          mipmapBlur=${true}
        />
        <${ChromaticAberration}
          blendFunction=${BlendFunction.NORMAL}
          offset=${[0.0008, 0.0008]}
        />
      <//>
      <mesh onDoubleClick=${onDoubleClick} visible=${false}>
        <sphereGeometry args=${[3, 8, 8]} />
        <meshBasicMaterial transparent opacity=${0} />
      </mesh>
    <//>
  `;
}

function StudioApp() {
  return html`
    <${Canvas}
      dpr=${[1, 2]}
      gl=${{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera=${{ position: [0, 0, 5], fov: 38, near: 0.1, far: 100 }}
      style=${{ background: 'transparent' }}
    >
      <color attach="background" args=${['#000000']} />
      <${Stage} />
    <//>
  `;
}

// ═══════════════════════════════════════════════════════════
//  移动端 fallback · 用 DOM API 安全构造（不用 innerHTML）
// ═══════════════════════════════════════════════════════════
function buildMobileFallback(parent) {
  while (parent.firstChild) parent.removeChild(parent.firstChild);
  const wrap = document.createElement('div');
  wrap.style.cssText = `
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    flex-direction: column; gap: 16px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px; letter-spacing: 0.22em;
    color: rgba(244, 245, 247, 0.42);
    text-align: center; padding: 24px;
  `;
  const orb = document.createElement('div');
  orb.style.cssText = `
    width: 200px; height: 200px;
    background: url('./assets/iris-2.jpg') center/cover;
    border-radius: 50%;
    filter: brightness(0.8) contrast(1.15) saturate(0.9) hue-rotate(-8deg);
    mask: radial-gradient(circle, black 50%, transparent 70%);
  `;
  const label = document.createElement('span');
  label.textContent = '3D STUDIO · 桌面端可用';
  wrap.appendChild(orb);
  wrap.appendChild(label);
  parent.appendChild(wrap);
}

function mount() {
  const el = document.getElementById('iris-studio-mount');
  if (!el) return;

  if (!SUPPORTS_INTERACTIVE || matchMedia('(max-width: 768px)').matches) {
    buildMobileFallback(el);
    return;
  }

  const start = () => {
    try {
      createRoot(el).render(createElement(StudioApp));
    } catch (err) {
      console.warn('[iris-studio] mount failed:', err);
      while (el.firstChild) el.removeChild(el.firstChild);
    }
  };
  // 延时挂载，避开 Hero 初始化峰值——但用 setTimeout 兜底
  // requestIdleCallback 在隐藏 tab 不触发，用 timeout 才稳
  setTimeout(start, 500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
