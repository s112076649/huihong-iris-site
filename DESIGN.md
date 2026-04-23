# DESIGN.md

> **一台静止运行的精密仪器——黑曜石外壳里，藏着一束正在扫描的光。**

## 1. Visual Theme & Atmosphere

**Style**: Biotech Sovereign（生物科技 × 主权精密）— Neuralink 纯黑克制 × Anduril 军工橙红打击

**Keywords**: precision, biotech, obsidian, sovereign, lumen, imperceptible, forged, living

**Tone**: 冷静 · 收敛 · 可敬畏 · 有生命感 — **NOT** 可爱 / 亲切 / 活泼 / 消费电子感

**Feel**: 像一只还在呼吸的精密仪器：外表是黑曜石的静默，内里有一束橙光在缓慢扫描。你靠近它，它已经认出你。

**Interaction Tier**: **L3 沉浸体验**
**Dependencies**: Three.js (ES module) + GSAP + ScrollTrigger

## 2. Color Palette & Roles

```css
:root {
  /* Backgrounds — 纯黑为底，表面有微层次 */
  --bg: #000000;
  --bg-rgb: 0, 0, 0;
  --surface: #0A0A0A;
  --surface-alt: #0F1012;
  --surface-hover: #16181C;

  /* Borders — 极低对比，hover 时橙色亮起 */
  --border: rgba(255, 255, 255, 0.06);
  --border-strong: rgba(255, 255, 255, 0.14);
  --border-hover: rgba(255, 107, 53, 0.45);

  /* Text — 纯白为主，降级至灰阶 */
  --text: #FFFFFF;
  --text-secondary: rgba(255, 255, 255, 0.72);
  --text-tertiary: rgba(255, 255, 255, 0.42);
  --text-mono: rgba(255, 255, 255, 0.88);

  /* Accent — 单一橙红强调色（Anduril 家族） */
  --accent: #FF6B35;
  --accent-rgb: 255, 107, 53;
  --accent-hover: #FF8A5C;
  --accent-deep: #C94A1D;
  --accent-glow: rgba(255, 107, 53, 0.40);

  /* Iris asset color — 仅用于 3D 虹膜本体，不入 UI */
  --iris-core: #4A9EFF;
  --iris-violet: #7B5CFF;
  --iris-gold: #FFB547;

  /* Semantic */
  --success: #4ADE80;
  --error: #F87171;
  --warning: #FBBF24;
}
```

**Color Rules:**
- 所有颜色必须通过 CSS 变量引用，**零硬编码 hex**
- 单 section 内最多一个强调色（橙色），不混用 iris-blue/violet 做 UI
- iris-blue / iris-violet / iris-gold **仅限 3D 虹膜材质**使用
- 文字色按重要性递减使用 text → text-secondary → text-tertiary
- 橙色（accent）只用于：CTA 按钮、当前激活态、关键数据高亮、可点击 icon
- 大面积橙色渐变背景禁用——Anduril 调性是"黑底+橙色打击"，不是"橙色氛围"

## 3. Typography Rules

**Font Stack:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;700&family=Noto+Sans+SC:wght@200;300;400;500;700&family=JetBrains+Mono:wght@400;500&display=swap');

--font-display: 'Inter', 'Noto Sans SC', system-ui, -apple-system, sans-serif;
--font-body:    'Inter', 'Noto Sans SC', system-ui, -apple-system, sans-serif;
--font-mono:    'JetBrains Mono', 'SF Mono', Menlo, monospace;
```

| Role | Font | Size (D/M) | Weight | Line Height | Letter Spacing |
|------|------|------------|--------|-------------|----------------|
| Hero H1 | Inter + Noto SC | 104px / 48px | 200 (thin) | 0.95 | -0.02em |
| Hero Sub | Inter | 18px / 15px | 300 | 1.55 | 0 |
| Section H2 | Inter + Noto SC | 64px / 36px | 300 | 1.05 | -0.01em |
| H3 | Inter + Noto SC | 28px / 22px | 400 | 1.3 | 0 |
| Body | Inter + Noto SC | 16px / 15px | 400 | 1.75 | 0 |
| Eyebrow/Label | Inter | 11px / 11px | 500 | 1 | 0.18em uppercase |
| Mono/Data | JetBrains Mono | 14-16px | 400 | 1.5 | 0 |

**Typography Rules:**
- Hero H1 强制使用 weight 200—细体是 Neuralink 调性的核心，厚体会瞬间破坏气质
- Section 标题 weight 300-400，永不超过 500
- 中文行高 ≥ 1.7，letter-spacing: 0.02em
- 数据/技术参数（1/10⁷⁸、256、2048、毫秒等）**必须用 JetBrains Mono**，orange 高亮
- **NEVER use**: 任何 serif 字体 / Arial / Helvetica 回退 / Emoji / 花字 / 斜体正文

**Text Decoration:**
- Hero H1: **无渐变、无投影**——纯白，靠字重和尺寸撑场
- Section H2: **无装饰**
- 关键词 inline 强调：橙色下划线 2px + hover 时 transform scaleX
- 大数据字（10⁷⁸、1/10⁷⁸）：橙色 + mono，**不加渐变**

## 4. Component Stylings

### Buttons

```css
.btn {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.02em;
  padding: 14px 28px;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  display: inline-flex; align-items: center; gap: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text);
  position: relative;
  overflow: hidden;
}

.btn-primary { background: var(--accent); color: #000; }
.btn-primary:hover {
  background: var(--accent-hover);
  box-shadow: 0 0 0 1px var(--accent), 0 0 40px var(--accent-glow);
  transform: translateY(-1px);
}
.btn-primary:active { transform: translateY(0); }
.btn-primary:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }

.btn-ghost { border: 1px solid var(--border-strong); color: var(--text); }
.btn-ghost:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(var(--accent-rgb), 0.04);
}
.btn-ghost:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
```

### Cards (Spotlight)

```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 32px;
  transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  position: relative;
  overflow: hidden;
}
.card::before {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(600px circle at var(--mx, 50%) var(--my, 50%),
    rgba(var(--accent-rgb), 0.08), transparent 40%);
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
}
.card:hover { border-color: var(--border-hover); transform: translateY(-2px); }
.card:hover::before { opacity: 1; }
.card:focus-within { outline: 1px solid var(--accent); outline-offset: 2px; }
```

### Navigation

```css
.nav {
  position: fixed; inset: 0 0 auto 0;
  z-index: 100;
  padding: 20px 48px;
  display: flex; justify-content: space-between; align-items: center;
  transition: all 0.4s ease;
  background: transparent;
  border-bottom: 1px solid transparent;
}
.nav.scrolled {
  background: rgba(var(--bg-rgb), 0.72);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom-color: var(--border);
  padding: 14px 48px;
}
.nav-links { display: flex; gap: 32px; }
.nav-link {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0.02em;
  position: relative;
  transition: color 0.3s ease;
}
.nav-link:hover { color: var(--text); }
.nav-link::after {
  content: ''; position: absolute; left: 0; bottom: -4px;
  width: 0; height: 1px; background: var(--accent);
  transition: width 0.3s ease;
}
.nav-link:hover::after { width: 100%; }
```

### Links (inline)

```css
.link {
  color: var(--text);
  text-decoration: none;
  border-bottom: 1px solid var(--accent);
  padding-bottom: 1px;
  transition: color 0.3s ease;
}
.link:hover { color: var(--accent); }
```

### Tags / Eyebrow

```css
.eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11px; font-weight: 500;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--accent);
  padding: 6px 12px;
  border: 1px solid var(--border-hover);
  border-radius: 2px;
  background: rgba(var(--accent-rgb), 0.04);
}
.eyebrow::before {
  content: '';
  width: 6px; height: 6px;
  background: var(--accent);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
```

### Stat Display（1/10⁷⁸, 256, 2048）

```css
.stat {
  font-family: var(--font-mono);
  font-size: clamp(48px, 8vw, 128px);
  font-weight: 400;
  color: var(--accent);
  line-height: 1;
  letter-spacing: -0.02em;
  display: inline-block;
}
.stat-label {
  font-family: var(--font-display);
  font-size: 12px;
  letter-spacing: 0.2em;
  color: var(--text-tertiary);
  text-transform: uppercase;
  margin-top: 12px;
}
```

## 5. Layout Principles

**Container:**
- Max width: `1280px`
- Padding: `0 48px` desktop, `0 24px` mobile
- Narrow (text-heavy): `720px`

**Spacing Scale:**
- Section padding-y: `clamp(80px, 12vh, 160px)`
- Component gap: `32px` 大 / `16px` 小
- Card internal padding: `32px` desktop, `24px` mobile
- Hero top padding: `180px`（为 nav 留空间）

**Grid:**
```css
.container {
  width: 100%; max-width: 1280px;
  margin: 0 auto; padding-inline: 48px;
}
.grid-12 { display: grid; grid-template-columns: repeat(12, 1fr); gap: 32px; }
.bento-scenarios {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr;
  grid-template-rows: 280px 280px;
  gap: 16px;
}
.bento-scenarios > *:nth-child(1) { grid-row: 1 / 3; }
```

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat | `border: 1px solid var(--border)` | 默认卡片、section |
| Glow | `box-shadow: 0 0 40px var(--accent-glow)` | Primary CTA hover |
| Halo | `box-shadow: 0 0 0 1px var(--accent), 0 0 80px rgba(var(--accent-rgb), 0.2)` | 激活态 / 选中 |
| Elevated | `box-shadow: 0 24px 80px -20px #000, 0 0 0 1px var(--border-strong)` | Modal / 下拉 |

**Depth Rule**: 通篇以 **flat** 为主，深度留给交互反馈和 3D 场景。暗色设计禁忌"重阴影"。

## 7. Animation & Interaction

**Motion Philosophy**: 每一次动效都像虹膜缓慢开合——克制、精准、有生命感。静止时也能感受到"它在观察"。

**Tier**: **L3 沉浸体验**

### Dependencies

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
  }
}
</script>
```

### Base Setup

```js
gsap.registerPlugin(ScrollTrigger);
gsap.defaults({ ease: 'power3.out', duration: 1.0 });

// Spotlight cursor for cards
let rafId;
document.querySelectorAll('.card').forEach(card => {
  card.addEventListener('pointermove', e => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - rect.left) + 'px');
      card.style.setProperty('--my', (e.clientY - rect.top) + 'px');
    });
  });
});
```

### Entrance Animation (Hero char stagger — 使用安全 DOM API)

```css
.hero-h1 .char { display: inline-block; transform: translateY(100%); opacity: 0; }
```
```js
// 安全分字：不用 innerHTML，用 DOM API
const h1 = document.querySelector('.hero-h1');
const text = h1.textContent;
h1.textContent = '';
for (const c of text) {
  const span = document.createElement('span');
  span.className = 'char';
  span.textContent = c === ' ' ? '\u00A0' : c;
  h1.appendChild(span);
}
gsap.to('.hero-h1 .char', {
  y: 0, opacity: 1,
  stagger: 0.035, duration: 1.2,
  ease: 'power4.out', delay: 0.4,
});
```

### Scroll Behavior (signature moments)

```js
// 1. Generic reveal
gsap.utils.toArray('[data-reveal]').forEach(el => {
  gsap.from(el, {
    y: 60, opacity: 0, duration: 1,
    scrollTrigger: { trigger: el, start: 'top 80%' }
  });
});

// 2. 数字 counter（1/10⁷⁸, 256, 2048）
gsap.utils.toArray('[data-count]').forEach(el => {
  const target = parseFloat(el.dataset.count);
  const obj = { v: 0 };
  gsap.to(obj, {
    v: target, duration: 2, ease: 'power2.out',
    scrollTrigger: { trigger: el, start: 'top 85%' },
    onUpdate() { el.textContent = Math.floor(obj.v).toLocaleString(); }
  });
});

// 3. Pin-scrub 虹膜解剖章节
ScrollTrigger.create({
  trigger: '#tech-pin',
  start: 'top top', end: '+=200%',
  pin: true, scrub: 1,
  onUpdate: self => {
    const p = self.progress;
    document.querySelector('#iris-layer-1').style.opacity = p < 0.33 ? 1 : 0;
    document.querySelector('#iris-layer-2').style.opacity = (p >= 0.33 && p < 0.66) ? 1 : 0;
    document.querySelector('#iris-layer-3').style.opacity = p >= 0.66 ? 1 : 0;
  }
});

// 4. Marquee 宣言横滚
gsap.to('.marquee-track', {
  xPercent: -50, repeat: -1, duration: 28, ease: 'none'
});
```

### Hover & Focus States

- 所有 btn/card/link 必须有 hover + focus-visible
- `a, button` 默认 `transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1)`
- Focus-visible 用 `outline: 2px solid var(--accent); outline-offset: 3px`

### Special Effects（签名时刻 — 6+ 类覆盖 L3 红线）

| # | 类别 | 落点 | 实现 |
|---|------|------|------|
| 1 | Text — Hero H1 | "一把长在身体里的钥匙" | 字符 stagger 上浮（DOM API 安全分字） |
| 2 | Text — Section H2 | 每个 section 标题 | ScrollTrigger + fade up |
| 3 | Text — Data/Body | 1/10⁷⁸ / 256 / 2048 counter | gsap tween + scrollTrigger |
| 4 | Element — CTA | primary button | hover glow + translateY |
| 5 | Component — SpotlightCard | 场景 bento 卡片 | --mx/--my + radial gradient |
| 6 | Component — 3D Iris Hero | Hero 虹膜 + 钥匙涌现 | Three.js 旋转 + scroll 联动 |
| 7 | Component — Pin-scrub 虹膜解剖 | tech section | GSAP ScrollTrigger pin |
| 8 | Background — Grainient 氛围 | 全局 subtle grain 背景 | CSS + SVG noise |

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .char { transform: none !important; opacity: 1 !important; }
  #hero-3d-canvas { display: none; }
  #hero-3d-fallback { display: block; }
}
```

## 8. Do's and Don'ts

### Do
- ✅ 所有颜色通过 CSS 变量引用，零硬编码 hex
- ✅ 数据和技术参数（1/10⁷⁸、256、2048、毫秒等）必须用 JetBrains Mono + orange
- ✅ Hero H1 用 Inter 200 细体，中英混排用 Noto Sans SC 200
- ✅ 橙色只作为"打击色"——CTA、激活态、关键数据，不做大面积氛围
- ✅ 每个可交互元素都要有 hover + focus-visible + reduced-motion 降级
- ✅ 3D / WebGL 全页仅 1 处（Hero），离开视口时暂停渲染
- ✅ 中文正文行高 ≥ 1.7，letter-spacing: 0.02em
- ✅ 虹膜 3D 素材可用 blue/violet/gold 多色，UI 部分严守黑+白+橙
- ✅ 使用 DOM API 构造元素，禁用 innerHTML

### Don't
- ❌ 不用任何 serif 字体（Playfair / Merriweather / 思源宋体等）——气质不符
- ❌ 不用 emoji（锁头 / 目标 / 火箭 等）——B2B 军工调性不兼容
- ❌ 不用大面积橙色渐变背景——Anduril 调性是"黑底橙击"不是"橙色氛围"
- ❌ 不用 iris-blue / iris-violet 做 UI 元素——仅限 3D 材质
- ❌ 不用花字 / 斜体 / 下划线装饰正文
- ❌ 不用纯色块占位图——用 SVG 线稿 / 真实生物特写 / Unsplash
- ❌ 不用多个 3D 场景——单 Hero 3D，其余用 CSS/SVG
- ❌ 不用 backdrop-filter blur 值 > 14px，且不覆盖大面积滚动区
- ❌ 不用厚重黑色投影——暗色设计的深度来自 border 和 glow
- ❌ 不在 hero H1 上加渐变文字或投影——克制风的自杀行为
- ❌ 不用 innerHTML 拼接内容——统一用 createElement + textContent

## 9. Responsive Behavior

**Breakpoints:**

| Name | Width | Key Changes |
|------|-------|-------------|
| Desktop | > 1024px | 12-col grid, 3D Hero, Bento 3-col |
| Tablet | 640-1024px | 8-col, 3D 保留但缩小, Bento 2-col |
| Mobile | < 640px | Single column, 3D → 静态 SVG, Bento 1-col stack |

**Touch Targets:** minimum `44px × 44px`
**Collapsing Strategy:**
- Nav → 汉堡菜单（< 768px）
- Bento → 单列垂直堆叠
- Pin-scrub → 降级为普通 scroll reveal（pin 在 mobile 禁用）
- Hero 3D → CSS mask 虹膜 SVG 静态图 + 简化字符入场

```css
@media (max-width: 1024px) {
  .container { padding-inline: 32px; }
  .bento-scenarios { grid-template-columns: 1fr 1fr; grid-template-rows: auto; }
  .bento-scenarios > *:nth-child(1) { grid-row: auto; }
}
@media (max-width: 640px) {
  .container { padding-inline: 24px; }
  .nav { padding: 14px 24px; }
  .nav-links { display: none; }
  .bento-scenarios { grid-template-columns: 1fr; }
  #hero-3d-canvas { display: none; }
  #hero-3d-fallback { display: block; }
  .stat { font-size: clamp(40px, 14vw, 72px); }
}
```

---

## 页面结构（Phase C 生成清单）

单页 Landing（`index.html`），7 个 section：

1. **Nav** — Logo 虹膜科技 IRIS · 产品 · 场景 · 技术 · 关于 · 联系
2. **Hero** — 3D 虹膜 + 钥匙涌现 + 主标语「一把长在身体里的钥匙」+ 副标语「1/10⁷⁸ · 复制不了的那一厘米」+ 双 CTA
3. **Marquee 宣言带** — THE CENTIMETER THAT CANNOT BE COPIED · 1/10⁷⁸ · OWNED CORE · (repeating)
4. **Stats 数据爆发** — 1/10⁷⁸ / 256 坐标点 / 2048 bit / < 0.3s 四连
5. **Bento 场景 4 宫** — 政企安防 · 金融风控 · 医疗身份 · 消费 IoT
6. **Tech Pin-scrub 虹膜解剖** — 虹膜 SVG 分层揭示（特征提取 → 编码 → 匹配）
7. **About · Contact · Footer** — 公司简介 + 合作入口 + 版权
