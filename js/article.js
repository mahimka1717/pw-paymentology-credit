const PURPLE = "#8138ff";
const PURPLE_SOFT = "#d8adfe";
const PINK = "#ff73ff";
const NAVY = "#15154d";
const BLUE = "#3a4ea1";
const GRID = "#c8c8dc";
const INK = "#15154d";

function svgEl(name, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function polyline(points) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

function scaleY(value, min, max, top, bottom) {
  return top + ((max - value) / (max - min)) * (bottom - top);
}

function animateOnView(node) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.28 }
  );
  io.observe(node);
}

function drawChart1(root) {
  const w = 944;
  const h = 400;
  const svg = svgEl("svg", { viewBox: `0 0 ${w} ${h}`, role: "img" });
  svg.setAttribute("aria-label", "New credit card originations during COVID-19");

  const plotL = 0;
  const plotR = 933;
  const plotT = 76;
  const plotB = 359;
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
      x: plotL - 10,
      y: y + 5,
      fill: BLUE,
      "font-size": 15,
      "font-weight": "600",
      "text-anchor": "end",
      "font-family": "Inter, sans-serif",
    });
    label.textContent = String(t);
    svg.appendChild(label);
  });

  const axisTitle = svgEl("text", {
    x: plotL,
    y: 30,
    fill: BLUE,
    "font-size": 15,
    "font-family": "Inter, sans-serif",
  });
  axisTitle.innerHTML = "";
  const t1 = svgEl("tspan", { x: plotL, dy: 0, "font-weight": "700" });
  t1.textContent = "Change in number of cards";
  const t2 = svgEl("tspan", { x: plotL, dy: 18 });
  t2.textContent = "(Jan 2020 = 100)";
  axisTitle.append(t1, t2);
  svg.appendChild(axisTitle);

  const m0 = 20.2;
  const step = 147.4;
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
      y1: 18,
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
    "stroke-width": 2.5,
    pathLength: "1",
  });
  const allLine = svgEl("polyline", {
    class: "line-draw",
    points: polyline(allPts),
    stroke: PURPLE,
    "stroke-width": 2.5,
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
        r: 3,
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
        r: 3,
        fill: PURPLE,
      })
    );
  });

  svg.append(ficoG, allG);

  const seriesOn = { all: true, fico: true };
  const dots = allPts.map((p, i) => [p, ficoPts[i]]);
  const annHotspots = [];
  annIdx.forEach((i) => {
    const [a, f] = dots[i];
    const hotspot = svgEl("g", { class: "ann-hotspot" });
    allG.appendChild(
      svgEl("circle", {
        cx: a[0],
        cy: a[1],
        r: 8,
        fill: "#fff",
        filter: "url(#dot-shadow)",
      })
    );
    allG.appendChild(svgEl("circle", { cx: a[0], cy: a[1], r: 6, fill: PURPLE }));
    ficoG.appendChild(
      svgEl("circle", {
        cx: f[0],
        cy: f[1],
        r: 8,
        fill: "#fff",
        filter: "url(#dot-shadow)",
      })
    );
    ficoG.appendChild(svgEl("circle", { cx: f[0], cy: f[1], r: 6, fill: PURPLE_SOFT }));
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
      svgEl("circle", { cx: x, cy: frameB, r: 3, fill: BLUE })
    );
    const text = svgEl("text", {
      x,
      y: frameB + 20,
      fill: BLUE,
      "font-size": 15,
      "font-weight": "600",
      "text-anchor": "middle",
      "font-family": "Inter, sans-serif",
    });
    text.textContent = label;
    svg.appendChild(text);
  });

  const ev1 = svgEl("text", {
    x: eventX + 8,
    y: 30,
    fill: INK,
    "font-size": 15,
    "font-family": "Inter, sans-serif",
    "font-weight": "700",
  });
  ev1.textContent = "15 March 2020";
  svg.appendChild(ev1);
  const ev2 = svgEl("text", {
    x: eventX + 8,
    y: 48,
    fill: INK,
    "font-size": 15,
    "font-family": "Inter, sans-serif",
  });
  ev2.textContent = "US national emergency declared";
  svg.appendChild(ev2);

  const g = svgEl("g", { class: "callout-box callout-box--hover" });
  const panel = svgEl("g", { class: "callout-panel" });
  let calloutW = 310;
  const cx = 477;
  const cy = plotT;
  const padX = 22;
  const calloutRect = svgEl("rect", {
    x: cx,
    y: cy,
    width: calloutW,
    height: 161,
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
      y: cy + 24,
      fill: "#fff",
      "font-size": 15,
      "font-weight": 600,
      "font-family": "Inter, sans-serif",
      "text-anchor": "middle",
      style: "line-height: 15px",
    },
    "April"
  );
  const pct60 = add(
    {
      x: cx + padX,
      y: cy + 60,
      fill: PURPLE,
      "font-size": 30,
      "font-weight": 900,
      "font-family": '"PP Monument Extended", sans-serif',
      style: "line-height: 30px",
    },
    "60%"
  );
  const rightAttrs = {
    "font-size": 12,
    "font-family": "Inter, sans-serif",
    "letter-spacing": "-0.05em",
    style: "line-height: 12px",
  };
  const rightTexts = [
    add({ ...rightAttrs, x: cx + padX, y: cy + 48, fill: PURPLE, "font-weight": 600 }, "fewer new cards"),
    add({ ...rightAttrs, x: cx + padX, y: cy + 62, fill: PURPLE, "font-weight": 400 }, "versus Jan 2020"),
  ];
  const pct90 = add(
    {
      x: cx + padX,
      y: cy + 102,
      fill: PURPLE_SOFT,
      "font-size": 30,
      "font-weight": 900,
      "font-family": '"PP Monument Extended", sans-serif',
      style: "line-height: 30px",
    },
    "90%"
  );
  rightTexts.push(
    add({ ...rightAttrs, x: cx + padX, y: cy + 102, fill: PURPLE_SOFT, "font-weight": 600 }, "fewer new cards"),
    add({ ...rightAttrs, x: cx + padX, y: cy + 131, fill: PURPLE_SOFT, "font-weight": 400 }, "For the riskiest borrowers"),
    add({ ...rightAttrs, x: cx + padX, y: cy + 147, fill: PURPLE_SOFT, "font-weight": 400 }, "the market almost froze")
  );
  g.appendChild(panel);
  svg.appendChild(g);

  const alignPopup = (name, isJuly = false) => {
    monthLabel.textContent = name;
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

  annHotspots.forEach((hotspot, i) => {
    hotspot.addEventListener("mouseenter", () => {
      if (!seriesOn.all && !seriesOn.fico) return;
      alignPopup(i === 0 ? "April" : "July", i === 1);
      g.classList.add("is-visible");
      annGuides[i].classList.add("is-visible");
    });
    hotspot.addEventListener("mouseleave", () => {
      g.classList.remove("is-visible");
      annGuides[i].classList.remove("is-visible");
    });
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
  const legendRow1Y = 26;
  const legendRow2Y = 46;
  const l1 = svgEl("text", {
    x: 0,
    y: legendRow1Y,
    fill: PURPLE,
    "font-size": 15,
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
    "font-size": 15,
    "font-family": "Inter, sans-serif",
    "font-weight": "700",
    "dominant-baseline": "central",
  });
  l2.textContent = "FICO <580 (highest-risk)";
  legendFico.appendChild(l2);
  svg.append(legendAll, legendFico);

  root.appendChild(svg);
  alignPopup("April");
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => alignPopup(monthLabel.textContent || "April", monthLabel.textContent === "July"));
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
  bindLegend(legendAll, "all");
  bindLegend(legendFico, "fico");

  animateOnView(root);
}

function drawChart2(root) {
  const w = 944;
  const h = 420;
  const pad = { l: 0, r: 12, t: 56, b: 56 };
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
  const innerL = plotL + 20;
  const innerR = plotR - 20;
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
      x: plotL - 8,
      y: y + 4,
      fill: PURPLE,
      "font-size": 15,
      "font-weight": "500",
      "text-anchor": "end",
      "font-family": "Inter, sans-serif",
      style: "line-height: 15px",
    });
    left.textContent = String(t);
    leftAxisG.appendChild(left);
  });
  [0, 5, 10, 15, 20, 25].forEach((t) => {
    const y = yR(t);
    const right = svgEl("text", {
      x: plotR + 10,
      y: y + 4,
      fill: PINK,
      "font-size": 15,
      "font-weight": "500",
      "font-family": "Inter, sans-serif",
      style: "line-height: 15px",
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

  const annGuides = activeIdx.map((i) => {
    const x = cxAt(i);
    const guide = svgEl("line", {
      class: "ann-guide",
      x1: x,
      x2: x,
      y1: plotT,
      y2: plotB,
      stroke: NAVY,
      "stroke-width": 2,
      "stroke-linecap": "round",
      "stroke-dasharray": "0.01 7",
    });
    svg.appendChild(guide);
    return guide;
  });

  const acceptG = svgEl("g", { class: "series series--accept" });
  const applyG = svgEl("g", { class: "series series--apply" });

  const applyLine = svgEl("polyline", {
    class: "line-draw",
    points: polyline(applyPts),
    stroke: PINK,
    "stroke-width": 2.5,
    pathLength: "1",
  });
  const acceptLine = svgEl("polyline", {
    class: "line-draw",
    points: polyline(acceptPts),
    stroke: PURPLE,
    "stroke-width": 2.5,
    pathLength: "1",
  });
  applyG.appendChild(applyLine);
  acceptG.appendChild(acceptLine);

  applyPts.forEach(([x, y], i) => {
    if (labeledB[i]) return;
    applyG.appendChild(svgEl("circle", { class: "dot", cx: x, cy: y, r: 3, fill: PINK }));
  });
  acceptPts.forEach(([x, y], i) => {
    if (labeledA[i]) return;
    acceptG.appendChild(svgEl("circle", { class: "dot", cx: x, cy: y, r: 3, fill: PURPLE }));
  });

  svg.append(applyG, acceptG);

  const calloutPad = 22;
  let calloutW = 200;
  const g = svgEl("g", { class: "callout-box callout-box--hover" });
  const panel = svgEl("g", { class: "callout-panel" });
  const titleY = calloutPad + 15; // ~22px above 20px caps
  const body1Y = titleY + 24;
  const body2Y = body1Y + 22;
  const lastBaseline = body2Y + 12;
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
      "font-size": 20,
      "font-weight": 600,
      "font-family": "Inter, sans-serif",
      style: "line-height: 20px",
    },
    "Q4 2020"
  );
  const body1 = add(
    {
      x: calloutPad,
      y: body1Y,
      fill: PURPLE,
      "font-size": 12,
      "font-family": "Inter, sans-serif",
      "letter-spacing": "-0.05em",
      style: "line-height: 12px",
    },
    "Second lockdowns across Europe"
  );
  const body2 = svgEl("text", {
    x: calloutPad,
    y: body2Y,
    fill: PURPLE_SOFT,
    "font-size": 12,
    "font-family": "Inter, sans-serif",
    "letter-spacing": "-0.05em",
    style: "line-height: 12px",
  });
  const body2a = svgEl("tspan", { x: calloutPad, dy: 0 });
  body2a.textContent = "A further decline in acceptance";
  const body2b = svgEl("tspan", { x: calloutPad, dy: 12 });
  body2b.textContent = "to 66.4%";
  body2.append(body2a, body2b);
  panel.appendChild(body2);
  g.appendChild(panel);

  const topMarkerHalo = svgEl("circle", {
    class: "ann-guide",
    cx: 0,
    cy: plotT,
    r: 10,
    fill: "#fff",
    filter: "url(#dot-shadow-2)",
  });
  const topMarkerCore = svgEl("circle", {
    class: "ann-guide",
    cx: 0,
    cy: plotT,
    r: 7,
    fill: "#000",
  });
  svg.append(topMarkerHalo, topMarkerCore);

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

  const showCalloutAt = (i) => {
    const x = cxAt(i);
    const [q, year] = quarterLabels[i];
    calloutTitle.textContent = `${q} ${year}`;
    body2b.textContent = `to ${labeledA[i] || `${accept[i]}%`}`;
    layoutCallout();
    const gap = 31;
    const left = x + gap;
    const right = x - calloutW - gap;
    const px = left + calloutW <= plotR ? left : Math.max(plotL, right);
    panel.setAttribute("transform", `translate(${px}, 0)`);
    topMarkerHalo.setAttribute("cx", x);
    topMarkerCore.setAttribute("cx", x);
    topMarkerHalo.classList.add("is-visible");
    topMarkerCore.classList.add("is-visible");
    svg.appendChild(g);
    g.classList.add("is-visible");
  };

  const hideCallout = () => {
    topMarkerHalo.classList.remove("is-visible");
    topMarkerCore.classList.remove("is-visible");
    g.classList.remove("is-visible");
  };

  const seriesOn = { accept: true, apply: true };

  activeIdx.forEach((i, gi) => {
    const hotspot = svgEl("g", { class: "ann-hotspot" });
    const pts = [];
    if (labeledA[i]) {
      const [x, y] = acceptPts[i];
      pts.push([x, y]);
      acceptG.appendChild(
        svgEl("circle", { cx: x, cy: y, r: 8, fill: "#fff", filter: "url(#dot-shadow-2)" })
      );
      acceptG.appendChild(svgEl("circle", { cx: x, cy: y, r: 6, fill: PURPLE }));
      const t = svgEl("text", {
        x,
        y: y - 18,
        fill: PURPLE,
        "font-size": 20,
        "font-weight": 900,
        "font-family": '"PP Monument Extended", sans-serif',
        "text-anchor": "middle",
        style: "line-height: 20px",
      });
      t.textContent = labeledA[i];
      acceptG.appendChild(t);
    }
    if (labeledB[i]) {
      const [x, y] = applyPts[i];
      pts.push([x, y]);
      applyG.appendChild(
        svgEl("circle", { cx: x, cy: y, r: 8, fill: "#fff", filter: "url(#dot-shadow-2)" })
      );
      applyG.appendChild(svgEl("circle", { cx: x, cy: y, r: 6, fill: PINK }));
      const t = svgEl("text", {
        x: i === 2 ? x - 14 : i === 9 ? x + 19 : i === 11 ? x + 23 : x,
        y: i === 2 ? y + 7 : y + 32,
        fill: PINK,
        "font-size": 20,
        "font-weight": 900,
        "font-family": '"PP Monument Extended", sans-serif',
        "text-anchor": i === 2 ? "end" : "middle",
        style: "line-height: 20px",
      });
      t.textContent = labeledB[i];
      applyG.appendChild(t);
    }
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const hitTop = labeledA[i] ? minY - 28 : minY - 12;
    const hitBottom = labeledB[i] && i !== 2 ? maxY + 36 : maxY + 12;
    const hitLeft = i === 2 && labeledB[i] ? minX - 56 : minX - 18;
    const hitRight = (i === 9 || i === 11) && labeledB[i] ? maxX + 50 : maxX + 18;
    hotspot.appendChild(
      svgEl("rect", {
        x: hitLeft,
        y: hitTop,
        width: hitRight - hitLeft,
        height: hitBottom - hitTop,
        fill: "transparent",
      })
    );
    svg.appendChild(hotspot);
    hotspot.addEventListener("mouseenter", () => {
      const hasAccept = seriesOn.accept && labeledA[i];
      const hasApply = seriesOn.apply && labeledB[i];
      if (!hasAccept && !hasApply) return;
      annGuides[gi].classList.add("is-visible");
      if (hasAccept) {
        showCalloutAt(i);
      } else {
        const x = cxAt(i);
        topMarkerHalo.setAttribute("cx", x);
        topMarkerCore.setAttribute("cx", x);
        topMarkerHalo.classList.add("is-visible");
        topMarkerCore.classList.add("is-visible");
      }
    });
    hotspot.addEventListener("mouseleave", () => {
      annGuides[gi].classList.remove("is-visible");
      hideCallout();
    });
  });

  const axisX = "#414d97";

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
  labels.forEach(([q, y], i) => {
    const x = cxAt(i);
    svg.appendChild(svgEl("circle", { cx: x, cy: plotB, r: 3, fill: axisX }));
    const a = svgEl("text", {
      x,
      y: plotB + 20,
      fill: axisX,
      "font-size": 15,
      "font-weight": "500",
      "text-anchor": "middle",
      "font-family": "Inter, sans-serif",
      style: "line-height: 15px",
    });
    a.textContent = q;
    const b = svgEl("text", {
      x,
      y: plotB + 34,
      fill: axisX,
      "font-size": 15,
      "font-weight": "500",
      "text-anchor": "middle",
      "font-family": "Inter, sans-serif",
      style: "line-height: 15px",
    });
    b.textContent = y;
    svg.append(a, b);
  });

  const legendCy = 18;
  const leftYLabelRight = plotL - 8;
  const rightYLabelLeft = plotR + 10;
  const legendDotR = 8;
  const legendLCx = leftYLabelRight - legendDotR;
  const legendRCx = rightYLabelLeft + legendDotR;

  const legendAccept = svgEl("g", {
    class: "chart-legend chart-legend--accept",
    role: "button",
    tabindex: "0",
    "aria-pressed": "true",
  });
  legendAccept.appendChild(
    svgEl("circle", { cx: legendLCx, cy: legendCy, r: 8, fill: "#fff", filter: "url(#dot-shadow-2)" })
  );
  const legendAcceptCore = svgEl("circle", {
    class: "chart-legend__core",
    cx: legendLCx,
    cy: legendCy,
    r: 6,
    fill: PURPLE,
  });
  legendAccept.appendChild(legendAcceptCore);
  const la = svgEl("text", {
    x: plotL,
    y: 22,
    fill: PURPLE,
    "font-size": 13,
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

  const legendApply = svgEl("g", {
    class: "chart-legend chart-legend--apply",
    role: "button",
    tabindex: "0",
    "aria-pressed": "true",
  });
  const lb = svgEl("text", {
    x: plotR,
    y: 22,
    fill: PINK,
    "font-size": 13,
    "font-weight": "700",
    "text-anchor": "end",
    "font-family": "Inter, sans-serif",
  });
  lb.textContent = "Credit application rate (%)";
  legendApply.appendChild(lb);
  legendApply.appendChild(
    svgEl("circle", { cx: legendRCx, cy: legendCy, r: 8, fill: "#fff", filter: "url(#dot-shadow-2)" })
  );
  const legendApplyCore = svgEl("circle", {
    class: "chart-legend__core",
    cx: legendRCx,
    cy: legendCy,
    r: 6,
    fill: PINK,
  });
  legendApply.appendChild(legendApplyCore);
  legendApply.appendChild(
    svgEl("rect", {
      x: plotR - 220,
      y: 4,
      width: legendRCx - (plotR - 220) + 10,
      height: 28,
      fill: "transparent",
    })
  );

  const setSeriesVisible = (key, on) => {
    seriesOn[key] = on;
    const layer = key === "accept" ? acceptG : applyG;
    const axis = key === "accept" ? leftAxisG : rightAxisG;
    const legend = key === "accept" ? legendAccept : legendApply;
    layer.classList.toggle("is-off", !on);
    axis.classList.toggle("is-off", !on);
    legend.classList.toggle("is-off", !on);
    legend.setAttribute("aria-pressed", on ? "true" : "false");
    if (!on) hideCallout();
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

  svg.append(legendAccept, legendApply);
  svg.appendChild(g);
  root.appendChild(svg);
  animateOnView(root);
}

drawChart1(document.getElementById("chart-1"));
drawChart2(document.getElementById("chart-2"));
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

  const POPUP_OFFSET_PCT = 41.17; // distance from point center to popup top (design)

  const shiftPct = () => {
    const stage = root.querySelector(".graphic-3-stage");
    const shiftPx = parseFloat(getComputedStyle(root).getPropertyValue("--g3-shift")) || 0;
    const h = stage?.clientHeight || 1;
    return (shiftPx / h) * 100;
  };

  let showTimer = 0;

  const placeAt = (hotspot) => {
    const stage = root.querySelector(".graphic-3-stage");
    const key = hotspot.dataset.key;
    const copy = popups[key] || defaultCopy;
    titleEl.innerHTML = copy.titleHtml;
    subtitleEl.textContent = copy.subtitle;
    bodyEl.textContent = copy.body;

    const x = Number(hotspot.dataset.x);
    const y = Number(hotspot.dataset.y) + shiftPct();
    shock.style.left = `${x}%`;
    line.style.left = `${x}%`;

    const shockTop = Math.max(2, y - POPUP_OFFSET_PCT);
    shock.style.top = `${shockTop}%`;

    // Line from point up to the popup's bottom edge
    void shock.offsetHeight;
    const stageH = stage.clientHeight || 1;
    const popupBottomPx = (shockTop / 100) * stageH + shock.offsetHeight;
    const pointYPx = (y / 100) * stageH;
    const lineH = Math.max(0, pointYPx - popupBottomPx);
    line.style.top = `${(popupBottomPx / stageH) * 100}%`;
    line.style.height = `${(lineH / stageH) * 100}%`;
  };

  const show = (hotspot) => {
    clearTimeout(showTimer);
    const restart = line.classList.contains("is-visible");
    if (restart) {
      shock.classList.remove("is-visible");
      line.classList.remove("is-visible");
      void line.offsetWidth;
    }
    placeAt(hotspot);
    shock.hidden = false;
    line.classList.add("is-visible");
    showTimer = window.setTimeout(() => {
      shock.classList.add("is-visible");
    }, restart ? 40 : 0);
  };

  const hide = () => {
    clearTimeout(showTimer);
    shock.classList.remove("is-visible");
    line.classList.remove("is-visible");
  };

  hotspots.forEach((hotspot) => {
    hotspot.addEventListener("mouseenter", () => show(hotspot));
    hotspot.addEventListener("mouseleave", hide);
    hotspot.addEventListener("focus", () => show(hotspot));
    hotspot.addEventListener("blur", hide);
    hotspot.setAttribute("tabindex", "0");
    hotspot.setAttribute("role", "button");
  });
}
