const PURPLE = "#8138ff";
const PURPLE_SOFT = "#d8adfe";
const PINK = "#ff73ff";
const NAVY = "#15154d";
const BLUE = "#3a4ea1";
const GRID = "#c8c8dc";
const INK = "#15154d";

const animParams = new URLSearchParams(window.location.search);

function animationsEnabled() {
  // Opt out only via URL; keep motion on by default (incl. iOS Safari)
  if (animParams.get("animate") === "no") return false;
  if (window.matchMedia("(max-width: 860px)").matches && animParams.get("mobileanimate") === "no") {
    return false;
  }
  return true;
}

const ANIM_ON = animationsEnabled();
if (!ANIM_ON) document.documentElement.classList.add("no-animate");

function svgEl(name, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function polyline(points) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

/** HTML dots like graphic-3 .hotspot (box-shadow pulse) — overlay, not foreignObject. */
function makeAnnDotLayer(host, svgW, svgH) {
  const layer = document.createElement("div");
  layer.className = "ann-dot-layer";
  layer.style.aspectRatio = `${svgW} / ${svgH}`;
  host.appendChild(layer);
  return layer;
}

function makeAnnDot(layer, svgW, svgH, x, y, color) {
  const el = document.createElement("div");
  el.className = "ann-dot";
  el.style.setProperty("--ann-color", color);
  el.style.left = `${(x / svgW) * 100}%`;
  el.style.top = `${(y / svgH) * 100}%`;
  el.dataset.x = String(x);
  el.dataset.y = String(y);
  layer.appendChild(el);
  return el;
}

function setAnnDotPulsing(el, on) {
  if (!el) return;
  el.classList.toggle("is-pulsing", !!on);
}

/** Idle: pulse step groups in a loop. Selection: lock() specific els. */
function createPulseTour({
  getSteps,
  applyPulse = setAnnDotPulsing,
  intervalMs = 1800,
  gapMs = 0,
} = {}) {
  let timer = 0;
  let step = 0;
  let mode = "stop"; // stop | tour | lock
  const known = new Set();

  const remember = (els) => {
    (els || []).forEach((el) => {
      if (el) known.add(el);
    });
  };

  const paint = (els) => {
    const list = (els || []).filter(Boolean);
    remember(list);
    remember(getSteps().flat());
    const on = new Set(list);
    known.forEach((el) => applyPulse(el, on.has(el)));
  };

  const clear = () => {
    remember(getSteps().flat());
    known.forEach((el) => applyPulse(el, false));
  };

  const stopTimer = () => {
    if (!timer) return;
    window.clearTimeout(timer);
    window.clearInterval(timer);
    timer = 0;
  };

  const scheduleAfterPulse = () => {
    if (mode !== "tour") return;
    if (!gapMs) {
      timer = window.setInterval(tick, intervalMs);
      return;
    }
    // Hold pulse for intervalMs → clear → pause gapMs → next
    timer = window.setTimeout(() => {
      if (mode !== "tour") return;
      clear();
      timer = window.setTimeout(() => {
        if (mode !== "tour") return;
        tick();
      }, gapMs);
    }, intervalMs);
  };

  const tick = () => {
    if (mode !== "tour") return;
    const steps = getSteps().filter((s) => s?.length);
    if (!steps.length) {
      clear();
      return;
    }
    if (step >= steps.length) step = 0;
    paint(steps[step]);
    step = (step + 1) % steps.length;
    if (gapMs) scheduleAfterPulse();
  };

  const startTour = () => {
    mode = "tour";
    stopTimer();
    step = 0;
    tick();
    if (!gapMs) timer = window.setInterval(tick, intervalMs);
  };

  const lock = (els) => {
    mode = "lock";
    stopTimer();
    paint(els || []);
  };

  const stop = () => {
    mode = "stop";
    stopTimer();
    clear();
  };

  return { startTour, lock, stop, clear };
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function visibleRatio(el) {
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  const vw = window.innerWidth || document.documentElement.clientWidth || 0;
  if (vw <= 0 || vh <= 0 || rect.width <= 0 || rect.height <= 0) return 0;
  const visibleH = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
  const visibleW = Math.min(rect.right, vw) - Math.max(rect.left, 0);
  if (visibleH <= 0 || visibleW <= 0) return 0;
  // Tall blocks can't reach high intersectionRatio; treat vs min(block, viewport)
  return Math.min(1, visibleH / Math.min(rect.height, vh));
}

function whenInView(el, onEnter, threshold = 0.12) {
  if (!el) return;
  if (!ANIM_ON) {
    el.classList.add("is-in", "is-anim-done");
    onEnter?.(el);
    return;
  }

  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    el.classList.add("is-in");
    onEnter?.(el);
    io.disconnect();
  };

  const steps = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.75, 1];
  if (!steps.includes(threshold)) steps.push(threshold);
  steps.sort((a, b) => a - b);

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        // Prefer IO ratio; fall back to tall-block friendly measure
        const ratio = Math.max(e.intersectionRatio, visibleRatio(el));
        if (ratio >= threshold) run();
      });
    },
    { threshold: steps, rootMargin: "0px" }
  );
  io.observe(el);

  // Safari often skips the initial IO callback for already-visible nodes
  const checkNow = () => {
    if (done) return;
    if (visibleRatio(el) >= threshold) run();
  };
  requestAnimationFrame(() => {
    checkNow();
    requestAnimationFrame(checkNow);
  });
  window.setTimeout(checkNow, 100);
  window.setTimeout(checkNow, 400);
}

const MOBILE_MQ = "(max-width: 860px)";
const isMobileView = () => window.matchMedia(MOBILE_MQ).matches;

/**
 * Mobile copy entrance: fire when the element's top is `insetPx` past the
 * viewport bottom (i.e. 100px of the element has entered from below).
 */
function whenTopPastViewportBottom(el, onEnter, insetPx = 100) {
  if (!el) return;
  if (!ANIM_ON) {
    el.classList.add("is-in", "is-anim-done");
    onEnter?.(el);
    return;
  }

  let done = false;
  let io = null;

  const ready = () => {
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    if (vh <= 0) return false;
    return el.getBoundingClientRect().top <= vh - insetPx;
  };

  const cleanup = () => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
    io?.disconnect();
    io = null;
  };

  const run = () => {
    if (done) return;
    done = true;
    cleanup();
    el.classList.add("is-in");
    onEnter?.(el);
  };

  const onScroll = () => {
    if (done) return;
    if (ready()) run();
  };

  io = new IntersectionObserver(() => onScroll(), {
    rootMargin: `0px 0px -${insetPx}px 0px`,
    threshold: [0, 0.01],
  });
  io.observe(el);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  requestAnimationFrame(() => {
    onScroll();
    requestAnimationFrame(onScroll);
  });
  window.setTimeout(onScroll, 100);
  window.setTimeout(onScroll, 400);
}

/** Desktop: ratio threshold. Mobile: top 100px past viewport bottom. */
function whenCopyInView(el, onEnter, desktopThreshold = 0.5) {
  if (isMobileView()) whenTopPastViewportBottom(el, onEnter, 100);
  else whenInView(el, onEnter, desktopThreshold);
}

/** Split element text into word spans for rise-in animation. Keeps <br>. */
function prepareRiseText(el) {
  if (!el || el.dataset.riseReady) return [...el.querySelectorAll(".anim-rise")];
  el.dataset.riseReady = "1";
  const nodes = [...el.childNodes];
  el.textContent = "";
  const spans = [];
  nodes.forEach((node) => {
    if (node.nodeName === "BR") {
      el.appendChild(document.createElement("br"));
      return;
    }
    if (node.nodeType !== Node.TEXT_NODE) {
      el.appendChild(node);
      return;
    }
    const parts = node.textContent.split(/(\s+)/);
    parts.forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        el.appendChild(document.createTextNode(part));
        return;
      }
      const span = document.createElement("span");
      span.className = "anim-rise";
      span.textContent = part;
      el.appendChild(span);
      spans.push(span);
    });
  });
  return spans;
}

async function playRiseText(el, { stagger = 38, startDelay = 0 } = {}) {
  if (!el) return;
  if (!ANIM_ON) {
    el.classList.add("is-shown");
    prepareRiseText(el).forEach((s) => s.classList.add("is-shown"));
    return;
  }
  const spans = prepareRiseText(el);
  await wait(startDelay);
  for (let i = 0; i < spans.length; i++) {
    spans[i].classList.add("is-shown");
    if (i < spans.length - 1) await wait(stagger);
  }
  await wait(280);
}

/** Hide title/sub copy as rise-spans before the block enters the viewport. */
function armRiseText(...els) {
  if (!ANIM_ON) return;
  els.forEach((el) => {
    if (el) prepareRiseText(el);
  });
}

/** Split element into visual lines using the browser's real wrap (block rise). */
function prepareRiseLines(el) {
  if (!el) return [];
  if (el.dataset.riseReady === "lines") return [...el.querySelectorAll(".anim-rise-line")];
  el.dataset.riseReady = "lines";

  const raw = el.innerText.replace(/\s+/g, " ").trim();
  if (!raw) return [];

  // Measure with full text in place so wrap matches final layout
  el.textContent = raw;
  const textNode = el.firstChild;
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return [];

  const range = document.createRange();
  const starts = [0];
  let prevTop = null;

  for (let i = 0; i < raw.length; i++) {
    range.setStart(textNode, i);
    range.setEnd(textNode, i + 1);
    const r = range.getBoundingClientRect();
    if (!r.height && !r.width) continue;
    if (prevTop !== null && Math.abs(r.top - prevTop) > 2) {
      starts.push(i);
    }
    prevTop = r.top;
  }

  const lineStrings = starts
    .map((start, idx) => {
      const end = starts[idx + 1] ?? raw.length;
      return raw.slice(start, end).trim();
    })
    .filter(Boolean);

  el.textContent = "";
  return lineStrings.map((str) => {
    const line = document.createElement("span");
    line.className = "anim-rise-line anim-rise-block";
    line.style.display = "block";
    line.textContent = str;
    el.appendChild(line);
    return line;
  });
}

function armRiseLines(...els) {
  if (!ANIM_ON) return;
  const armOne = (el) => {
    if (!el) return;
    if (el.dataset.riseReady === "lines") {
      const text = [...el.querySelectorAll(".anim-rise-line")].map((s) => s.textContent).join(" ");
      el.textContent = text;
      delete el.dataset.riseReady;
    }
    prepareRiseLines(el);
  };
  els.forEach(armOne);
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      els.forEach((el) => {
        if (!el || el.closest(".is-in, .is-anim-done")) return;
        armOne(el);
      });
    });
  }
}

async function playRiseLines(el, { stagger = 140, startDelay = 0 } = {}) {
  if (!el) return;
  if (!ANIM_ON) {
    prepareRiseLines(el).forEach(showEl);
    return;
  }
  const lines = prepareRiseLines(el);
  await wait(startDelay);
  for (let i = 0; i < lines.length; i++) {
    showEl(lines[i]);
    if (i < lines.length - 1) await wait(stagger);
  }
  await wait(280);
}

/** Arm chart text/source and return wrap. Visibility gated by CSS until .is-in. */
function setupChartAnim(root) {
  const wrap = root.closest(".graphic-chart") || root;
  wrap.classList.add("anim-chart");
  if (ANIM_ON) {
    const sourceEl = wrap.querySelector(".source");
    if (sourceEl) sourceEl.classList.add("anim-fade");
    armRiseText(wrap.querySelector("figcaption h3"));
    armRiseLines(wrap.querySelector("figcaption p"));
  }
  return wrap;
}

function showEl(el) {
  if (!el) return;
  el.classList.add("is-shown");
}

function animX(el) {
  if (!el?.getAttribute) return 0;
  const dx = el.getAttribute("data-anim-x");
  if (dx != null && dx !== "") return Number(dx);
  const cx = el.getAttribute("cx");
  if (cx != null && cx !== "") return Number(cx);
  const x = el.getAttribute("x");
  if (x != null && x !== "") return Number(x);
  const tr = el.getAttribute("transform") || "";
  const m = tr.match(/translate\(\s*([-.\d]+)/);
  if (m) return Number(m[1]);
  const child = el.querySelector?.("circle[cx], text[x], [transform]");
  return child ? animX(child) : 0;
}

async function showStaggerLTR(els, stagger = 28) {
  const sorted = [...els].sort((a, b) => animX(a) - animX(b) || 0);
  // Same x → show together (e.g. both series dots + scrubber)
  const groups = [];
  sorted.forEach((el) => {
    const x = animX(el);
    const last = groups[groups.length - 1];
    if (last && Math.abs(last.x - x) < 3) last.els.push(el);
    else groups.push({ x, els: [el] });
  });
  for (let i = 0; i < groups.length; i++) {
    groups[i].els.forEach(showEl);
    if (i < groups.length - 1) await wait(stagger);
  }
}

/** Cumulative length fractions [0..1] along a polyline. */
function polylineFractions(pts) {
  if (!pts.length) return [];
  const cum = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    cum.push(total);
  }
  if (total <= 0) return pts.map((_, i) => (pts.length === 1 ? 0 : i / (pts.length - 1)));
  return cum.map((d) => d / total);
}

/** CSS cubic-bezier(x1,y1,x2,y2) progress for linear time t ∈ [0,1]. */
function cubicBezierEase(t, x1, y1, x2, y2) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let s = t;
  for (let i = 0; i < 8; i++) {
    const u = 1 - s;
    const x = 3 * u * u * s * x1 + 3 * u * s * s * x2 + s * s * s;
    const dx = 3 * u * u * x1 + 6 * u * s * (x2 - x1) + 3 * s * s * (1 - x2);
    if (Math.abs(dx) < 1e-6) break;
    s = Math.max(0, Math.min(1, s - (x - t) / dx));
  }
  const u = 1 - s;
  return 3 * u * u * s * y1 + 3 * u * s * s * y2 + s * s * s;
}

/** Draw line (pathLength=1) while revealing dots as the stroke reaches each point. */
async function drawLineWithDots(line, dotItems, duration = 1500, { onShow } = {}) {
  const items = [...(dotItems || [])].sort((a, b) => a.fraction - b.fraction);
  if (!ANIM_ON) {
    line?.classList.add("is-drawn");
    items.forEach((item) => {
      showEl(item.el);
      onShow?.(item);
    });
    return;
  }
  if (!line) {
    items.forEach((item) => {
      showEl(item.el);
      onShow?.(item);
    });
    return;
  }

  line.style.transition = "none";
  line.style.strokeDashoffset = "1";
  void line.getBoundingClientRect();

  let idx = 0;
  // Subtle ease-in / ease-out (near-linear)
  const ease = (t) => cubicBezierEase(t, 0.4, 0.05, 0.6, 0.95);
  const t0 = performance.now();

  await new Promise((resolve) => {
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const p = ease(t);
      line.style.strokeDashoffset = String(1 - p);
      while (idx < items.length && items[idx].fraction <= p + 1e-4) {
        const item = items[idx];
        showEl(item.el);
        onShow?.(item);
        idx += 1;
      }
      if (t < 1) {
        requestAnimationFrame(tick);
        return;
      }
      line.classList.add("is-drawn");
      line.style.removeProperty("transition");
      line.style.removeProperty("stroke-dashoffset");
      while (idx < items.length) {
        const item = items[idx];
        showEl(item.el);
        onShow?.(item);
        idx += 1;
      }
      resolve();
    };
    requestAnimationFrame(tick);
  });
}

async function playChartSequence({
  wrap,
  titleEl,
  subEl,
  sourceEl,
  chrome,
  lines = [],
  dots = [],
  /** Optional: per-line [{ el, fraction }, ...] — dots appear as the stroke reaches them */
  lineDots = null,
  ann = [],
  extraFinal = [],
  lineGap = 900,
  lineDuration = 1500,
  dotStagger = 28,
  onLineDotShow = null,
}) {
  const allLineDots = lineDots ? lineDots.flat() : [];
  const finish = () => {
    wrap?.classList.add("is-anim-done");
    chrome?.forEach(showEl);
    lines.forEach((line) => line.classList.add("is-drawn"));
    dots.forEach(showEl);
    allLineDots.forEach(({ el }) => showEl(el));
    ann.forEach(showEl);
    extraFinal.forEach(showEl);
    if (sourceEl) {
      sourceEl.classList.add("anim-fade", "is-shown");
    }
  };

  if (!ANIM_ON) {
    finish();
    return;
  }

  const runLine = (i) => {
    if (!lines[i]) return Promise.resolve();
    if (lineDots?.[i]) {
      return drawLineWithDots(lines[i], lineDots[i], lineDuration, {
        onShow: (item) => onLineDotShow?.(item, i),
      });
    }
    lines[i].classList.add("is-drawn");
    return wait(lineDuration);
  };

  // Cascade starts: title 0 → sub 300 → grid/line1 600 → source 900; line2 = line1 + lineGap
  const textTask = Promise.all([
    playRiseText(titleEl, { stagger: 42 }),
    subEl ? playRiseLines(subEl, { stagger: 140, startDelay: 300 }) : Promise.resolve(),
  ]);
  await wait(600);

  // Grid + line 1 together; source at +300ms after grid (= 900 absolute)
  chrome?.forEach(showEl);
  if (sourceEl) {
    sourceEl.classList.add("anim-fade");
    wait(300).then(() => showEl(sourceEl));
  }

  // Lines: start→start gap (line 2 still +lineGap after line 1)
  const linesTask = (async () => {
    const draws = lines.map((_, i) => wait(i * lineGap).then(() => runLine(i)));
    await Promise.all(draws);
    const isHotspot = (el) => el.classList?.contains("ann-hotspot");
    const synced = new Set(allLineDots.map(({ el }) => el));
    const pointEls = [...dots, ...ann].filter((el) => !isHotspot(el) && !synced.has(el));
    if (pointEls.length) await showStaggerLTR(pointEls, dotStagger);
    ann.filter(isHotspot).forEach(showEl);
    extraFinal.forEach(showEl);
    await wait(200);
  })();

  // Pulse (callers) stays tied to lines; wait text too so is-anim-done doesn't cut title short
  await Promise.all([linesTask, textTask]);
  wrap?.classList.add("is-anim-done");
}

function animateOnView(node) {
  whenInView(node, () => node.classList.add("is-in"));
}

/** Hover on mouse; tap to open, tap outside to close (Chrome touch emulation + devices). */
function bindHoverOrTap(targets, { show, hide }) {
  const list = [...targets];
  let open = false;
  let sticky = false;

  const isTarget = (node) =>
    list.some((el) => el === node || (typeof el.contains === "function" && el.contains(node)));

  list.forEach((el) => {
    el.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "touch" || sticky) return;
      show(el);
      open = true;
    });
    el.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "touch" || sticky) return;
      hide();
      open = false;
    });
    el.addEventListener(
      "pointerup",
      (e) => {
        if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
        e.preventDefault();
        e.stopPropagation();
        sticky = true;
        show(el);
        open = true;
      },
      { passive: false }
    );
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      sticky = true;
      show(el);
      open = true;
    });
  });

  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!open) return;
      if (isTarget(e.target)) return;
      sticky = false;
      hide();
      open = false;
    },
    true
  );
}

function scaleY(value, min, max, top, bottom) {
  return top + ((max - value) / (max - min)) * (bottom - top);
}

function drawChart1(root) {
  const wrap = setupChartAnim(root);
  const isMobile = window.matchMedia("(max-width: 860px)").matches;
  const isTablet = window.matchMedia("(min-width: 500px) and (max-width: 860px)").matches;
  const w = isMobile ? Math.max(320, Math.round(root.clientWidth || 390)) : 944;
  const h = isMobile ? 460 : 400;
  const svg = svgEl("svg", { viewBox: `0 0 ${w} ${h}`, role: "img" });
  svg.setAttribute("aria-label", "New credit card originations during COVID-19");

  // Tablet: grid = content column; Y labels sit in the left overhang only
  const yPad = isTablet ? 28 : isMobile ? 20 : 0;
  const plotL = yPad;
  const plotR = isMobile ? (isTablet ? w : w - 20) : 933;
  const plotT = isMobile ? 62 : 76;
  const plotB = isMobile ? h - 52 : 359;
  const fs = isMobile ? 8 : 15;
  const fsX = isMobile ? 11 : 15;
  const fsSm = isMobile ? 11 : 12;
  const fsLg = isMobile ? 24 : 30;
  const fsLegend = isMobile ? 12 : 15;
  const titleDy = isMobile ? 12 : 18;
  const lineW = isMobile ? 3 : 2.5;
  const dotR = isMobile ? 3.5 : 3;
  const yMin = -100;
  const yMax = 20;
  const ticks = [20, 0, -20, -40, -60, -80, -100];
  const yAt = (v) => plotT + ((yMax - v) / (yMax - yMin)) * (plotB - plotT);

  const frameB = plotB + 13;
  const defs = svgEl("defs");
  const shadow = svgEl("filter", {
    id: "dot-shadow",
    x: "-80%",
    y: "-80%",
    width: "260%",
    height: "260%",
  });
  shadow.appendChild(
    svgEl("feDropShadow", {
      dx: "0",
      dy: "1",
      stdDeviation: "1.5",
      "flood-color": "#000",
      "flood-opacity": "0.22",
    })
  );
  defs.appendChild(shadow);
  svg.appendChild(defs);
  svg.appendChild(
    svgEl("line", {
      x1: plotL,
      x2: plotL,
      y1: plotT,
      y2: frameB,
      stroke: BLUE,
      "stroke-width": 2,
    })
  );
  svg.appendChild(
    svgEl("line", {
      x1: plotL,
      x2: plotR,
      y1: frameB,
      y2: frameB,
      stroke: BLUE,
      "stroke-width": 2,
    })
  );

  ticks.forEach((t) => {
    const y = yAt(t);
    const gridLine = {
      x1: plotL,
      x2: plotR,
      y1: y,
      y2: y,
      stroke: GRID,
      "stroke-width": 1,
    };
    if (t === 0) gridLine["stroke-dasharray"] = "2 3";
    svg.appendChild(svgEl("line", gridLine));
    const label = svgEl("text", {
      x: plotL - (isMobile ? 4 : 8),
      y: y + 3,
      fill: BLUE,
      "font-size": fs,
      "font-weight": "600",
      "text-anchor": "end",
      "font-family": "Inter, sans-serif",
    });
    label.textContent = String(t);
    svg.appendChild(label);
  });

  const axisTitle = svgEl("text", {
    x: plotL,
    y: isMobile ? 12 : 30,
    fill: BLUE,
    "font-size": isMobile ? fsX : fs,
    "font-family": "Inter, sans-serif",
  });
  axisTitle.innerHTML = "";
  const t1 = svgEl("tspan", { x: plotL, dy: 0, "font-weight": "700" });
  t1.textContent = isMobile ? "Change in cards" : "Change in number of cards";
  const t2 = svgEl("tspan", { x: plotL, dy: titleDy });
  t2.textContent = "(Jan 2020 = 100)";
  axisTitle.append(t1, t2);
  svg.appendChild(axisTitle);

  const m0 = isMobile ? plotL + 8 : 20.2;
  const step = isMobile ? (plotR - 8 - m0) / 6 : 147.4;
  const xAt = (m) => m0 + m * step;

  // 7 month ticks (Jan–Jul): 4 points per month segment → 19 points, equal Δx
  const xs = Array.from({ length: 19 }, (_, i) => i / 3);
  const all = [0, 0, 0, 0, -2, -2, 7, -9, -33, -49, -62, -68, -70, -62, -69, -65, -53, -64, -65];
  const fico = [0, 0, -2, 1, -5, 3, 2, -18, -54, -73, -84, -89, -86, -88, -88, -89, -85, -87, -90];

  const allPts = all.map((v, i) => [xAt(xs[i]), yAt(v)]);
  const ficoPts = fico.map((v, i) => [xAt(xs[i]), yAt(v)]);

  const annIdx = [10, 18];
  const annGuides = annIdx.map((i) => {
    const x = allPts[i][0];
    const guide = svgEl("line", {
      class: "ann-guide",
      x1: x,
      x2: x,
      y1: yAt(20),
      y2: frameB,
      stroke: NAVY,
      "stroke-width": 2,
      "stroke-linecap": "round",
      "stroke-dasharray": "0.01 7",
    });
    svg.appendChild(guide);
    return guide;
  });

  const eventX = xAt(2 + 14 / 31);
  svg.appendChild(
    svgEl("line", {
      x1: eventX,
      x2: eventX,
      y1: isMobile ? plotT : 18,
      y2: frameB,
      stroke: NAVY,
      "stroke-width": 2,
      "stroke-dasharray": "8 15",
    })
  );

  const ficoG = svgEl("g", { class: "series series--fico" });
  const allG = svgEl("g", { class: "series series--all" });

  const ficoLine = svgEl("polyline", {
    class: "line-draw",
    points: polyline(ficoPts),
    stroke: PURPLE_SOFT,
    "stroke-width": lineW,
    pathLength: "1",
  });
  const allLine = svgEl("polyline", {
    class: "line-draw",
    points: polyline(allPts),
    stroke: PURPLE,
    "stroke-width": lineW,
    pathLength: "1",
  });
  ficoG.appendChild(ficoLine);
  allG.appendChild(allLine);

  const ficoSeriesDots = [];
  ficoPts.forEach(([x, y], i) => {
    if (annIdx.includes(i)) return;
    const el = svgEl("circle", {
      class: "dot",
      cx: x,
      cy: y,
      r: dotR,
      fill: PURPLE_SOFT,
    });
    ficoG.appendChild(el);
    ficoSeriesDots.push({ i, el });
  });
  const allSeriesDots = [];
  allPts.forEach(([x, y], i) => {
    if (annIdx.includes(i)) return;
    const el = svgEl("circle", {
      class: "dot",
      cx: x,
      cy: y,
      r: dotR,
      fill: PURPLE,
    });
    allG.appendChild(el);
    allSeriesDots.push({ i, el });
  });

  svg.append(ficoG, allG);

  const seriesOn = { all: true, fico: true };
  const dots = allPts.map((p, i) => [p, ficoPts[i]]);
  const annHotspots = [];
  const annDots = [];
  const annLayer = makeAnnDotLayer(root, w, h);
  annIdx.forEach((i) => {
    const [a, f] = dots[i];
    const hotspot = svgEl("g", { class: "ann-hotspot" });
    const allDot = makeAnnDot(annLayer, w, h, a[0], a[1], PURPLE);
    const ficoDot = makeAnnDot(annLayer, w, h, f[0], f[1], PURPLE_SOFT);
    annDots.push({ all: allDot, fico: ficoDot });
    const minY = Math.min(a[1], f[1]);
    const maxY = Math.max(a[1], f[1]);
    hotspot.appendChild(
      svgEl("rect", {
        x: a[0] - 18,
        y: minY - 18,
        width: 36,
        height: maxY - minY + 36,
        fill: "transparent",
      })
    );
    svg.appendChild(hotspot);
    annHotspots.push(hotspot);
  });

  const months = [
    [0, "Jan 2020"],
    [1, "Feb"],
    [2, "Mar"],
    [3, "Apr"],
    [4, "May"],
    [5, "Jun"],
    [6, "Jul"],
  ];
  months.forEach(([i, label]) => {
    const x = xAt(i);
    svg.appendChild(
      svgEl("circle", { cx: x, cy: frameB, r: isMobile ? 3.5 : 3, fill: BLUE })
    );
    const text = svgEl("text", {
      x,
      y: frameB + (isMobile ? 18 : 20),
      fill: BLUE,
      "font-size": fsX,
      "font-weight": "600",
      "text-anchor": "middle",
      "font-family": "Inter, sans-serif",
    });
    text.textContent = isMobile && i === 0 ? "Jan" : label;
    svg.appendChild(text);
  });

  const evX = isMobile ? eventX + 10 : eventX + 8;
  const evAnchor = "start";
  const ev1 = svgEl("text", {
    x: evX,
    y: isMobile ? plotT + 10 : 30,
    fill: INK,
    "font-size": fsX,
    "font-family": "Inter, sans-serif",
    "font-weight": "700",
    "text-anchor": evAnchor,
    ...(isMobile ? { "dominant-baseline": "hanging" } : {}),
  });
  ev1.textContent = isMobile ? "15 Mar 2020" : "15 March 2020";
  svg.appendChild(ev1);
  const ev2 = svgEl("text", {
    x: evX,
    y: isMobile ? plotT + 10 + fsX + 2 : 48,
    fill: INK,
    "font-size": fsX,
    "font-family": "Inter, sans-serif",
    "text-anchor": evAnchor,
    ...(isMobile ? { "dominant-baseline": "hanging" } : {}),
  });
  ev2.textContent = isMobile ? "US emergency" : "US national emergency declared";
  svg.appendChild(ev2);

  const g = svgEl("g", { class: "callout-box callout-box--hover" });
  const panel = svgEl("g", { class: "callout-panel" });
  let calloutW = isMobile ? 250 : 310;
  const cx = isMobile ? plotL + 4 : 477;
  const cy = plotT;
  const padX = isMobile ? 16 : 22;
  const calloutRect = svgEl("rect", {
    x: cx,
    y: cy,
    width: calloutW,
    height: isMobile ? 148 : 161,
    rx: 12,
    fill: NAVY,
  });
  panel.appendChild(calloutRect);
  const add = (attrs, str) => {
    const t = svgEl("text", attrs);
    t.textContent = str;
    panel.appendChild(t);
    return t;
  };
  const monthLabel = add(
    {
      x: cx + calloutW / 2,
      y: cy + (isMobile ? 22 : 24),
      fill: "#fff",
      "font-size": isMobile ? 15 : fs + 2,
      "font-weight": 600,
      "font-family": "Inter, sans-serif",
      "text-anchor": "middle",
      style: `line-height: ${isMobile ? 15 : fs + 2}px`,
    },
    "April"
  );
  const pct60 = add(
    {
      x: cx + padX,
      y: cy + (isMobile ? 54 : 60),
      fill: PURPLE,
      "font-size": fsLg,
      "font-weight": 900,
      "font-family": '"PP Monument Extended", sans-serif',
      style: `line-height: ${fsLg}px`,
    },
    "~60%"
  );
  const rightAttrs = {
    "font-size": isMobile ? fsSm : fsSm + 2,
    "font-family": "Inter, sans-serif",
    "font-weight": 600,
    "letter-spacing": "-0.05em",
    style: `line-height: ${isMobile ? fsSm : fsSm + 2}px`,
  };
  const rightTexts = [
    add({ ...rightAttrs, x: cx + padX, y: cy + (isMobile ? 44 : 48), fill: PURPLE }, "fewer new cards"),
    add({ ...rightAttrs, x: cx + padX, y: cy + (isMobile ? 56 : 62), fill: PURPLE }, "versus Jan 2020"),
  ];
  const pct90 = add(
    {
      x: cx + padX,
      y: cy + (isMobile ? 94 : 102),
      fill: PURPLE_SOFT,
      "font-size": fsLg,
      "font-weight": 900,
      "font-family": '"PP Monument Extended", sans-serif',
      style: `line-height: ${fsLg}px`,
    },
    "~90%"
  );
  const lineBot1 = add(
    { ...rightAttrs, x: cx + padX, y: cy + (isMobile ? 84 : 90), fill: PURPLE_SOFT },
    "fewer new cards for"
  );
  const lineBot2 = add(
    { ...rightAttrs, x: cx + padX, y: cy + (isMobile ? 96 : 104), fill: PURPLE_SOFT },
    "the riskiest borrowers"
  );
  const lineBot3 = add(
    { ...rightAttrs, x: cx + padX, y: cy + (isMobile ? 134 : 147), fill: "#fff", "text-anchor": "middle" },
    "The market almost froze"
  );
  rightTexts.push(lineBot1, lineBot2, lineBot3);
  g.appendChild(panel);
  svg.appendChild(g);

  const setPopupCopy = (isJuly) => {
    const yTop1 = cy + (isMobile ? 44 : 48);
    const yTop2 = cy + (isMobile ? 56 : 62);
    // Bottom pair: same interline as top; 2nd line flush with bottom of 90%
    const yBot1 = cy + (isMobile ? 84 : 90);
    const yBot2 = cy + (isMobile ? 96 : 104);
    const yBot3 = cy + (isMobile ? 134 : 147);

    rightTexts[0].setAttribute("y", yTop1);
    rightTexts[1].setAttribute("y", yTop2);

    if (isJuly) {
      pct60.textContent = "~50%";
      pct90.textContent = "~90%";
      rightTexts[0].textContent = "fewer new cards";
      rightTexts[0].setAttribute("y", yTop1); // flush with top of 50%
      rightTexts[1].textContent = "";
      lineBot1.textContent = "lower, with no sign";
      lineBot2.textContent = "of recovery";
      lineBot3.textContent = "The gap remained stark";
      lineBot3.setAttribute("fill", "#fff");
      lineBot3.setAttribute("text-anchor", "middle");
      lineBot1.setAttribute("y", yBot1);
      lineBot2.setAttribute("y", yBot2);
      lineBot3.setAttribute("y", yBot3);
      return;
    }
    pct60.textContent = "~60%";
    pct90.textContent = "~90%";
    rightTexts[0].textContent = "fewer new cards";
    rightTexts[0].setAttribute("y", yTop1);
    rightTexts[1].textContent = "versus Jan 2020";
    lineBot1.textContent = "fewer new cards for";
    lineBot2.textContent = "the riskiest borrowers";
    lineBot3.textContent = "The market almost froze";
    lineBot3.setAttribute("fill", "#fff");
    lineBot3.setAttribute("text-anchor", "middle");
    lineBot1.setAttribute("y", yBot1);
    lineBot2.setAttribute("y", yBot2);
    lineBot3.setAttribute("y", yBot3);
  };

  const alignPopup = (name, isJuly = false) => {
    monthLabel.textContent = name;
    setPopupCopy(isJuly);
    const maxRightW = Math.max(
      0,
      ...rightTexts.filter((t) => t !== lineBot3).map((t) => t.getComputedTextLength())
    );
    const percentW = Math.max(pct60.getComputedTextLength(), pct90.getComputedTextLength());
    // 10px tighter than before (was 16 mobile / 24 desktop)
    const textGap = isMobile ? 6 : 14;
    calloutW = Math.max(
      padX * 2 + Math.max(monthLabel.getComputedTextLength(), percentW + textGap + maxRightW),
      padX * 2 + lineBot3.getComputedTextLength(),
      isMobile ? 190 : 200
    );
    calloutRect.setAttribute("width", calloutW);
    const center = cx + calloutW / 2;
    monthLabel.setAttribute("x", center);
    monthLabel.setAttribute("text-anchor", "middle");
    const textX = cx + padX + percentW + textGap;
    rightTexts.forEach((t) => {
      if (t === lineBot3) {
        t.setAttribute("x", center);
        t.setAttribute("text-anchor", "middle");
        return;
      }
      t.setAttribute("x", textX);
      t.setAttribute("text-anchor", "start");
    });
    if (isMobile) {
      const span = Math.max(0, plotR - plotL - calloutW);
      const targetLeft = plotL + (isJuly ? span : 0);
      panel.setAttribute("transform", `translate(${targetLeft - cx}, 0)`);
      return;
    }
    panel.setAttribute("transform", isJuly ? `translate(${plotR - calloutW - cx}, 0)` : "");
  };

  let activeAnn = -1;

  const pulseTour = createPulseTour({
    getSteps: () =>
      annDots
        .map((pair) => {
          const els = [];
          if (seriesOn.all) els.push(pair.all);
          if (seriesOn.fico) els.push(pair.fico);
          return els;
        })
        .filter((els) => els.length),
  });

  const pulseSelectedOrTour = () => {
    if (activeAnn >= 0) {
      const pair = annDots[activeAnn];
      if (!pair) {
        pulseTour.startTour();
        return;
      }
      const els = [];
      if (seriesOn.all) els.push(pair.all);
      if (seriesOn.fico) els.push(pair.fico);
      pulseTour.lock(els);
      return;
    }
    pulseTour.startTour();
  };

  const showAnn = (i) => {
    if (!seriesOn.all && !seriesOn.fico) return;
    activeAnn = i;
    annGuides.forEach((guide) => guide.classList.remove("is-visible"));
    alignPopup(i === 0 ? "April" : "July", i === 1);
    g.classList.add("is-visible");
    annGuides[i].classList.add("is-visible");
    pulseSelectedOrTour();
  };

  const hideAnn = () => {
    activeAnn = -1;
    g.classList.remove("is-visible");
    annGuides.forEach((guide) => guide.classList.remove("is-visible"));
    pulseTour.startTour();
  };

  bindHoverOrTap(annHotspots, {
    show: (el) => showAnn(annHotspots.indexOf(el)),
    hide: hideAnn,
  });

  const legendRight = plotR;
  const legendAll = svgEl("g", {
    class: "chart-legend chart-legend--all",
    role: "button",
    tabindex: "0",
    "aria-pressed": "true",
    "aria-label": "All borrowers",
  });
  const legendFico = svgEl("g", {
    class: "chart-legend chart-legend--fico",
    role: "button",
    tabindex: "0",
    "aria-pressed": "true",
    "aria-label": "Highest-risk borrowers",
  });
  const legendRow1Y = isMobile ? 14 : 26;
  const legendRow2Y = isMobile ? 34 : 46;
  const legendDotGap = 15;
  const l1 = svgEl("text", {
    x: legendRight,
    y: legendRow1Y,
    fill: PURPLE,
    "font-size": fsLegend,
    "font-family": "Inter, sans-serif",
    "font-weight": "700",
    "dominant-baseline": "central",
    "text-anchor": "end",
  });
  l1.textContent = "All borrowers";
  legendAll.appendChild(l1);
  const l2 = svgEl("text", {
    x: legendRight,
    y: legendRow2Y,
    fill: PURPLE_SOFT,
    "font-size": fsLegend,
    "font-family": "Inter, sans-serif",
    "font-weight": "700",
    "dominant-baseline": "central",
    "text-anchor": "end",
  });
  l2.textContent = "Highest-risk borrowers";
  legendFico.appendChild(l2);
  svg.append(legendAll, legendFico);
  root.appendChild(svg);
  root.appendChild(annLayer);
  alignPopup("April");
  if (document.fonts?.ready) {
    document.fonts.ready.then(() =>
      alignPopup(monthLabel.textContent || "April", monthLabel.textContent === "July")
    );
  }

  const allHit = svgEl("rect", {
    y: legendRow1Y - 12,
    height: 24,
    fill: "transparent",
  });
  const ficoHit = svgEl("rect", {
    y: legendRow2Y - 12,
    height: 24,
    fill: "transparent",
  });
  const allDotOuter = svgEl("circle", {
    cy: legendRow1Y,
    r: 8,
    fill: "#fff",
    filter: "url(#dot-shadow)",
  });
  const allDotCore = svgEl("circle", {
    class: "chart-legend__core",
    cy: legendRow1Y,
    r: 6,
    fill: PURPLE,
  });
  const ficoDotOuter = svgEl("circle", {
    cy: legendRow2Y,
    r: 8,
    fill: "#fff",
    filter: "url(#dot-shadow)",
  });
  const ficoDotCore = svgEl("circle", {
    class: "chart-legend__core",
    cy: legendRow2Y,
    r: 6,
    fill: PURPLE_SOFT,
  });
  legendAll.insertBefore(allDotOuter, l1);
  legendAll.insertBefore(allDotCore, l1);
  legendAll.appendChild(allHit);
  legendFico.insertBefore(ficoDotOuter, l2);
  legendFico.insertBefore(ficoDotCore, l2);
  legendFico.appendChild(ficoHit);

  const layoutLegend = () => {
    const maxW = Math.max(l1.getComputedTextLength(), l2.getComputedTextLength());
    const legendX = legendRight - maxW - legendDotGap;
    // Left-align labels in a column; block flush to plot right edge
    l1.setAttribute("text-anchor", "start");
    l2.setAttribute("text-anchor", "start");
    l1.setAttribute("x", legendRight - maxW);
    l2.setAttribute("x", legendRight - maxW);
    allDotOuter.setAttribute("cx", legendX);
    allDotCore.setAttribute("cx", legendX);
    ficoDotOuter.setAttribute("cx", legendX);
    ficoDotCore.setAttribute("cx", legendX);
    allHit.setAttribute("x", legendX - 10);
    allHit.setAttribute("width", legendRight - legendX + 10);
    ficoHit.setAttribute("x", legendX - 10);
    ficoHit.setAttribute("width", legendRight - legendX + 10);
  };
  layoutLegend();
  if (document.fonts?.ready) document.fonts.ready.then(layoutLegend);

  const setSeriesVisible = (key, on) => {
    seriesOn[key] = on;
    const layer = key === "all" ? allG : ficoG;
    const legend = key === "all" ? legendAll : legendFico;
    layer.classList.toggle("is-off", !on);
    legend.classList.toggle("is-off", !on);
    legend.setAttribute("aria-pressed", on ? "true" : "false");
    annDots.forEach((pair) => {
      pair[key].classList.toggle("is-off", !on);
    });
    if (!on) {
      g.classList.remove("is-visible");
      annGuides.forEach((guide) => guide.classList.remove("is-visible"));
      activeAnn = -1;
    }
    pulseSelectedOrTour();
  };
  const toggleSeries = (key) => setSeriesVisible(key, !seriesOn[key]);
  const bindLegend = (el, key) => {
    el.addEventListener("mousedown", (e) => e.preventDefault());
    el.addEventListener("click", () => toggleSeries(key));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleSeries(key);
      }
    });
  };
  bindLegend(legendAll, "all");
  bindLegend(legendFico, "fico");

  const skipChrome = new Set([defs, ficoG, allG, g, ...annHotspots, ...annGuides]);
  [...svg.children].forEach((child) => {
    if (skipChrome.has(child)) return;
    child.classList.add("anim-chrome");
  });
  allG.querySelectorAll(".dot").forEach((d) => d.classList.add("anim-dot"));
  ficoG.querySelectorAll(".dot").forEach((d) => d.classList.add("anim-dot"));
  annDots.forEach((pair) => {
    pair.all.classList.add("anim-ann");
    pair.fico.classList.add("anim-ann");
  });
  annHotspots.forEach((h) => h.classList.add("anim-ann"));

  const titleEl = wrap.querySelector("figcaption h3");
  const subEl = wrap.querySelector("figcaption p");
  const sourceEl = wrap.querySelector(".source");

  whenInView(wrap, async () => {
    const fracsAll = polylineFractions(allPts);
    const fracsFico = polylineFractions(ficoPts);
    const lineDotsAll = [
      ...allSeriesDots.map(({ i, el }) => ({ el, fraction: fracsAll[i] })),
      ...annDots.map((pair, j) => ({ el: pair.all, fraction: fracsAll[annIdx[j]] })),
    ];
    const lineDotsFico = [
      ...ficoSeriesDots.map(({ i, el }) => ({ el, fraction: fracsFico[i] })),
      ...annDots.map((pair, j) => ({ el: pair.fico, fraction: fracsFico[annIdx[j]] })),
    ];
    let pulseStarted = false;
    const activeAnnEls = new Set(annDots.flatMap((pair) => [pair.all, pair.fico]));
    await playChartSequence({
      wrap,
      titleEl,
      subEl,
      sourceEl,
      chrome: [...svg.querySelectorAll(".anim-chrome")],
      lines: [allLine, ficoLine],
      lineDots: [lineDotsAll, lineDotsFico],
      dots: [],
      ann: [...svg.querySelectorAll(".anim-ann")],
      lineGap: 1000,
      onLineDotShow: ({ el }) => {
        if (pulseStarted || !activeAnnEls.has(el)) return;
        pulseStarted = true;
        pulseTour.startTour();
      },
    });
    if (!pulseStarted) pulseTour.startTour();
  }, 0.5);
}

function drawChart2(root) {
  const wrap = setupChartAnim(root);
  const isMobile = window.matchMedia("(max-width: 860px)").matches;
  const isTablet = window.matchMedia("(min-width: 500px) and (max-width: 860px)").matches;
  const w = isMobile ? Math.max(320, Math.round(root.clientWidth || 390)) : 944;
  const h = isMobile ? 460 : 420;
  const pad = isTablet
    ? { l: 28, r: 28, t: 72, b: 56 }
    : isMobile
      ? { l: 20, r: 20, t: 72, b: 56 }
      : { l: 0, r: 12, t: 56, b: 56 };
  const fs = isMobile ? 8 : 15;
  const fsSm = isMobile ? 11 : 12;
  const fsPct = isMobile ? 10 : 20;
  const fsLegend = isMobile ? 12 : 13;
  const lineW = isMobile ? 3 : 2.5;
  const dotR = isMobile ? 3.5 : 3;
  const svg = svgEl("svg", { viewBox: `0 0 ${w} ${h}`, role: "img" });
  svg.setAttribute("aria-label", "European credit acceptance and application rates");

  const defs = svgEl("defs");
  const shadow = svgEl("filter", {
    id: "dot-shadow-2",
    x: "-80%",
    y: "-80%",
    width: "260%",
    height: "260%",
  });
  shadow.appendChild(
    svgEl("feDropShadow", {
      dx: "0",
      dy: "1",
      stdDeviation: "1.5",
      "flood-color": "#000",
      "flood-opacity": "0.22",
    })
  );
  defs.appendChild(shadow);
  svg.appendChild(defs);

  const plotL = pad.l;
  const plotR = w - pad.r;
  const plotT = pad.t;
  const plotB = h - pad.b;
  const innerPad = isMobile ? 0 : 20;
  const innerL = plotL + innerPad;
  const innerR = plotR - innerPad;
  const n = 12;
  const groupW = (innerR - innerL) / n;
  const cxAt = (i) => innerL + (i + 0.5) * groupW;
  const yL = (v) => scaleY(v, 0, 100, plotT, plotB);
  const yR = (v) => scaleY(v, 0, 25, plotT, plotB);

  const bandFills = [
    "rgba(129,56,255,0.10)", // Q1 2020
    "rgba(129,56,255,0.10)", // Q2 2020
    "rgba(255,115,255,0.10)", // Q3 2020
    "rgba(255,115,255,0.10)", // Q4 2020
    "rgba(255,115,255,0.10)", // Q1 2021
    "transparent", // Q2 2021
    "rgba(255,115,255,0.10)", // Q3 2021
    "rgba(255,115,255,0.10)", // Q4 2021
    "transparent", // Q1 2022
    "rgba(129,56,255,0.10)", // Q2 2022
    "rgba(129,56,255,0.10)", // Q3 2022
    "transparent", // Q4 2022
  ];
  for (let i = 0; i < n; i++) {
    const cx = cxAt(i);
    svg.appendChild(
      svgEl("rect", {
        x: cx - groupW / 2,
        y: plotT,
        width: groupW,
        height: plotB - plotT,
        fill: bandFills[i],
      })
    );
  }

  const leftAxisG = svgEl("g", { class: "series-axis series-axis--accept" });
  const rightAxisG = svgEl("g", { class: "series-axis series-axis--apply" });
  [0, 20, 40, 60, 80, 100].forEach((t) => {
    const y = yL(t);
    svg.appendChild(
      svgEl("line", {
        x1: plotL,
        x2: plotR,
        y1: y,
        y2: y,
        stroke: GRID,
        "stroke-width": 0.5,
      })
    );
    const left = svgEl("text", {
      x: plotL - (isMobile ? 4 : 8),
      y: y + 3,
      fill: PURPLE,
      "font-size": fs,
      "font-weight": "500",
      "text-anchor": "end",
      "font-family": "Inter, sans-serif",
      style: `line-height: ${fs}px`,
    });
    left.textContent = String(t);
    leftAxisG.appendChild(left);
  });
  [0, 5, 10, 15, 20, 25].forEach((t) => {
    const y = yR(t);
    const right = svgEl("text", {
      x: plotR + (isMobile ? 4 : 10),
      y: y + 3,
      fill: PINK,
      "font-size": fs,
      "font-weight": "500",
      "text-anchor": "start",
      "font-family": "Inter, sans-serif",
      style: `line-height: ${fs}px`,
    });
    right.textContent = String(t);
    rightAxisG.appendChild(right);
  });
  svg.append(leftAxisG, rightAxisG);

  const accept = [82.8, 76.4, 72.6, 66.4, 67.8, 66.2, 64.8, 62.4, 61.2, 62.1, 64.0, 68.5];
  const apply = [8.9, 9.2, 16.3, 11.9, 9.7, 8.5, 11.1, 9.8, 8.9, 12.2, 10.5, 13.4];

  const acceptPts = accept.map((v, i) => [cxAt(i), yL(v)]);
  const applyPts = apply.map((v, i) => [cxAt(i), yR(v)]);

  const labeledA = { 0: "82.8%", 2: "72.6%", 3: "66.4%", 9: "62.1%", 11: "68.5%" };
  const labeledB = { 0: "8.9%", 2: "16.3%", 3: "11.9%", 9: "12.2%", 11: "13.4%" };
  const activeIdx = [...new Set([...Object.keys(labeledA), ...Object.keys(labeledB)].map(Number))].sort(
    (a, b) => a - b
  );

  const quarterLabels = [
    ["Q1", "2020"],
    ["Q2", "2020"],
    ["Q3", "2020"],
    ["Q4", "2020"],
    ["Q1", "2021"],
    ["Q2", "2021"],
    ["Q3", "2021"],
    ["Q4", "2021"],
    ["Q1", "2022"],
    ["Q2", "2022"],
    ["Q3", "2022"],
    ["Q4", "2022"],
  ];

  const axisX = "#414d97";

  // Guides under series (scrubber line sits here, under dots)
  const guidesLayer = svgEl("g", { class: "chart-guides-layer" });
  svg.appendChild(guidesLayer);

  // Entrance scrubber on March 2020 (index 0); handle circles added later, above series
  const scrubIdx = 0;
  const scrubX = cxAt(scrubIdx);
  const scrubber = svgEl("g", {
    class: "anim-ann chart-scrubber",
    "data-anim-x": scrubX,
    transform: `translate(${scrubX}, 0)`,
  });
  scrubber.appendChild(
    svgEl("line", {
      x1: 0,
      x2: 0,
      y1: plotT,
      y2: plotB,
      stroke: NAVY,
      "stroke-width": 2,
      "stroke-linecap": "round",
      "stroke-dasharray": "0.01 7",
    })
  );
  guidesLayer.appendChild(scrubber);

  const acceptG = svgEl("g", { class: "series series--accept" });
  const applyG = svgEl("g", { class: "series series--apply" });

  const applyLine = svgEl("polyline", {
    class: "line-draw",
    points: polyline(applyPts),
    stroke: PINK,
    "stroke-width": lineW,
    pathLength: "1",
  });
  const acceptLine = svgEl("polyline", {
    class: "line-draw",
    points: polyline(acceptPts),
    stroke: PURPLE,
    "stroke-width": lineW,
    pathLength: "1",
  });
  applyG.appendChild(applyLine);
  acceptG.appendChild(acceptLine);

  const applySeriesDots = [];
  applyPts.forEach(([x, y], i) => {
    if (labeledB[i]) return;
    const el = svgEl("circle", { class: "dot", cx: x, cy: y, r: dotR, fill: PINK });
    applyG.appendChild(el);
    applySeriesDots.push({ i, el });
  });
  const acceptSeriesDots = [];
  acceptPts.forEach(([x, y], i) => {
    if (labeledA[i]) return;
    const el = svgEl("circle", { class: "dot", cx: x, cy: y, r: dotR, fill: PURPLE });
    acceptG.appendChild(el);
    acceptSeriesDots.push({ i, el });
  });

  svg.append(applyG, acceptG);

  // Scrubber handle sits above series
  const scrubHandle = svgEl("g", {
    class: "anim-ann chart-scrubber-handle",
    "data-anim-x": scrubX,
    transform: `translate(${scrubX}, 0)`,
  });
  scrubHandle.appendChild(
    svgEl("circle", {
      cx: 0,
      cy: plotT,
      r: 10,
      fill: "#fff",
      filter: "url(#dot-shadow-2)",
    })
  );
  scrubHandle.appendChild(
    svgEl("circle", {
      cx: 0,
      cy: plotT,
      r: 7,
      fill: axisX,
    })
  );
  const scrubHandleHit = svgEl("circle", {
    class: "scrub-handle-hit",
    cx: 0,
    cy: plotT,
    r: isMobile ? 22 : 18,
    fill: "transparent",
  });
  scrubHandle.appendChild(scrubHandleHit);
  // Appended above scrub rail later so hover on the top marker works

  let calloutW = isMobile ? 140 : 200;
  const calloutPy = isMobile ? 50 : 0;

  // title / blue (purple) / pink
  const calloutCopy = {
    0: {
      title: "March 2020",
      blue: "COVID-19 pandemic",
      pink: "Acceptance rates were at their highest point in the period",
    },
    2: {
      title: "Q3 2020",
      blue: "First lockdowns ease",
      pink: "Applications rebounded as economies reopened, but acceptance continued to fall",
    },
    3: {
      title: "Q4 2020",
      blue: "Second lockdowns across Europe",
      pink: "Applications fell again as restrictions returned, while acceptance continued to decline",
    },
    9: {
      title: "Feb 2022",
      blue: "Russia invades Ukraine",
      pink: "Credit demand weakened further as Europe faced a new economic shock",
    },
    11: {
      title: "Q4 2022",
      blue: "Credit begins to recover",
      pink: "Applications and acceptance improved, but remained below pre-pandemic levels",
    },
  };

  // HTML callout above ann-dot-layer (SVG sits under HTML pups)
  const calloutLayer = document.createElement("div");
  calloutLayer.className = "chart2-callout-layer";
  calloutLayer.style.aspectRatio = `${w} / ${h}`;
  const callout = document.createElement("div");
  callout.className = "chart2-callout";
  const calloutTitle = document.createElement("div");
  calloutTitle.className = "chart2-callout__title";
  const body1 = document.createElement("div");
  body1.className = "chart2-callout__body1";
  const body2 = document.createElement("div");
  body2.className = "chart2-callout__body2";
  callout.append(calloutTitle, body1, body2);
  calloutLayer.appendChild(callout);

  const fillCalloutLines = (el, text) => {
    el.textContent = "";
    String(text || "")
      .split("\n")
      .forEach((line, idx) => {
        if (idx) el.appendChild(document.createElement("br"));
        el.appendChild(document.createTextNode(line));
      });
  };

  const setCalloutContent = (i) => {
    const copy = calloutCopy[i];
    if (!copy) return;
    calloutTitle.textContent = copy.title;
    if (copy.blue) {
      fillCalloutLines(body1, copy.blue);
      body1.hidden = false;
      body2.classList.remove("is-solo");
    } else {
      body1.textContent = "";
      body1.hidden = true;
      body2.classList.add("is-solo");
    }
    fillCalloutLines(body2, copy.pink);
  };

  let scrubPosX = scrubX;
  let scrubPulse = null;

  const setScrubEase = (on) => {
    scrubber.classList.toggle("scrub-ease", on);
    scrubHandle.classList.toggle("scrub-ease", on);
    callout.classList.toggle("scrub-ease", on);
    scrubPulse?.classList.toggle("scrub-ease", on);
  };

  const moveScrubberTo = (x, { animate = false } = {}) => {
    scrubPosX = x;
    setScrubEase(animate);
    const t = `translate(${x}, 0)`;
    scrubber.setAttribute("transform", t);
    scrubHandle.setAttribute("transform", t);
    scrubber.setAttribute("data-anim-x", x);
    scrubHandle.setAttribute("data-anim-x", x);
    if (scrubPulse) scrubPulse.style.left = `${(x / w) * 100}%`;
  };

  const measureCalloutW = () => {
    const layerW = calloutLayer.clientWidth || root.clientWidth || 1;
    const cssW = callout.offsetWidth;
    if (cssW > 0) calloutW = (cssW / layerW) * w;
  };

  const calloutPxFor = (x) => {
    const gap = isMobile ? 31 : 46;
    const left = x + gap;
    const right = x - calloutW - gap;
    return left + calloutW <= plotR ? left : Math.max(plotL, right);
  };

  const placeCalloutPanel = (x) => {
    // Measure with current copy, then place (may flip left/right)
    const probeGap = isMobile ? 31 : 46;
    callout.style.left = `${((x + probeGap) / w) * 100}%`;
    callout.style.top = `${(calloutPy / h) * 100}%`;
    measureCalloutW();
    callout.style.left = `${(calloutPxFor(x) / w) * 100}%`;
  };

  let activeQuarter = -1;
  let calloutVisible = false;
  let popupHover = 0;
  let dragging = false;

  const syncPctLabels = () => {
    chart2AnnDots.forEach(({ i, pulseDots }) => {
      const active = activeQuarter === i;
      pulseDots.forEach(({ key, label }) => {
        if (!label) return;
        label.classList.toggle("is-active", !!(active && seriesOn[key]));
      });
    });
  };

  const showPopup = (i, x = cxAt(i)) => {
    if (!calloutCopy[i]) return;
    setCalloutContent(i);
    placeCalloutPanel(x);
    callout.classList.add("is-visible");
    calloutVisible = true;
  };

  const hidePopup = () => {
    callout.classList.remove("is-visible");
    calloutVisible = false;
  };

  const enterPopupHover = (i, x = cxAt(i)) => {
    popupHover += 1;
    showPopup(i, x);
  };

  const leavePopupHover = () => {
    popupHover = Math.max(0, popupHover - 1);
    if (popupHover === 0 && !dragging) hidePopup();
  };

  const seriesOn = { accept: true, apply: true };
  const chart2AnnDots = [];
  const annLayer = makeAnnDotLayer(root, w, h);

  // Pulse layer under the SVG so rings sit beneath the white handle stroke
  const scrubPulseLayer = document.createElement("div");
  scrubPulseLayer.className = "scrub-pulse-layer";
  scrubPulseLayer.style.aspectRatio = `${w} / ${h}`;
  scrubPulse = document.createElement("div");
  scrubPulse.className = "scrub-handle-pulse anim-ann";
  scrubPulse.style.left = `${(scrubX / w) * 100}%`;
  scrubPulse.style.top = `${(plotT / h) * 100}%`;
  scrubPulseLayer.appendChild(scrubPulse);

  activeIdx.forEach((i) => {
    const pulseDots = [];
    if (labeledA[i]) {
      const [x, y] = acceptPts[i];
      const t = svgEl("text", {
        class: "chart-pct-label",
        // 3rd purple label (66.4%): nudge right on mobile
        x: isMobile && i === 3 ? x + 10 : x,
        y: y - (isMobile ? 14 : 18),
        fill: PURPLE,
        "font-size": fsPct,
        "font-weight": 900,
        "font-family": '"PP Monument Extended", sans-serif',
        "text-anchor": "middle",
        style: `line-height: ${fsPct}px`,
        ...(isMobile
          ? { stroke: "#fff", "stroke-width": 1, "paint-order": "stroke fill" }
          : {}),
      });
      t.textContent = labeledA[i];
      acceptG.appendChild(t);
      pulseDots.push({
        key: "accept",
        el: makeAnnDot(annLayer, w, h, x, y, PURPLE),
        x,
        y,
        label: t,
      });
    }
    if (labeledB[i]) {
      const [x, y] = applyPts[i];
      const t = svgEl("text", {
        class: "chart-pct-label",
        x: i === 2 ? x - (isMobile ? 10 : 14) : i === 9 ? x + (isMobile ? 14 : 19) : i === 11 ? x + (isMobile ? 16 : 23) : x,
        y: i === 2 ? y + 7 : y + (isMobile ? 26 : 32),
        fill: PINK,
        "font-size": fsPct,
        "font-weight": 900,
        "font-family": '"PP Monument Extended", sans-serif',
        "text-anchor": i === 2 ? "end" : "middle",
        style: `line-height: ${fsPct}px`,
        ...(isMobile
          ? { stroke: "#fff", "stroke-width": 1, "paint-order": "stroke fill" }
          : {}),
      });
      t.textContent = labeledB[i];
      applyG.appendChild(t);
      pulseDots.push({
        key: "apply",
        el: makeAnnDot(annLayer, w, h, x, y, PINK),
        x,
        y,
        label: t,
      });
    }
    chart2AnnDots.push({ i, pulseDots });
  });

  const popupIdx = Object.keys(calloutCopy)
    .map(Number)
    .sort((a, b) => a - b);

  /** Nearest quarter of any kind (Voronoi cell by x). */
  const nearestQuarter = (x) => {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(cxAt(i) - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  };

  /** Nearest quarter that has a callout (for snap-on-release). */
  const snapQuarter = (x) => {
    let best = popupIdx[0] ?? 0;
    let bestDist = Infinity;
    for (const i of popupIdx) {
      const d = Math.abs(cxAt(i) - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  };

  const clientToSvgX = (clientX) => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return cxAt(scrubIdx);
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = 0;
    return pt.matrixTransform(ctm.inverse()).x;
  };

  let currentScrub = scrubIdx;
  let committedScrub = scrubIdx;

  const clampScrubX = (x) => Math.min(cxAt(n - 1), Math.max(cxAt(0), x));

  const quarterHasActive = (i) =>
    (seriesOn.accept && labeledA[i]) || (seriesOn.apply && labeledB[i]);

  const applyScrubberAt = (i, { animate = false, popup = false } = {}) => {
    committedScrub = i;
    currentScrub = i;
    activeQuarter = i;
    const x = cxAt(i);
    setScrubEase(animate);
    moveScrubberTo(x, { animate });
    if (popup && quarterHasActive(i) && calloutCopy[i]) showPopup(i, x);
    else if (!popup && popupHover === 0) hidePopup();
    syncPctLabels();
  };

  const scrubDragTo = (x) => {
    const clamped = clampScrubX(x);
    moveScrubberTo(clamped, { animate: false });
    const i = nearestQuarter(clamped);
    // Values while inside an active quarter; popup only while dragging / hover
    if (calloutCopy[i] && quarterHasActive(i)) {
      activeQuarter = i;
      currentScrub = i;
      if (dragging) showPopup(i, clamped);
      syncPctLabels();
    } else {
      activeQuarter = -1;
      hidePopup();
      syncPctLabels();
    }
  };

  // Fixed hit rail (doesn't move with scrubber) — reliable touch target on mobile
  const scrubRail = svgEl("rect", {
    class: "scrub-rail",
    x: innerL - 8,
    y: plotT - (isMobile ? 36 : 28),
    width: innerR - innerL + 16,
    height: isMobile ? 72 : 56,
    fill: "transparent",
  });

  let activePointerId = null;

  const jumpToQuarter = (i) => {
    applyScrubberAt(i, { animate: false, popup: true });
    scrubRail.setAttribute("aria-valuenow", String(i));
  };

  const stopWindowDrag = () => {
    window.removeEventListener("pointermove", onWindowPointerMove);
    window.removeEventListener("pointerup", onWindowPointerUp);
    window.removeEventListener("pointercancel", onWindowPointerUp);
    document.documentElement.classList.remove("is-chart-scrubbing");
    root.classList.remove("is-scrubbing");
  };

  const onWindowPointerMove = (e) => {
    if (!dragging || e.pointerId !== activePointerId) return;
    e.preventDefault();
    scrubDragTo(clientToSvgX(e.clientX));
  };

  const onWindowPointerUp = (e) => {
    if (!dragging || e.pointerId !== activePointerId) return;
    dragging = false;
    activePointerId = null;
    scrubHandle.classList.remove("is-dragging");
    scrubber.classList.remove("is-dragging");
    scrubRail.classList.remove("is-dragging");
    stopWindowDrag();
    const i = snapQuarter(clientToSvgX(e.clientX));
    setScrubEase(false);
    requestAnimationFrame(() => {
      // Mobile: scrub release (tap or drag) keeps popup; desktop: hover only
      const keepPopup = isMobile
        ? !!(calloutCopy[i] && quarterHasActive(i))
        : popupHover > 0;
      applyScrubberAt(i, { animate: true, popup: keepPopup });
      scrubRail.setAttribute("aria-valuenow", String(i));
    });
  };

  const startScrubDrag = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    activePointerId = e.pointerId;
    setScrubEase(false);
    scrubHandle.classList.add("is-dragging");
    scrubber.classList.add("is-dragging");
    scrubRail.classList.add("is-dragging");
    document.documentElement.classList.add("is-chart-scrubbing");
    root.classList.add("is-scrubbing");
    window.addEventListener("pointermove", onWindowPointerMove, { passive: false });
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerUp);
    scrubDragTo(clientToSvgX(e.clientX));
  };

  scrubRail.addEventListener("pointerdown", startScrubDrag);
  // Block browser scroll/gesture takeover on the rail (iOS/Android)
  scrubRail.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
  scrubRail.setAttribute("role", "slider");
  scrubRail.setAttribute("aria-label", "Drag to explore quarters");
  scrubRail.setAttribute("aria-valuemin", "0");
  scrubRail.setAttribute("aria-valuemax", String(n - 1));
  scrubRail.setAttribute("aria-valuenow", String(scrubIdx));

  scrubHandleHit.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "touch" || dragging) return;
    const q = activeQuarter >= 0 ? activeQuarter : committedScrub;
    if (q < 0 || !calloutCopy[q]) return;
    enterPopupHover(q, cxAt(q));
  });
  scrubHandleHit.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "touch" || dragging) return;
    leavePopupHover();
  });
  scrubHandleHit.addEventListener("pointerdown", startScrubDrag);
  scrubHandleHit.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });

  svg.appendChild(
    svgEl("line", {
      x1: plotL,
      x2: plotR,
      y1: plotB,
      y2: plotB,
      stroke: axisX,
      "stroke-width": 2,
    })
  );

  const labels = quarterLabels;
  const qFs = isMobile ? 11 : 15;
  labels.forEach(([q, y], i) => {
    const x = cxAt(i);
    svg.appendChild(svgEl("circle", { cx: x, cy: plotB, r: isMobile ? 3.5 : 3, fill: axisX }));
    const a = svgEl("text", {
      x,
      y: plotB + (isMobile ? 18 : 20),
      fill: axisX,
      "font-size": qFs,
      "font-weight": "500",
      "text-anchor": "middle",
      "font-family": "Inter, sans-serif",
      style: `line-height: ${qFs}px`,
    });
    a.textContent = q;
    svg.appendChild(a);
    if (!isMobile || i % 4 === 0) {
      const b = svgEl("text", {
        x,
        y: plotB + (isMobile ? 30 : 34),
        fill: axisX,
        "font-size": qFs,
        "font-weight": "500",
        "text-anchor": "middle",
        "font-family": "Inter, sans-serif",
        style: `line-height: ${qFs}px`,
      });
      b.textContent = y;
      svg.appendChild(b);
    }
  });

  const legendDotR = 8;
  let legendAccept;
  let legendApply;

  if (isMobile) {
    const legendLCx = plotL + legendDotR;
    const legendTextX = legendLCx + legendDotR + 8;
    const row1Y = 14;
    const row2Y = 34;
    const hitW = 180;

    legendAccept = svgEl("g", {
      class: "chart-legend chart-legend--accept",
      role: "button",
      tabindex: "0",
      "aria-pressed": "true",
    });
    legendAccept.appendChild(
      svgEl("circle", { cx: legendLCx, cy: row1Y, r: 8, fill: "#fff", filter: "url(#dot-shadow-2)" })
    );
    legendAccept.appendChild(
      svgEl("circle", {
        class: "chart-legend__core",
        cx: legendLCx,
        cy: row1Y,
        r: 6,
        fill: PURPLE,
      })
    );
    const la = svgEl("text", {
      x: legendTextX,
      y: row1Y,
      fill: PURPLE,
      "font-size": fsLegend,
      "font-weight": "700",
      "font-family": "Inter, sans-serif",
      "dominant-baseline": "central",
    });
    la.textContent = "Acceptance rate (%)";
    legendAccept.appendChild(la);
    legendAccept.appendChild(
      svgEl("rect", {
        x: legendLCx - 10,
        y: row1Y - 12,
        width: hitW,
        height: 24,
        fill: "transparent",
      })
    );

    legendApply = svgEl("g", {
      class: "chart-legend chart-legend--apply",
      role: "button",
      tabindex: "0",
      "aria-pressed": "true",
    });
    legendApply.appendChild(
      svgEl("circle", { cx: legendLCx, cy: row2Y, r: 8, fill: "#fff", filter: "url(#dot-shadow-2)" })
    );
    legendApply.appendChild(
      svgEl("circle", {
        class: "chart-legend__core",
        cx: legendLCx,
        cy: row2Y,
        r: 6,
        fill: PINK,
      })
    );
    const lb = svgEl("text", {
      x: legendTextX,
      y: row2Y,
      fill: PINK,
      "font-size": fsLegend,
      "font-weight": "700",
      "font-family": "Inter, sans-serif",
      "dominant-baseline": "central",
    });
    lb.textContent = "Application rate (%)";
    legendApply.appendChild(lb);
    legendApply.appendChild(
      svgEl("rect", {
        x: legendLCx - 10,
        y: row2Y - 12,
        width: hitW,
        height: 24,
        fill: "transparent",
      })
    );
  } else {
    const legendCy = 18;
    const legendLCx = plotL - 8 - legendDotR;
    const legendRCx = plotR + 8 + legendDotR;

    legendAccept = svgEl("g", {
      class: "chart-legend chart-legend--accept",
      role: "button",
      tabindex: "0",
      "aria-pressed": "true",
    });
    legendAccept.appendChild(
      svgEl("circle", { cx: legendLCx, cy: legendCy, r: 8, fill: "#fff", filter: "url(#dot-shadow-2)" })
    );
    legendAccept.appendChild(
      svgEl("circle", {
        class: "chart-legend__core",
        cx: legendLCx,
        cy: legendCy,
        r: 6,
        fill: PURPLE,
      })
    );
    const la = svgEl("text", {
      x: plotL,
      y: 22,
      fill: PURPLE,
      "font-size": fsLegend,
      "font-weight": "700",
      "font-family": "Inter, sans-serif",
    });
    la.textContent = "Credit acceptance rate (%)";
    legendAccept.appendChild(la);
    legendAccept.appendChild(
      svgEl("rect", {
        x: legendLCx - 10,
        y: 4,
        width: 210,
        height: 28,
        fill: "transparent",
      })
    );

    legendApply = svgEl("g", {
      class: "chart-legend chart-legend--apply",
      role: "button",
      tabindex: "0",
      "aria-pressed": "true",
    });
    const lb = svgEl("text", {
      x: plotR,
      y: 22,
      fill: PINK,
      "font-size": fsLegend,
      "font-weight": "700",
      "text-anchor": "end",
      "font-family": "Inter, sans-serif",
    });
    lb.textContent = "Credit application rate (%)";
    legendApply.appendChild(lb);
    legendApply.appendChild(
      svgEl("circle", { cx: legendRCx, cy: legendCy, r: 8, fill: "#fff", filter: "url(#dot-shadow-2)" })
    );
    legendApply.appendChild(
      svgEl("circle", {
        class: "chart-legend__core",
        cx: legendRCx,
        cy: legendCy,
        r: 6,
        fill: PINK,
      })
    );
    legendApply.appendChild(
      svgEl("rect", {
        x: plotR - 220,
        y: 4,
        width: legendRCx - (plotR - 220) + 10,
        height: 28,
        fill: "transparent",
      })
    );
  }

  svg.appendChild(scrubRail);
  // Handle above the rail so the top pup receives hover
  svg.appendChild(scrubHandle);

  // Hit targets above scrub rail so annotated dots stay tappable
  const annScrubHits = [];
  chart2AnnDots.forEach(({ i, pulseDots }) => {
    pulseDots.forEach(({ key, el, x, y }) => {
      el.classList.add("ann-dot--scrub");
      const hit = svgEl("circle", {
        class: "ann-dot-scrub-hit",
        cx: x,
        cy: y,
        r: isMobile ? 22 : 16,
        fill: "transparent",
        "data-series": key,
      });
      hit.addEventListener("pointerdown", (e) => e.stopPropagation());
      hit.addEventListener("pointerenter", (e) => {
        if (e.pointerType === "touch" || dragging || !seriesOn[key]) return;
        if (i !== committedScrub) {
          applyScrubberAt(i, { animate: true, popup: false });
          scrubRail.setAttribute("aria-valuenow", String(i));
        }
        enterPopupHover(i, cxAt(i));
      });
      hit.addEventListener("pointerleave", (e) => {
        if (e.pointerType === "touch" || dragging) return;
        leavePopupHover();
      });
      hit.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dragging || !seriesOn[key]) return;
        jumpToQuarter(i);
      });
      svg.appendChild(hit);
      annScrubHits.push(hit);
    });
  });

  // Mobile: tap anywhere except active dots closes popup; drag-end keeps it open
  if (isMobile) {
    if (root._chart2TouchAbort) root._chart2TouchAbort.abort();
    root._chart2TouchAbort = new AbortController();
    const { signal } = root._chart2TouchAbort;

    const isActiveDotTarget = (node) => {
      const el =
        (node && typeof node.closest === "function" && node.closest(".ann-dot-scrub-hit")) ||
        (node?.classList?.contains?.("ann-dot-scrub-hit") ? node : null);
      if (!el) return false;
      const key = el.getAttribute("data-series");
      return !!(key && seriesOn[key]);
    };

    const isScrubTarget = (node) =>
      !!(
        node === scrubRail ||
        node === scrubHandleHit ||
        (node && typeof node.closest === "function" && node.closest(".scrub-rail, .scrub-handle-hit")) ||
        node?.classList?.contains?.("scrub-handle-hit") ||
        node?.classList?.contains?.("scrub-rail")
      );

    document.addEventListener(
      "pointerdown",
      (e) => {
        if (!calloutVisible || dragging) return;
        if (e.pointerType === "mouse") return;
        if (isActiveDotTarget(e.target)) return;
        // Scrub: don't close — release keeps popup (tap or drag)
        if (isScrubTarget(e.target)) return;
        hidePopup();
      },
      { capture: true, signal }
    );
  }

  svg.append(legendAccept, legendApply);
  root.appendChild(scrubPulseLayer);
  root.appendChild(svg);
  root.appendChild(annLayer);
  root.appendChild(calloutLayer);

  const setSeriesVisible = (key, on) => {
    seriesOn[key] = on;
    const layer = key === "accept" ? acceptG : applyG;
    const axis = key === "accept" ? leftAxisG : rightAxisG;
    const legend = key === "accept" ? legendAccept : legendApply;
    layer.classList.toggle("is-off", !on);
    axis.classList.toggle("is-off", !on);
    legend.classList.toggle("is-off", !on);
    legend.setAttribute("aria-pressed", on ? "true" : "false");
    chart2AnnDots.forEach(({ pulseDots }) => {
      pulseDots.forEach(({ key: k, el }) => {
        if (k === key) el.classList.toggle("is-off", !on);
      });
    });
    annScrubHits.forEach((hit) => {
      if (hit.getAttribute("data-series") === key) {
        hit.style.pointerEvents = on ? "all" : "none";
      }
    });
    if (wrap.classList.contains("is-anim-done") || !ANIM_ON) {
      applyScrubberAt(committedScrub);
    }
    syncPctLabels();
  };

  const toggleSeries = (key) => setSeriesVisible(key, !seriesOn[key]);

  const bindLegend = (el, key) => {
    el.addEventListener("mousedown", (e) => e.preventDefault());
    el.addEventListener("click", () => toggleSeries(key));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleSeries(key);
      }
    });
  };
  bindLegend(legendAccept, "accept");
  bindLegend(legendApply, "apply");

  const skipChrome = new Set([
    defs,
    acceptG,
    applyG,
    guidesLayer,
    scrubber,
    scrubHandle,
    scrubRail,
    ...annScrubHits,
  ]);
  [...svg.children].forEach((child) => {
    if (skipChrome.has(child)) return;
    child.classList.add("anim-chrome");
  });
  leftAxisG.classList.add("anim-chrome");
  rightAxisG.classList.add("anim-chrome");
  acceptG.querySelectorAll(".dot").forEach((d) => d.classList.add("anim-dot"));
  applyG.querySelectorAll(".dot").forEach((d) => d.classList.add("anim-dot"));
  chart2AnnDots.forEach(({ pulseDots }) => {
    pulseDots.forEach(({ el: dot }) => dot.classList.add("anim-ann"));
  });

  const titleEl = wrap.querySelector("figcaption h3");
  const subEl = wrap.querySelector("figcaption p");
  const sourceEl = wrap.querySelector(".source");

  whenInView(wrap, async () => {
    const fracsAccept = polylineFractions(acceptPts);
    const fracsApply = polylineFractions(applyPts);
    const lineDotsAccept = [
      ...acceptSeriesDots.map(({ i, el }) => ({ el, fraction: fracsAccept[i] })),
      ...chart2AnnDots.flatMap(({ i, pulseDots }) =>
        pulseDots
          .filter(({ key }) => key === "accept")
          .map(({ el }) => ({ el, fraction: fracsAccept[i] }))
      ),
    ];
    const lineDotsApply = [
      ...applySeriesDots.map(({ i, el }) => ({ el, fraction: fracsApply[i] })),
      ...chart2AnnDots.flatMap(({ i, pulseDots }) =>
        pulseDots
          .filter(({ key }) => key === "apply")
          .map(({ el }) => ({ el, fraction: fracsApply[i] }))
      ),
    ];
    const scrubAnn = new Set([scrubber, scrubHandle]);
    await playChartSequence({
      wrap,
      titleEl,
      subEl,
      sourceEl,
      chrome: [...svg.querySelectorAll(".anim-chrome")],
      lines: [acceptLine, applyLine],
      lineDots: [lineDotsAccept, lineDotsApply],
      dots: [],
      ann: [...svg.querySelectorAll(".anim-ann")].filter((el) => !scrubAnn.has(el)),
      lineGap: 1000,
    });
    // Scrubber line + handle after full draw; values on, popup only on hover
    showEl(scrubber);
    showEl(scrubHandle);
    showEl(scrubPulse);
    applyScrubberAt(scrubIdx, { popup: false });
  }, 0.5);
}

function mountChart(root, draw) {
  if (!root) return;
  let timer = 0;
  let lastW = 0;
  let wasMobile = null;
  let wasTablet = null;
  const mqMobile = "(max-width: 860px)";
  const mqTablet = "(min-width: 500px) and (max-width: 860px)";
  const render = () => {
    const wrap = root.closest(".graphic-chart");
    wrap?.classList.remove("is-in", "is-anim-done");
    root.innerHTML = "";
    draw(root);
    lastW = root.clientWidth;
    wasMobile = window.matchMedia(mqMobile).matches;
    wasTablet = window.matchMedia(mqTablet).matches;
  };
  render();
  window.addEventListener("resize", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const isMobile = window.matchMedia(mqMobile).matches;
      const isTablet = window.matchMedia(mqTablet).matches;
      const w = root.clientWidth;
      if (isMobile === wasMobile && isTablet === wasTablet && Math.abs(w - lastW) < 8) return;
      render();
    }, 150);
  });
}

mountChart(document.getElementById("chart-1"), drawChart1);
mountChart(document.getElementById("chart-2"), drawChart2);
initGraphic3(document.querySelector(".graphic-3"));

function initGraphic3(root) {
  if (!root) return;
  const shock = root.querySelector(".shock");
  const line = root.querySelector(".shock-line");
  const titleEl = shock.querySelector(".shock-title");
  const subtitleEl = shock.querySelector(".shock-subtitle");
  const bodyEl = shock.querySelector(".shock-body");
  const hotspots = [...root.querySelectorAll(".hotspot")];

  // Same copy for now — swap per key when real texts are ready
  const defaultCopy = {
    titleHtml: "Economic<br />shock",
    subtitle: "Freelance demand falls",
    body: "A downturn reduces her income further.",
  };
  // Left → right by hotspot x
  const popups = {
    car: {
      titleHtml: "Unexpected<br />expense",
      subtitle: "€1,000 car repair",
      body: "A one-off expense puts temporary pressure on her finances.",
    },
    pen: {
      titleHtml: "Employment",
      subtitle: "Freelance + part-time",
      body: "Moves between different forms of work.",
    },
    gauge: {
      titleHtml: "Credit<br />history",
      subtitle: "Good credit score",
      body: "Her credit history remains strong despite variable income.",
    },
    card: {
      titleHtml: "Income",
      subtitle: "€6,500 > €2,000 > €4,000",
      body: "Income changes as projects start and end.",
    },
    bar: {
      titleHtml: "Economic<br />shock",
      subtitle: "Freelance demand falls",
      body: "A downturn reduces her income further.",
    },
    case: {
      titleHtml: "Credit<br />access",
      subtitle: "Loan declined",
      body: "A conventional assessment struggles to distinguish temporary volatility from longer-term risk.",
    },
  };

  const POPUP_OFFSET_PCT = 41.17; // desktop: distance from point to popup top
  const MOBILE_LINE_GAP = 56; // px between popup bottom and pin top (footnote visible)

  let showTimer = 0;
  let hoveredHotspot = null;

  // Left → right pulse order (own pin color + tip-anchored scale)
  const pulseOrder = [...hotspots].sort(
    (a, b) => Number(a.dataset.x) - Number(b.dataset.x)
  );
  const pulseTour = createPulseTour({
    // Skip the hovered pin — tour keeps running for the rest
    getSteps: () =>
      pulseOrder.filter((h) => h !== hoveredHotspot).map((h) => [h]),
    applyPulse: (el, on) => {
      if (el === hoveredHotspot) {
        el.classList.remove("is-pulsing");
        return;
      }
      el.classList.toggle("is-pulsing", !!on);
    },
    intervalMs: 1600,
    gapMs: 700,
  });

  const placeAt = (hotspot) => {
    const scene = root.querySelector(".graphic-3-scene");
    const frame = root.querySelector(".graphic-3-media") || root;
    if (!scene) return;
    const key = hotspot.dataset.key;
    const copy = popups[key] || defaultCopy;
    titleEl.innerHTML = copy.titleHtml;
    subtitleEl.textContent = copy.subtitle;
    bodyEl.textContent = copy.body;

    const isMobile = window.matchMedia("(max-width: 860px)").matches;
    const sceneW = scene.clientWidth || 1;
    const sceneH = scene.clientHeight || 1;
    const pad =
      parseFloat(getComputedStyle(root).getPropertyValue("--g3-pad")) || 16;

    // Tip / top from rendered pin (includes CSS offsets + g3-shift)
    const sceneRect = scene.getBoundingClientRect();
    const pinRect = hotspot.getBoundingClientRect();
    const pointX = pinRect.left + pinRect.width / 2 - sceneRect.left;
    const tipY = pinRect.top + pinRect.height - sceneRect.top;
    const lineEndY = Math.max(0, pinRect.top - sceneRect.top) + 1;
    const xPct = (pointX / sceneW) * 100;
    const yPct = (tipY / sceneH) * 100;

    shock.style.setProperty("--shock-shift-x", "0px");
    shock.style.left = `${xPct}%`;
    shock.hidden = false;
    void shock.offsetWidth;

    if (isMobile) {
      const popupW = shock.offsetWidth;
      const popupH = shock.offsetHeight;
      const mediaH = frame.clientHeight || sceneH;
      const headroom = Math.max(0, mediaH - sceneH);
      // Gap between popup bottom and pin top so the footnote line stays visible
      const lineGap = MOBILE_LINE_GAP;
      // All pins may rise into media headroom (and slightly into figcaption overlap)
      const minTop = -(headroom + 24);
      let topPx = lineEndY - lineGap - popupH;
      topPx = Math.max(minTop, topPx);

      const idealLeft = pointX - popupW / 2;
      const minLeft = pad;
      const maxLeft = sceneW - pad - popupW;
      let left;
      if (idealLeft >= minLeft && idealLeft <= maxLeft) {
        // Fits — keep centered on the point
        left = idealLeft;
      } else {
        // Clamp to window; keep hotspot under popup so the line still meets it
        left = Math.max(minLeft, Math.min(idealLeft, maxLeft));
        const hitInset = 18;
        if (pointX < left + hitInset) {
          left = Math.max(minLeft, pointX - hitInset);
        }
        if (pointX > left + popupW - hitInset) {
          // Push right (allow tighter right edge) so the footnote hits the flat bottom, past the radius
          const needLeft = pointX - popupW + hitInset;
          const rightEdgePad = 2;
          left = Math.min(needLeft, sceneW - rightEdgePad - popupW);
          left = Math.max(minLeft, left);
        }
      }

      shock.style.left = `${left}px`;
      shock.style.top = `${(topPx / sceneH) * 100}%`;
      line.style.left = `${(pointX / sceneW) * 100}%`;

      const popupBottomPx = topPx + popupH;
      const lineH = Math.max(0, lineEndY - popupBottomPx);
      line.style.top = `${(popupBottomPx / sceneH) * 100}%`;
      line.style.height = `${(lineH / sceneH) * 100}%`;
    } else {
      const shockTop = Math.max(2, yPct - POPUP_OFFSET_PCT);
      shock.style.top = `${shockTop}%`;
      line.style.left = `${xPct}%`;

      // Keep centered popup inside the scene (rightmost point at ~94%)
      const popupW = shock.offsetWidth;
      const halfW = popupW / 2;
      const edgePad = 8;
      let shiftX = 0;
      const rightOverflow = pointX + halfW - (sceneW - edgePad);
      if (rightOverflow > 0) shiftX = -rightOverflow;
      const leftOverflow = edgePad - (pointX - halfW);
      if (leftOverflow > 0) shiftX = leftOverflow;
      shock.style.setProperty("--shock-shift-x", `${shiftX}px`);

      const popupBottomPx = (shockTop / 100) * sceneH + shock.offsetHeight;
      const lineH = Math.max(0, lineEndY - popupBottomPx);
      line.style.top = `${(popupBottomPx / sceneH) * 100}%`;
      line.style.height = `${(lineH / sceneH) * 100}%`;
    }
  };

  const show = (hotspot) => {
    clearTimeout(showTimer);
    hoveredHotspot = hotspot;
    hotspots.forEach((h) => {
      h.classList.toggle("is-hover", h === hotspot);
      if (h === hotspot) h.classList.remove("is-pulsing");
    });
    const restart = line.classList.contains("is-visible");
    shock.classList.remove("is-visible");
    if (restart) {
      line.classList.remove("is-visible");
      void line.offsetWidth;
    }
    // Place first at final coords, then draw footnote, then fade popup in place
    shock.style.transition = "none";
    placeAt(hotspot);
    void shock.offsetWidth;
    shock.style.transition = "";
    line.classList.add("is-visible");
    const popupDelay = window.matchMedia("(max-width: 860px)").matches ? 280 : 0;
    showTimer = window.setTimeout(() => {
      shock.classList.add("is-visible");
    }, restart ? 40 : popupDelay);
  };

  const hide = () => {
    clearTimeout(showTimer);
    hoveredHotspot = null;
    hotspots.forEach((h) => h.classList.remove("is-hover"));
    shock.classList.remove("is-visible");
    line.classList.remove("is-visible");
  };

  hotspots.forEach((hotspot) => {
    hotspot.setAttribute("tabindex", "0");
    hotspot.setAttribute("role", "button");
    if (!hotspot.getAttribute("aria-label")) {
      const copy = popups[hotspot.dataset.key] || defaultCopy;
      const title = String(copy.titleHtml || "")
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const label = [title, copy.subtitle].filter(Boolean).join(": ");
      if (label) hotspot.setAttribute("aria-label", label);
    }
  });

  bindHoverOrTap(hotspots, {
    show: (el) => show(el),
    hide,
  });

  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  root.classList.add("anim-chart");
  const g3Title = root.querySelector("figcaption h3") || root.querySelector("h3");
  const g3Sub = root.querySelector("figcaption p");
  const maya = root.querySelector(".maya");
  hotspots.forEach((h) => h.classList.add("anim-ann"));
  armRiseText(g3Title);
  armRiseLines(g3Sub);
  if (ANIM_ON && maya) maya.classList.add("anim-rise-block");

  // Title / subtitle / Maya: half visible
  whenInView(root, async () => {
    if (!ANIM_ON) return;
    await playRiseText(g3Title, { stagger: 42 });
    if (g3Sub) await playRiseLines(g3Sub, { stagger: 140, startDelay: 80 });
    if (maya) {
      await wait(120);
      maya.classList.add("is-shown");
    }
  }, 0.5);

  // Pins drop at ~2/3 visible, then pulse in sequence
  whenInView(root, async () => {
    if (!ANIM_ON) {
      root.classList.add("is-anim-done");
      hotspots.forEach(showEl);
      if (maya) maya.classList.add("is-shown");
      pulseTour.startTour();
      return;
    }
    const dropOrder = shuffle(hotspots);
    for (let i = 0; i < dropOrder.length; i++) {
      showEl(dropOrder[i]);
      if (i < dropOrder.length - 1) await wait(90 + Math.floor(Math.random() * 70));
    }
    await wait(900);
    root.classList.add("is-anim-done");
    pulseTour.startTour();
  }, 2 / 3);
}

function initQuotes() {
  document.querySelectorAll(".quote").forEach((quote) => {
    quote.classList.add("anim-quote");
    const p = quote.querySelector(":scope > p");
    const footer = quote.querySelector("footer");
    const photo = footer?.querySelector(".quote-img");
    const meta = footer?.querySelector(".quote-meta");
    const authorLines = meta ? [...meta.children] : [];

    armRiseText(p);
    if (ANIM_ON) {
      if (photo) photo.classList.add("anim-author-photo");
      authorLines.forEach((el) => el.classList.add("anim-author-line"));
    }

    whenCopyInView(quote, async () => {
      if (!ANIM_ON) {
        quote.classList.add("is-anim-done", "is-in");
        return;
      }
      quote.classList.add("is-mark-in");
      await wait(280);
      await playRiseText(p, { stagger: 36 });
      if (footer) {
        await wait(100);
        if (photo) {
          photo.classList.add("is-shown");
          await wait(480);
        }
        for (let i = 0; i < authorLines.length; i++) {
          authorLines[i].classList.add("is-shown");
          if (i < authorLines.length - 1) await wait(140);
        }
        await wait(220);
      }
      quote.classList.add("is-anim-done");
    }, 1);
  });
}

initQuotes();

function initArticleTitle() {
  const h1 = document.querySelector(".article-head h1");
  if (!h1) return;
  armRiseText(h1);
  whenCopyInView(
    h1,
    async () => {
      if (!ANIM_ON) {
        prepareRiseText(h1).forEach(showEl);
        return;
      }
      await playRiseText(h1, { stagger: 42 });
    },
    0.5
  );
}

initArticleTitle();

function initCopyFade() {
  const main = document.querySelector(".main");
  if (!main) return;
  const els = [
    ...main.querySelectorAll(".article-head .dek"),
    ...main.querySelectorAll(":scope > h2"),
    ...[...main.querySelectorAll(":scope > p")].filter(
      (p) => !p.classList.contains("cta-wrap") && !p.classList.contains("source")
    ),
  ];
  els.forEach((el) => {
    whenCopyInView(
      el,
      () => {
        el.classList.add("is-shown");
      },
      1
    );
  });
}

initCopyFade();

function initReadMore() {
  const btn = document.querySelector(".read-more");
  if (!btn) return;
  if (ANIM_ON) btn.classList.add("anim-rise-block");
  whenInView(btn, () => {
    if (!ANIM_ON) {
      btn.classList.add("is-shown", "is-anim-done");
      return;
    }
    btn.classList.add("is-shown");
  }, 1);
}

initReadMore();

function initGraphic0() {
  const el = document.querySelector(".graphic-0");
  const img = el?.querySelector("img");
  if (!el || !img) return;
  // Client: no entrance animation on graphic-0 (mobile + desktop)
  el.classList.add("is-shown", "is-anim-done");
  img.classList.add("is-shown");
}

initGraphic0();

function initGlassParallax() {
  const layer = document.querySelector(".glass-layer");
  const main = document.querySelector(".main");
  if (!layer || !main) return;

  const mq = window.matchMedia("(min-width: 861px)");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const glasses = [...layer.querySelectorAll(".glass")];

  const hydrateGlassImages = () => {
    if (!mq.matches) return;
    glasses.forEach((el) => {
      const src = el.dataset.src;
      if (src && el.getAttribute("src") !== src) el.src = src;
    });
  };
  hydrateGlassImages();
  mq.addEventListener?.("change", hydrateGlassImages);

  const anchors = {
    0: {
      between: ["#chart-1-wrap", "#chart-2-wrap"],
    },
    1: {
      between: ["#chart-2-wrap", ".graphic-3"],
    },
    2: {
      target: "#heading-infrastructure",
    },
    3: {
      target: ".cta-wrap",
      align: "end",
    },
  };

  const docY = (el) => el.getBoundingClientRect().top + window.scrollY;

  let base = glasses.map(() => ({ x: 0, y: 0, h: 0 }));
  let ticking = false;

  const layout = () => {
    if (!mq.matches) {
      glasses.forEach((el) => {
        el.style.removeProperty("--glass-x");
        el.style.removeProperty("--glass-y");
      });
      return;
    }

    const gutter = 4;
    const mainRect = main.getBoundingClientRect();
    const pageRect = layer.getBoundingClientRect();
    // Text column only (prose), not full-width charts
    const proseEl =
      main.querySelector(".article-head") ||
      main.querySelector(":scope > p") ||
      main.querySelector(":scope > h2");
    const proseRect = proseEl?.getBoundingClientRect() || mainRect;
    const colL = proseRect.left;
    const colR = proseRect.right;
    const pageTop = docY(layer);
    const pageLeft = pageRect.left;

    glasses.forEach((el, i) => {
      const conf = anchors[i] || {};
      const w = Number(el.dataset.width) || el.offsetWidth || 320;
      // Force width before measuring height (first layout)
      el.style.width = `${w}px`;
      const h = el.offsetHeight || w * 0.7;
      let y = 0;

      if (conf.between) {
        const a = document.querySelector(conf.between[0]);
        const b = document.querySelector(conf.between[1]);
        if (a && b) {
          const gapTop = docY(a) + a.offsetHeight;
          const gapBot = docY(b);
          y = (gapTop + gapBot) / 2 - h / 2;
        }
      } else if (conf.target) {
        const t = document.querySelector(conf.target);
        if (t) {
          if (conf.align === "end") {
            y = docY(t) + t.offsetHeight / 2 - h * 0.55;
          } else {
            y = docY(t) - h * 0.15;
          }
        }
      }

      const side = el.dataset.side;
      // Keep clear of the content column; allow clipping at the viewport edge
      const x =
        side === "left"
          ? colL - gutter - w - pageLeft
          : colR + gutter - pageLeft;

      base[i] = { x, y: y - pageTop, h };
      el.style.setProperty("--glass-x", `${x}px`);
    });

    paint();
  };

  const paint = () => {
    if (!mq.matches) return;
    const vh = window.innerHeight;
    const motionOff = reduceMotion.matches || document.documentElement.classList.contains("no-animate");
    const layerTop = layer.getBoundingClientRect().top;

    glasses.forEach((el, i) => {
      const b = base[i];
      if (!b) return;
      const speed = motionOff ? 0 : Number(el.dataset.parallax) || 0.25;
      // Lag behind scroll: move less than the page as the element crosses the viewport
      const screenY = b.y + layerTop;
      const center = screenY + b.h / 2;
      const drift = (vh * 0.5 - center) * speed;
      el.style.setProperty("--glass-y", `${b.y + drift}px`);
    });
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      paint();
      ticking = false;
    });
  };

  layout();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    layout();
  });
  if (document.fonts?.ready) document.fonts.ready.then(layout);
  // Charts remount async — relayout after they settle
  setTimeout(layout, 400);
  setTimeout(layout, 1200);
  mq.addEventListener?.("change", layout);
}

initGlassParallax();
