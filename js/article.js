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

function makeAnnDot(parent, x, y, color, filterId) {
  const g = svgEl("g", { class: "ann-dot", transform: `translate(${x} ${y})` });
  g.appendChild(svgEl("circle", { class: "ann-dot__pulse", r: "6", fill: color }));
  g.appendChild(
    svgEl("circle", {
      class: "ann-dot__halo",
      r: "8",
      fill: "#fff",
      filter: `url(#${filterId})`,
    })
  );
  g.appendChild(svgEl("circle", { class: "ann-dot__core", r: "6", fill: color }));
  parent.appendChild(g);
  return g;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) run();
      });
    },
    // Low threshold: tall mobile blocks rarely reach 0.22 visible ratio
    { threshold: [0, 0.01, 0.08, threshold], rootMargin: "0px 0px -4% 0px" }
  );
  io.observe(el);

  // Safari often skips the initial IO callback for already-visible nodes
  const checkNow = () => {
    if (done) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    if (vw <= 0 || vh <= 0) return;
    const visibleH = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
    const visibleW = Math.min(rect.right, vw) - Math.max(rect.left, 0);
    if (visibleH > 8 && visibleW > 8) run();
  };
  requestAnimationFrame(() => {
    checkNow();
    requestAnimationFrame(checkNow);
  });
  window.setTimeout(checkNow, 100);
  window.setTimeout(checkNow, 400);
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

async function playChartSequence({
  wrap,
  titleEl,
  subEl,
  sourceEl,
  chrome,
  lines = [],
  dots = [],
  ann = [],
  extraFinal = [],
  lineGap = 380,
  lineDuration = 1400,
  dotStagger = 28,
}) {
  const finish = () => {
    wrap?.classList.add("is-anim-done");
    chrome?.forEach(showEl);
    lines.forEach((line) => line.classList.add("is-drawn"));
    dots.forEach(showEl);
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

  await playRiseText(titleEl, { stagger: 42 });
  if (subEl) await playRiseLines(subEl, { stagger: 140, startDelay: 80 });
  await wait(220);
  chrome.forEach(showEl);
  if (sourceEl) {
    sourceEl.classList.add("anim-fade");
    wait(380).then(() => showEl(sourceEl));
  }
  await wait(420);
  for (let i = 0; i < lines.length; i++) {
    lines[i].classList.add("is-drawn");
    if (i < lines.length - 1) await wait(lineGap);
  }
  if (lines.length) await wait(lineDuration);
  // Visual markers only, one LTR pass by x (small + large + % labels)
  const isHotspot = (el) => el.classList?.contains("ann-hotspot");
  const pointEls = [...dots, ...ann].filter((el) => !isHotspot(el));
  if (pointEls.length) await showStaggerLTR(pointEls, dotStagger);
  ann.filter(isHotspot).forEach(showEl);
  extraFinal.forEach(showEl);
  await wait(200);
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

  ficoPts.forEach(([x, y], i) => {
    if (annIdx.includes(i)) return;
    ficoG.appendChild(
      svgEl("circle", {
        class: "dot",
        cx: x,
        cy: y,
        r: dotR,
        fill: PURPLE_SOFT,
      })
    );
  });
  allPts.forEach(([x, y], i) => {
    if (annIdx.includes(i)) return;
    allG.appendChild(
      svgEl("circle", {
        class: "dot",
        cx: x,
        cy: y,
        r: dotR,
        fill: PURPLE,
      })
    );
  });

  svg.append(ficoG, allG);

  const seriesOn = { all: true, fico: true };
  const dots = allPts.map((p, i) => [p, ficoPts[i]]);
  const annHotspots = [];
  const annDots = [];
  annIdx.forEach((i) => {
    const [a, f] = dots[i];
    const hotspot = svgEl("g", { class: "ann-hotspot" });
    const allDot = makeAnnDot(allG, a[0], a[1], PURPLE, "dot-shadow");
    const ficoDot = makeAnnDot(ficoG, f[0], f[1], PURPLE_SOFT, "dot-shadow");
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
      "font-size": isMobile ? 15 : fs,
      "font-weight": 600,
      "font-family": "Inter, sans-serif",
      "text-anchor": "middle",
      style: `line-height: ${isMobile ? 15 : fs}px`,
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
    "60%"
  );
  const rightAttrs = {
    "font-size": fsSm,
    "font-family": "Inter, sans-serif",
    "letter-spacing": "-0.05em",
    style: `line-height: ${fsSm}px`,
  };
  const rightTexts = [
    add({ ...rightAttrs, x: cx + padX, y: cy + (isMobile ? 44 : 48), fill: PURPLE, "font-weight": 600 }, "fewer new cards"),
    add({ ...rightAttrs, x: cx + padX, y: cy + (isMobile ? 56 : 62), fill: PURPLE, "font-weight": 400 }, "versus Jan 2020"),
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
    "90%"
  );
  rightTexts.push(
    add({ ...rightAttrs, x: cx + padX, y: cy + (isMobile ? 94 : 102), fill: PURPLE_SOFT, "font-weight": 600 }, "fewer new cards"),
    add({ ...rightAttrs, x: cx + padX, y: cy + (isMobile ? 120 : 131), fill: PURPLE_SOFT, "font-weight": 400 }, "For the riskiest borrowers"),
    add({ ...rightAttrs, x: cx + padX, y: cy + (isMobile ? 134 : 147), fill: PURPLE_SOFT, "font-weight": 400 }, "the market almost froze")
  );
  g.appendChild(panel);
  svg.appendChild(g);

  const alignPopup = (name, isJuly = false) => {
    monthLabel.textContent = name;
    if (isMobile) {
      // No month↔body alignment on mobile — month centered, body stays by percents
      const maxRightW = Math.max(...rightTexts.map((t) => t.getComputedTextLength()));
      const percentW = Math.max(pct60.getComputedTextLength(), pct90.getComputedTextLength());
      const minGap = 16;
      calloutW = Math.max(
        padX * 2 + Math.max(monthLabel.getComputedTextLength(), percentW + minGap + maxRightW),
        200
      );
      calloutRect.setAttribute("width", calloutW);
      monthLabel.setAttribute("x", cx + calloutW / 2);
      monthLabel.setAttribute("text-anchor", "middle");
      rightTexts.forEach((t) => t.setAttribute("x", cx + padX + percentW + minGap));
      // July → right edge; April → same relative spot as desktop (not flush left)
      let targetLeft = isJuly
        ? plotR - calloutW
        : plotL + Math.round((477 / 933) * (plotR - plotL));
      targetLeft = Math.max(plotL, Math.min(targetLeft, plotR - calloutW));
      panel.setAttribute("transform", `translate(${targetLeft - cx}, 0)`);
      return;
    }
    const monthW = monthLabel.getComputedTextLength();
    const maxRightW = Math.max(...rightTexts.map((t) => t.getComputedTextLength()));
    const percentW = Math.max(pct60.getComputedTextLength(), pct90.getComputedTextLength());
    const minGap = 24;
    calloutW = Math.max(
      2 * padX - monthW + 2 * maxRightW,
      2 * (padX + percentW + minGap) + monthW,
      2 * padX + percentW + minGap + maxRightW
    );
    calloutRect.setAttribute("width", calloutW);
    const center = cx + calloutW / 2;
    monthLabel.setAttribute("x", center);
    const colX = center - monthW / 2;
    rightTexts.forEach((t) => t.setAttribute("x", colX));
    panel.setAttribute("transform", isJuly ? `translate(${plotR - calloutW - cx}, 0)` : "");
  };

  let activeAnn = -1;

  const clearAnnPulses = () => {
    annDots.forEach((pair) => {
      pair.all.classList.remove("is-pulsing");
      pair.fico.classList.remove("is-pulsing");
    });
  };

  const pulseActiveAnn = () => {
    clearAnnPulses();
    if (activeAnn < 0) return;
    const pair = annDots[activeAnn];
    if (!pair) return;
    if (seriesOn.all) pair.all.classList.add("is-pulsing");
    if (seriesOn.fico) pair.fico.classList.add("is-pulsing");
  };

  const showAnn = (i) => {
    if (!seriesOn.all && !seriesOn.fico) return;
    activeAnn = i;
    annGuides.forEach((guide) => guide.classList.remove("is-visible"));
    alignPopup(i === 0 ? "April" : "July", i === 1);
    g.classList.add("is-visible");
    annGuides[i].classList.add("is-visible");
    pulseActiveAnn();
  };

  const hideAnn = () => {
    activeAnn = -1;
    g.classList.remove("is-visible");
    annGuides.forEach((guide) => guide.classList.remove("is-visible"));
    clearAnnPulses();
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
  });
  const legendFico = svgEl("g", {
    class: "chart-legend chart-legend--fico",
    role: "button",
    tabindex: "0",
    "aria-pressed": "true",
  });
  const legendRow1Y = isMobile ? 14 : 26;
  const legendRow2Y = isMobile ? 34 : 46;
  const l1 = svgEl("text", {
    x: 0,
    y: legendRow1Y,
    fill: PURPLE,
    "font-size": fsLegend,
    "font-family": "Inter, sans-serif",
    "font-weight": "700",
    "dominant-baseline": "central",
  });
  l1.textContent = "All borrowers";
  legendAll.appendChild(l1);
  const l2 = svgEl("text", {
    x: 0,
    y: legendRow2Y,
    fill: PURPLE_SOFT,
    "font-size": fsLegend,
    "font-family": "Inter, sans-serif",
    "font-weight": "700",
    "dominant-baseline": "central",
  });
  l2.textContent = isMobile ? "FICO <580" : "FICO <580 (highest-risk)";
  legendFico.appendChild(l2);
  svg.append(legendAll, legendFico);

  root.appendChild(svg);
  alignPopup("April");
  if (document.fonts?.ready) {
    document.fonts.ready.then(() =>
      alignPopup(monthLabel.textContent || "April", monthLabel.textContent === "July")
    );
  }

  const legendTextX = legendRight - Math.max(l1.getComputedTextLength(), l2.getComputedTextLength());
  l1.setAttribute("x", legendTextX);
  l2.setAttribute("x", legendTextX);
  const legendX = legendTextX - 15;
  legendAll.insertBefore(
    svgEl("circle", { cx: legendX, cy: legendRow1Y, r: 8, fill: "#fff", filter: "url(#dot-shadow)" }),
    l1
  );
  legendAll.insertBefore(
    svgEl("circle", { class: "chart-legend__core", cx: legendX, cy: legendRow1Y, r: 6, fill: PURPLE }),
    l1
  );
  legendAll.appendChild(
    svgEl("rect", {
      x: legendX - 10,
      y: legendRow1Y - 12,
      width: legendRight - legendX + 10,
      height: 24,
      fill: "transparent",
    })
  );
  legendFico.insertBefore(
    svgEl("circle", { cx: legendX, cy: legendRow2Y, r: 8, fill: "#fff", filter: "url(#dot-shadow)" }),
    l2
  );
  legendFico.insertBefore(
    svgEl("circle", { class: "chart-legend__core", cx: legendX, cy: legendRow2Y, r: 6, fill: PURPLE_SOFT }),
    l2
  );
  legendFico.appendChild(
    svgEl("rect", {
      x: legendX - 10,
      y: legendRow2Y - 12,
      width: legendRight - legendX + 10,
      height: 24,
      fill: "transparent",
    })
  );

  const setSeriesVisible = (key, on) => {
    seriesOn[key] = on;
    const layer = key === "all" ? allG : ficoG;
    const legend = key === "all" ? legendAll : legendFico;
    layer.classList.toggle("is-off", !on);
    legend.classList.toggle("is-off", !on);
    legend.setAttribute("aria-pressed", on ? "true" : "false");
    if (!on) {
      g.classList.remove("is-visible");
      annGuides.forEach((guide) => guide.classList.remove("is-visible"));
      activeAnn = -1;
    }
    pulseActiveAnn();
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
    await playChartSequence({
      wrap,
      titleEl,
      subEl,
      sourceEl,
      chrome: [...svg.querySelectorAll(".anim-chrome")],
      lines: [ficoLine, allLine],
      dots: [...svg.querySelectorAll(".anim-dot")],
      ann: [...svg.querySelectorAll(".anim-ann")],
      lineGap: 500,
    });
  });
}

function drawChart2(root) {
  const wrap = setupChartAnim(root);
  const isMobile = window.matchMedia("(max-width: 860px)").matches;
  const isTablet = window.matchMedia("(min-width: 500px) and (max-width: 860px)").matches;
  const w = isMobile ? Math.max(320, Math.round(root.clientWidth || 390)) : 944;
  const h = isMobile ? 460 : 420;
  const pad = isTablet
    ? { l: 28, r: 28, t: 62, b: 56 }
    : isMobile
      ? { l: 20, r: 20, t: 62, b: 56 }
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

  // Entrance scrubber on Q4 2020 (index 3); handle circles added later, above series
  const scrubIdx = 3;
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

  applyPts.forEach(([x, y], i) => {
    if (labeledB[i]) return;
    applyG.appendChild(svgEl("circle", { class: "dot", cx: x, cy: y, r: dotR, fill: PINK }));
  });
  acceptPts.forEach(([x, y], i) => {
    if (labeledA[i]) return;
    acceptG.appendChild(svgEl("circle", { class: "dot", cx: x, cy: y, r: dotR, fill: PURPLE }));
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
  svg.appendChild(scrubHandle);

  const calloutPad = isMobile ? 16 : 22;
  let calloutW = isMobile ? 180 : 200;
  const g = svgEl("g", { class: "callout-box callout-box--hover" });
  const panel = svgEl("g", { class: "callout-panel" });
  const titleY = calloutPad + (isMobile ? 13 : 15);
  const body1Y = titleY + (isMobile ? 20 : 24);
  const body2Y = body1Y + (isMobile ? 18 : 22);
  const lastBaseline = body2Y + (isMobile ? 11 : 12);
  const calloutH = lastBaseline + calloutPad;
  const calloutRect = svgEl("rect", {
    x: 0,
    y: 0,
    width: calloutW,
    height: calloutH,
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
  const calloutTitle = add(
    {
      x: calloutPad,
      y: titleY,
      fill: "#fff",
      "font-size": isMobile ? 16 : 20,
      "font-weight": 600,
      "font-family": "Inter, sans-serif",
      style: `line-height: ${isMobile ? 16 : 20}px`,
    },
    "Q4 2020"
  );
  const body1 = add(
    {
      x: calloutPad,
      y: body1Y,
      fill: PURPLE,
      "font-size": fsSm,
      "font-family": "Inter, sans-serif",
      "letter-spacing": "-0.05em",
      style: `line-height: ${fsSm}px`,
    },
    "Second lockdowns across Europe"
  );
  const body2 = svgEl("text", {
    x: calloutPad,
    y: body2Y,
    fill: PURPLE_SOFT,
    "font-size": fsSm,
    "font-family": "Inter, sans-serif",
    "letter-spacing": "-0.05em",
    style: `line-height: ${fsSm}px`,
  });
  const body2a = svgEl("tspan", { x: calloutPad, dy: 0 });
  body2a.textContent = "A further decline in acceptance";
  const body2b = svgEl("tspan", { x: calloutPad, dy: fsSm });
  body2b.textContent = "to 66.4%";
  body2.append(body2a, body2b);
  panel.appendChild(body2);
  g.appendChild(panel);

  let scrubPosX = scrubX;

  const setScrubEase = (on) => {
    scrubber.classList.toggle("scrub-ease", on);
    scrubHandle.classList.toggle("scrub-ease", on);
    panel.classList.toggle("scrub-ease", on);
  };

  const moveScrubberTo = (x, { animate = false } = {}) => {
    scrubPosX = x;
    setScrubEase(animate);
    const t = `translate(${x}, 0)`;
    scrubber.setAttribute("transform", t);
    scrubHandle.setAttribute("transform", t);
    scrubber.setAttribute("data-anim-x", x);
    scrubHandle.setAttribute("data-anim-x", x);
  };

  const layoutCallout = () => {
    const contentW = Math.max(
      calloutTitle.getComputedTextLength(),
      body1.getComputedTextLength(),
      body2a.getComputedTextLength(),
      body2b.getComputedTextLength()
    );
    calloutW = Math.ceil(contentW + calloutPad * 2);
    calloutRect.setAttribute("width", calloutW);
    calloutRect.setAttribute("height", calloutH);
  };

  const calloutPxFor = (x) => {
    const gap = 31;
    const left = x + gap;
    const right = x - calloutW - gap;
    return left + calloutW <= plotR ? left : Math.max(plotL, right);
  };

  const calloutPy = isMobile ? 50 : 0;

  const placeCalloutPanel = (x) => {
    panel.setAttribute("transform", `translate(${calloutPxFor(x)}, ${calloutPy})`);
  };

  const clearAnnPulses = () => {
    chart2AnnDots.forEach(({ pulseDots }) => {
      pulseDots.forEach(({ el }) => el.classList.remove("is-pulsing"));
    });
  };

  const pulseQuarter = (i) => {
    clearAnnPulses();
    const item = chart2AnnDots.find((d) => d.i === i);
    if (!item) return;
    item.pulseDots.forEach(({ key, el }) => {
      if (seriesOn[key]) el.classList.add("is-pulsing");
    });
  };

  const showCalloutAt = (i, x = cxAt(i), { animate = false } = {}) => {
    const [q, year] = quarterLabels[i];
    calloutTitle.textContent = `${q} ${year}`;
    body2b.textContent = `to ${labeledA[i] || `${accept[i]}%`}`;
    layoutCallout();
    setScrubEase(animate);
    placeCalloutPanel(x);
    moveScrubberTo(x, { animate });
    svg.appendChild(g);
    g.classList.add("is-visible");
    pulseQuarter(i);
  };

  const hideCallout = () => {
    g.classList.remove("is-visible");
    clearAnnPulses();
  };

  const seriesOn = { accept: true, apply: true };
  const chart2AnnDots = [];

  activeIdx.forEach((i) => {
    const pulseDots = [];
    if (labeledA[i]) {
      const [x, y] = acceptPts[i];
      pulseDots.push({ key: "accept", el: makeAnnDot(acceptG, x, y, PURPLE, "dot-shadow-2") });
      const t = svgEl("text", {
        class: "anim-ann chart-pct-label",
        x,
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
    }
    if (labeledB[i]) {
      const [x, y] = applyPts[i];
      pulseDots.push({ key: "apply", el: makeAnnDot(applyG, x, y, PINK, "dot-shadow-2") });
      const t = svgEl("text", {
        class: "anim-ann chart-pct-label",
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
    }
    chart2AnnDots.push({ i, pulseDots });
  });

  const snapQuarter = (x) => {
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

  const clientToSvgX = (clientX) => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return cxAt(scrubIdx);
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = 0;
    return pt.matrixTransform(ctm.inverse()).x;
  };

  let currentScrub = scrubIdx;

  const clampScrubX = (x) => Math.min(cxAt(n - 1), Math.max(cxAt(0), x));

  const quarterHasActive = (i) =>
    (seriesOn.accept && labeledA[i]) || (seriesOn.apply && labeledB[i]);

  const applyScrubberAt = (i, { animate = false } = {}) => {
    currentScrub = i;
    const x = cxAt(i);
    if (quarterHasActive(i)) showCalloutAt(i, x, { animate });
    else {
      moveScrubberTo(x, { animate });
      hideCallout();
    }
  };

  const scrubDragTo = (x) => {
    const clamped = clampScrubX(x);
    moveScrubberTo(clamped, { animate: false });
    const i = snapQuarter(clamped);
    if (quarterHasActive(i)) {
      const [q, year] = quarterLabels[i];
      calloutTitle.textContent = `${q} ${year}`;
      body2b.textContent = `to ${labeledA[i] || `${accept[i]}%`}`;
      layoutCallout();
      placeCalloutPanel(clamped);
      svg.appendChild(g);
      g.classList.add("is-visible");
      pulseQuarter(i);
    } else {
      hideCallout();
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

  let dragging = false;
  let activePointerId = null;

  const jumpToQuarter = (i) => {
    applyScrubberAt(i, { animate: false });
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
      applyScrubberAt(i, { animate: true });
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

  // Hit targets above scrub rail so annotated dots stay tappable
  const annScrubHits = [];
  chart2AnnDots.forEach(({ i, pulseDots }) => {
    pulseDots.forEach(({ key, el }) => {
      el.classList.add("ann-dot--scrub");
      const tr = el.getAttribute("transform") || "";
      const m = tr.match(/translate\(\s*([-.\d]+)[ ,]+([-.\d]+)/);
      if (!m) return;
      const hit = svgEl("circle", {
        class: "ann-dot-scrub-hit",
        cx: m[1],
        cy: m[2],
        r: isMobile ? 22 : 16,
        fill: "transparent",
        "data-series": key,
      });
      hit.addEventListener("pointerdown", (e) => e.stopPropagation());
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

  svg.append(legendAccept, legendApply);
  svg.appendChild(g);
  root.appendChild(svg);

  const setSeriesVisible = (key, on) => {
    seriesOn[key] = on;
    const layer = key === "accept" ? acceptG : applyG;
    const axis = key === "accept" ? leftAxisG : rightAxisG;
    const legend = key === "accept" ? legendAccept : legendApply;
    layer.classList.toggle("is-off", !on);
    axis.classList.toggle("is-off", !on);
    legend.classList.toggle("is-off", !on);
    legend.setAttribute("aria-pressed", on ? "true" : "false");
    annScrubHits.forEach((hit) => {
      if (hit.getAttribute("data-series") === key) {
        hit.style.pointerEvents = on ? "all" : "none";
      }
    });
    if (wrap.classList.contains("is-anim-done") || !ANIM_ON) {
      applyScrubberAt(currentScrub);
    }
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
    g,
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
    await playChartSequence({
      wrap,
      titleEl,
      subEl,
      sourceEl,
      chrome: [...svg.querySelectorAll(".anim-chrome")],
      lines: [acceptLine, applyLine],
      dots: [...svg.querySelectorAll(".anim-dot")],
      ann: [...svg.querySelectorAll(".anim-ann")],
      extraFinal: [],
    });
    applyScrubberAt(scrubIdx);
  });
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
  const popups = {
    pen: { ...defaultCopy },
    car: { ...defaultCopy },
    gauge: { ...defaultCopy },
    card: { ...defaultCopy },
    bar: { ...defaultCopy },
    case: { ...defaultCopy },
  };

  const POPUP_OFFSET_PCT = 41.17; // desktop: distance from point to popup top
  const MOBILE_LINE_GAP = 48; // px between popup bottom and point (longer footnote on mobile)

  const shiftPct = () => {
    const scene = root.querySelector(".graphic-3-scene");
    const shiftPx = parseFloat(getComputedStyle(root).getPropertyValue("--g3-shift")) || 0;
    const h = scene?.clientHeight || 1;
    return (shiftPx / h) * 100;
  };

  let showTimer = 0;

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
    const x = Number(hotspot.dataset.x);
    const y = Number(hotspot.dataset.y) + shiftPct();
    const sceneW = scene.clientWidth || 1;
    const sceneH = scene.clientHeight || 1;
    const pad =
      parseFloat(getComputedStyle(root).getPropertyValue("--g3-pad")) || 16;
    const pointX = (x / 100) * sceneW;
    const pointYPx = (y / 100) * sceneH;

    shock.style.setProperty("--shock-shift-x", "0px");
    shock.style.left = `${x}%`;
    shock.hidden = false;
    void shock.offsetWidth;

    if (isMobile) {
      const popupW = shock.offsetWidth;
      const popupH = shock.offsetHeight;
      // Popup above the point with a short gap (shorter footnote than desktop)
      let topPx = pointYPx - MOBILE_LINE_GAP - popupH;
      topPx = Math.max(pad, Math.min(topPx, pointYPx - MOBILE_LINE_GAP - 40));

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
      const lineH = Math.max(0, pointYPx - popupBottomPx);
      line.style.top = `${(popupBottomPx / sceneH) * 100}%`;
      line.style.height = `${(lineH / sceneH) * 100}%`;
    } else {
      const shockTop = Math.max(2, y - POPUP_OFFSET_PCT);
      shock.style.top = `${shockTop}%`;
      line.style.left = `${x}%`;

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
      const lineH = Math.max(0, pointYPx - popupBottomPx);
      line.style.top = `${(popupBottomPx / sceneH) * 100}%`;
      line.style.height = `${(lineH / sceneH) * 100}%`;
    }
  };

  const show = (hotspot) => {
    clearTimeout(showTimer);
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
    shock.classList.remove("is-visible");
    line.classList.remove("is-visible");
  };

  hotspots.forEach((hotspot) => {
    hotspot.setAttribute("tabindex", "0");
    hotspot.setAttribute("role", "button");
  });

  bindHoverOrTap(hotspots, {
    show: (el) => show(el),
    hide,
  });

  root.classList.add("anim-chart");
  const g3Title = root.querySelector("h3");
  const maya = root.querySelector(".maya");
  hotspots.forEach((h) => h.classList.add("anim-ann"));
  armRiseText(g3Title);
  if (ANIM_ON && maya) maya.classList.add("anim-rise-block");

  whenInView(root, async () => {
    if (!ANIM_ON) {
      root.classList.add("is-anim-done");
      hotspots.forEach(showEl);
      return;
    }
    await playRiseText(g3Title, { stagger: 42 });
    if (maya) {
      await wait(120);
      maya.classList.add("is-shown");
      await wait(500);
    }
    for (let i = 0; i < hotspots.length; i++) {
      showEl(hotspots[i]);
      if (i < hotspots.length - 1) await wait(70);
    }
    await wait(200);
    root.classList.add("is-anim-done");
  });
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

    whenInView(quote, async () => {
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
    });
  });
}

initQuotes();

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
  });
}

initReadMore();

function initGraphic0() {
  const el = document.querySelector(".graphic-0");
  const img = el?.querySelector("img");
  if (!el || !img) return;
  if (ANIM_ON) {
    el.classList.add("anim-hero-frame");
    img.classList.add("anim-hero-zoom");
  }
  whenInView(
    el,
    async () => {
      if (!ANIM_ON) {
        el.classList.add("is-shown", "is-anim-done");
        img.classList.add("is-shown");
        return;
      }
      await wait(120);
      el.classList.add("is-shown");
      img.classList.add("is-shown");
    },
    0.12
  );
}

initGraphic0();
