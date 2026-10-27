const { catalog, languages, model, generateDrawingCode } = window.ShapeStudio;

let currentShape = "heart";
let currentLanguage = "python";
let currentColor = "#6258d9";
let brushWidth = 4;
let activeTool = "brush";
let drawingStyle = "outline";
let canvasZoom = 1;
let showPreset = true;
let paintPaths = [];
let presetFillOverrides = {};
let undoStack = [];
let pointerAction = null;
let copyTimer;
let codeUpdateTimer;
let persistTimer;

const codeOutput = document.querySelector("#code-output");
const lineNumbers = document.querySelector("#line-numbers");
const previewSvg = document.querySelector("#preview-svg");
const shapeGrid = document.querySelector("#shape-grid");
const shapeSearch = document.querySelector("#shape-search");
const noShapes = document.querySelector("#no-shapes");
const colorPalette = document.querySelector("#color-palette");
const customColorInput = document.querySelector("#custom-color");
const brushSizeInput = document.querySelector("#brush-size");
const drawingStyleInput = document.querySelector("#drawing-style");
const undoButton = document.querySelector("#undo-drawing");
const themeColor = document.querySelector('meta[name="theme-color"]');
const codeFeedback = document.querySelector("#copy-feedback");
let paletteColors = [];
let paletteActiveIndex = 0;
let paintLayer;

function safeStorageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function restoreDrawing() {
  const raw = safeStorageGet("shapescript-drawing-v2");
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    if (!saved || saved.version !== 2) return;
    if (catalog.some(shape => shape.id === saved.currentShape)) currentShape = saved.currentShape;
    if (Object.hasOwn(languages, saved.currentLanguage)) currentLanguage = saved.currentLanguage;
    if (/^#[\da-f]{6}$/i.test(saved.currentColor ?? "")) currentColor = saved.currentColor.toLowerCase();
    if (Number.isFinite(saved.brushWidth)) brushWidth = Math.max(1, Math.min(24, saved.brushWidth));
    if (["brush", "line", "rectangle", "ellipse", "fill", "eraser"].includes(saved.activeTool)) activeTool = saved.activeTool;
    if (["outline", "fill-outline", "fill-only"].includes(saved.drawingStyle)) drawingStyle = saved.drawingStyle;
    if (Number.isFinite(saved.canvasZoom)) canvasZoom = Math.max(.5, Math.min(2.5, saved.canvasZoom));
    showPreset = saved.showPreset !== false;
    if (Array.isArray(saved.paintPaths)) paintPaths = saved.paintPaths.slice(0, 250).map(cleanPath).filter(Boolean);
    if (saved.presetFillOverrides && typeof saved.presetFillOverrides === "object") {
      for (const [shapeId, overrides] of Object.entries(saved.presetFillOverrides)) {
        if (!catalog.some(shape => shape.id === shapeId) || !overrides || typeof overrides !== "object") continue;
        presetFillOverrides[shapeId] = {};
        for (const [index, override] of Object.entries(overrides)) {
          if (!/^\d+$/.test(index) || !override || typeof override !== "object") continue;
          const safe = { fill: Boolean(override.fill), stroke: override.stroke !== false };
          if (/^#[\da-f]{6}$/i.test(override.color ?? "")) safe.color = override.color.toLowerCase();
          presetFillOverrides[shapeId][index] = safe;
        }
      }
    }
  } catch {
    // Ignore incomplete or older browser saves.
  }
}

function cleanPath(path) {
  if (!path || !Array.isArray(path.points) || path.points.length < 2 || path.points.length > 800) return null;
  const points = path.points.filter(point => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 500 && Math.abs(point[1]) <= 500).map(([x, y]) => [x, y]);
  if (points.length < 2) return null;
  return {
    points, closed: Boolean(path.closed), fill: Boolean(path.fill), stroke: path.stroke !== false,
    color: /^#[\da-f]{6}$/i.test(path.color ?? "") ? path.color.toLowerCase() : currentColor,
    width: Number.isFinite(path.width) ? Math.max(1, Math.min(24, path.width)) : 4,
  };
}

function persistDrawing() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      localStorage.setItem("shapescript-drawing-v2", JSON.stringify({
        version: 2, currentShape, currentLanguage, currentColor, brushWidth, activeTool, drawingStyle, canvasZoom,
        showPreset, paintPaths, presetFillOverrides,
      }));
    } catch {
      codeFeedback.textContent = "BROWSER STORAGE FULL";
    }
  }, 220);
}

function renderShapeChoices(filter = shapeSearch.value) {
  const query = filter.trim().toLocaleLowerCase();
  const matchingShapes = catalog.filter(shape => `${shape.label} ${shape.id}`.toLocaleLowerCase().includes(query));
  shapeGrid.replaceChildren();

  for (const shape of matchingShapes) {
    const button = document.createElement("button");
    const selected = showPreset && shape.id === currentShape;
    button.type = "button";
    button.className = `shape-choice${selected ? " is-selected" : ""}`;
    button.dataset.shape = shape.id;
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute("aria-label", `Draw ${shape.label}`);
    button.title = shape.label;

    const glyph = document.createElement("span");
    glyph.className = "shape-glyph";
    glyph.setAttribute("aria-hidden", "true");
    glyph.textContent = shape.glyph;
    const label = document.createElement("span");
    label.textContent = shape.label;
    button.append(glyph, label);
    button.addEventListener("click", () => {
      currentShape = shape.id;
      showPreset = true;
      paintPaths = [];
      undoStack = [];
      renderShapeChoices();
      render();
    });
    shapeGrid.append(button);
  }

  noShapes.hidden = matchingShapes.length > 0;
}

function highlightCode(source) {
  const escaped = source.replace(/[&<>]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character]);
  const tokens = /(\/\/[^\n]*|#include\b[^\n]*|#(?!include\b)[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:import|from|as|def|for|in|range|True|False|if|else|elif|while|class|public|private|protected|static|void|new|return|const|let|var|function|int|double|float|bool|final|extends|override|include|using|namespace)\b|\b\d+(?:\.\d+)?\b)/g;
  return escaped.replace(tokens, token => {
    let category = "number";
    if (token.startsWith("//") || (token.startsWith("#") && !token.startsWith("#include"))) category = "comment";
    else if (token.startsWith("\"") || token.startsWith("'")) category = "string";
    else if (/^[a-zA-Z]/.test(token)) category = "keyword";
    return `<span class="code-token ${category}">${token}</span>`;
  });
}

function hslToHex(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const secondary = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const offset = l - chroma / 2;
  let rgb;
  if (hue < 60) rgb = [chroma, secondary, 0];
  else if (hue < 120) rgb = [secondary, chroma, 0];
  else if (hue < 180) rgb = [0, chroma, secondary];
  else if (hue < 240) rgb = [0, secondary, chroma];
  else if (hue < 300) rgb = [secondary, 0, chroma];
  else rgb = [chroma, 0, secondary];
  return `#${rgb.map(channel => Math.round((channel + offset) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function buildColorPalette() {
  const featured = [
    ["Violet", "#6258d9"], ["Coral", "#ed6a5a"], ["Green", "#218a72"], ["Blue", "#3573c8"],
    ["Gold", "#d69a35"], ["Pink", "#ec4899"], ["Rose", "#f43f5e"], ["Purple", "#a855f7"],
    ["Teal", "#14b8a6"], ["Charcoal", "#111827"],
  ].map(([name, color]) => ({ name, color }));
  const grayscale = Array.from({ length: 10 }, (_, index) => {
    const level = Math.round(255 - (index * 235) / 9).toString(16).padStart(2, "0");
    return { name: "Neutral", color: `#${level}${level}${level}` };
  });
  const families = [
    ["Red", 0], ["Orange", 24], ["Amber", 38], ["Yellow", 52], ["Lime", 82], ["Green", 130],
    ["Teal", 165], ["Cyan", 190], ["Sky", 210], ["Blue", 225], ["Indigo", 245], ["Violet", 265],
    ["Magenta", 300], ["Pink", 330],
  ];
  const shades = [96, 89, 82, 75, 68, 61, 54, 47, 40, 30];
  const spectrum = families.flatMap(([name, hue]) => shades.map((lightness, shadeIndex) => ({
    name: `${name} shade ${shadeIndex + 1}`,
    color: hslToHex(hue, 84, lightness),
  })));
  paletteColors = [...featured, ...grayscale, ...spectrum];

  colorPalette.replaceChildren(...paletteColors.map(({ name, color }, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "color-swatch";
    button.dataset.color = color;
    button.dataset.colorIndex = String(index);
    button.setAttribute("aria-label", `${name}, ${color.toUpperCase()}`);
    button.setAttribute("aria-pressed", String(color === currentColor));
    button.title = `${name} · ${color.toUpperCase()}`;
    button.tabIndex = index === paletteActiveIndex ? 0 : -1;
    button.style.setProperty("--swatch-color", color);
    return button;
  }));
}

function setInkColor(color, selectedIndex = null) {
  currentColor = color.toLowerCase();
  if (Number.isInteger(selectedIndex)) paletteActiveIndex = selectedIndex;

  document.querySelectorAll(".color-swatch").forEach((button, index) => {
    const selected = button.dataset.color === currentColor;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.tabIndex = index === paletteActiveIndex ? 0 : -1;
  });
  document.querySelector("#selected-color-chip").style.setProperty("--selected-color", currentColor);
  document.querySelector("#color-value").textContent = currentColor.toUpperCase();
  customColorInput.value = currentColor;
  render();
}

function render(deferCode = false) {
  const diagram = catalog.find(shape => shape.id === currentShape) ?? catalog[0];
  const language = languages[currentLanguage];
  const presetPaths = showPreset
    ? model(currentShape).map((path, index) => {
      const override = presetFillOverrides[currentShape]?.[index] ?? {};
      return { ...path, ...override, color: override.color ?? currentColor, width: 4, stroke: override.stroke ?? true };
    })
    : [];
  const paths = [...presetPaths, ...paintPaths];
  const markup = paths.map(path => {
    const points = path.points.map(([x, y]) => `${x},${y}`).join(" ");
    const tag = path.closed ? "polygon" : "polyline";
    const fill = path.fill ? (path.fillColor ?? path.color) : "none";
    const fillOpacity = path.fill ? (path.fillOpacity ?? ".14") : "0";
    return `<${tag} points="${points}" stroke="${path.stroke === false ? "none" : path.color}" stroke-width="${path.width}" stroke-linecap="round" stroke-linejoin="round" fill="${fill}" fill-opacity="${fillOpacity}"/>`;
  }).join("");
  previewSvg.innerHTML = `<rect class="paint-hit-area" x="0" y="0" width="500" height="320" fill="transparent" pointer-events="all"/><g id="drawing-layer" transform="translate(250 160) scale(${canvasZoom})">${markup}</g>`;
  paintLayer = previewSvg.querySelector("#drawing-layer");
  previewSvg.setAttribute("aria-label", showPreset ? `${diagram.label} diagram and drawing canvas` : "Blank drawing canvas");
  document.querySelector("#preview-title").textContent = showPreset ? diagram.label : "Custom drawing";
  document.querySelector("#stage-shape-label").textContent = showPreset ? `THE ${diagram.label.toLocaleUpperCase()}` : "YOUR DRAWING";
  document.querySelector("#code-title").textContent = language.file;
  document.querySelector("#code-subtitle").textContent = language.label;
  document.querySelector("#runtime-note").textContent = language.note;
  document.querySelector("#drawing-stage").style.setProperty("--draw-color", currentColor);
  const updateCode = () => {
    const code = generateDrawingCode(paths, currentLanguage, currentColor);
    codeOutput.innerHTML = highlightCode(code);
    lineNumbers.textContent = Array.from({ length: code.split("\n").length }, (_, index) => index + 1).join("\n");
  };
  clearTimeout(codeUpdateTimer);
  if (deferCode) codeUpdateTimer = setTimeout(updateCode, 85);
  else updateCode();
  if (!codeOutput.matches(":focus")) codeFeedback.textContent = "";
  document.querySelector("#brush-size-value").textContent = `${brushWidth} px`;
  brushSizeInput.value = String(brushWidth);
  drawingStyleInput.value = drawingStyle;
  document.querySelector("#zoom-value").textContent = `${Math.round(canvasZoom * 100)}%`;
  undoButton.disabled = undoStack.length === 0;
  persistDrawing();
}

function setTheme(theme) {
  const selectedTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = selectedTheme;
  themeColor.content = selectedTheme === "dark" ? "#0f141d" : "#f6f7fb";
  document.querySelectorAll("[data-theme-choice]").forEach(button => {
    const selected = button.dataset.themeChoice === selectedTheme;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  try {
    localStorage.setItem("shapescript-theme", selectedTheme);
  } catch {
    // The theme still changes for this page view when browser storage is unavailable.
  }
}

function drawingSnapshot() {
  return {
    showPreset,
    paintPaths: paintPaths.map(path => ({ ...path, points: path.points.map(point => [...point]) })),
    presetFillOverrides: JSON.parse(JSON.stringify(presetFillOverrides)),
  };
}

function saveDrawingUndo(snapshot = drawingSnapshot()) {
  undoStack.push(snapshot);
  if (undoStack.length > 40) undoStack.shift();
}

function makeShapePath(tool, start, end) {
  const style = { color: currentColor, width: brushWidth, fill: false, stroke: true };
  if (tool === "line") return { ...style, points: [start, end], closed: false };
  const shapeStyle = drawingStyle === "outline"
    ? { fill: false, stroke: true }
    : drawingStyle === "fill-only" ? { fill: true, stroke: false } : { fill: true, stroke: true };
  if (tool === "rectangle") {
    return { ...style, ...shapeStyle, points: [start, [end[0], start[1]], end, [start[0], end[1]]], closed: true };
  }
  const centerX = (start[0] + end[0]) / 2;
  const centerY = (start[1] + end[1]) / 2;
  const radiusX = Math.abs(end[0] - start[0]) / 2;
  const radiusY = Math.abs(end[1] - start[1]) / 2;
  const points = Array.from({ length: 49 }, (_, index) => {
    const angle = Math.PI * 2 * index / 48;
    return [centerX + Math.cos(angle) * radiusX, centerY + Math.sin(angle) * radiusY];
  });
  return { ...style, ...shapeStyle, points, closed: true };
}

function pointOnCanvas(event) {
  const pointer = previewSvg.createSVGPoint();
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  const local = pointer.matrixTransform(paintLayer.getScreenCTM().inverse());
  const x = Math.max(-250, Math.min(250, local.x));
  const y = Math.max(-160, Math.min(160, local.y));
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

function pointInPolygon(point, points) {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const [x, y] = points[index];
    const [priorX, priorY] = points[previous];
    const crosses = (y > point[1]) !== (priorY > point[1]) && point[0] < ((priorX - x) * (point[1] - y)) / (priorY - y) + x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function fillAt(point) {
  for (let index = paintPaths.length - 1; index >= 0; index -= 1) {
    const path = paintPaths[index];
    if (path.closed && pointInPolygon(point, path.points)) {
      paintPaths[index] = { ...path, fill: true, stroke: true, color: currentColor };
      return true;
    }
  }
  if (!showPreset) return false;
  const paths = model(currentShape);
  for (let index = paths.length - 1; index >= 0; index -= 1) {
    if (!paths[index].closed || !pointInPolygon(point, paths[index].points)) continue;
    presetFillOverrides[currentShape] ??= {};
    presetFillOverrides[currentShape][index] = { fill: true, stroke: true, color: currentColor };
    return true;
  }
  return false;
}

function setZoom(value) {
  canvasZoom = Math.max(.5, Math.min(2.5, Math.round(value * 10) / 10));
  render();
}

function extractBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "\"" || character === "'") { quote = character; continue; }
    if (character === open) depth += 1;
    if (character === close && --depth === 0) return source.slice(start + 1, index);
  }
  return null;
}

function splitTopLevel(source) {
  const parts = [];
  let start = 0;
  let stack = [];
  let quote = "";
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "\"" || character === "'") { quote = character; continue; }
    if (character === "[" || character === "{" || character === "(") stack.push(character);
    else if (character === "]" || character === "}" || character === ")") stack.pop();
    else if (character === "," && stack.length === 0) {
      if (source.slice(start, index).trim()) parts.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  if (source.slice(start).trim()) parts.push(source.slice(start).trim());
  return parts;
}

function pairsFrom(block, delimiter = "square") {
  const pattern = delimiter === "tuple"
    ? /\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g
    : delimiter === "brace"
      ? /\{\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\}/g
      : /\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/g;
  return Array.from(block.matchAll(pattern), match => [Number(match[1]), Number(match[2])]);
}

function parseBooleanList(source, name) {
  const match = source.match(new RegExp(`${name}\\s*=\\s*\\{([^}]*)\\}`));
  return match ? match[1].split(",").map(value => value.trim() === "true" || value.trim() === "True") : [];
}

function parseCodePaths(source, language) {
  const paths = [];
  if (language === "python") {
    const start = source.indexOf("paths = [");
    const open = source.indexOf("[", start);
    const body = extractBalanced(source, open, "[", "]");
    if (body === null) throw new Error("Could not find the paths list.");
    for (const item of splitTopLevel(body)) {
      const listStart = item.indexOf("[");
      const pointsBody = extractBalanced(item, listStart, "[", "]");
      if (pointsBody === null) throw new Error("A path has invalid point data.");
      const rest = item.slice(listStart + pointsBody.length + 2);
      const style = rest.match(/^\s*,\s*(True|False)\s*,\s*(True|False)\s*,\s*(True|False)\s*,\s*["'](#[\da-f]{6})["']\s*,\s*(\d+(?:\.\d+)?)/i);
      const points = pairsFrom(pointsBody, "tuple");
      if (!style || points.length < 2) throw new Error("Use the points and style fields in the paths list.");
      paths.push({ points, closed: /^true$/i.test(style[1]), fill: /^true$/i.test(style[2]), stroke: /^true$/i.test(style[3]), color: style[4], width: Number(style[5]) });
    }
  } else if (language === "javascript") {
    const start = source.indexOf("const paths = [");
    const open = source.indexOf("[", start);
    const body = extractBalanced(source, open, "[", "]");
    if (body === null) throw new Error("Could not find the paths list.");
    for (const item of splitTopLevel(body)) {
      const pointsMatch = item.match(/points\s*:\s*\[/);
      if (!pointsMatch) throw new Error("A path is missing its points list.");
      const openPoints = item.indexOf("[", pointsMatch.index);
      const pointBody = extractBalanced(item, openPoints, "[", "]");
      const points = pairsFrom(pointBody ?? "");
      const color = item.match(/color\s*:\s*["'](#[\da-f]{6})["']/i)?.[1];
      const width = item.match(/width\s*:\s*(\d+(?:\.\d+)?)/)?.[1];
      if (points.length < 2 || !color || !width) throw new Error("Check each path's points, color, and width.");
      paths.push({ points, closed: /closed\s*:\s*true/i.test(item), fill: /fill\s*:\s*true/i.test(item), stroke: !/stroke\s*:\s*false/i.test(item), color, width: Number(width) });
    }
  } else {
    let body;
    let delimiter;
    if (language === "java") {
      const start = source.indexOf("POINTS =");
      const open = source.indexOf("{", start);
      body = extractBalanced(source, open, "{", "}");
      delimiter = "brace";
    } else {
      const start = source.indexOf("paths = {");
      const open = source.indexOf("{", start);
      body = extractBalanced(source, open, "{", "}");
      delimiter = "brace";
    }
    if (body === null) throw new Error("Could not find the drawing paths.");
    const closed = parseBooleanList(source, language === "java" ? "CLOSED" : "closed");
    const filled = parseBooleanList(source, language === "java" ? "FILLED" : "filled");
    const stroked = parseBooleanList(source, language === "java" ? "STROKED" : "stroked");
    const colorMatch = language === "java"
      ? [...source.matchAll(/new Color\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g)]
      : [...source.matchAll(/sf::Color\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g)];
    const colors = colorMatch.map(match => `#${match.slice(1, 4).map(value => Number(value).toString(16).padStart(2, "0")).join("")}`);
    const widthMatch = language === "java" ? source.match(/WIDTHS\s*=\s*\{([^}]*)\}/) : source.match(/widths\s*=\s*\{([^}]*)\}/);
    const widths = widthMatch ? widthMatch[1].split(",").map(value => Number.parseFloat(value)) : [];
    let groups;
    if (language === "java") {
      groups = [];
      const groupPattern = /new\s+double\[\]\[\]\s*\{/g;
      let groupMatch;
      while ((groupMatch = groupPattern.exec(body))) {
        const groupStart = body.indexOf("{", groupMatch.index);
        const group = extractBalanced(body, groupStart, "{", "}");
        if (group === null) throw new Error("A Java path has invalid point data.");
        groups.push(group);
        groupPattern.lastIndex = groupStart + group.length + 2;
      }
    } else {
      groups = splitTopLevel(body).map(item => {
        const groupStart = item.indexOf("{");
        return groupStart >= 0 ? extractBalanced(item, groupStart, "{", "}") ?? "" : "";
      });
    }
    groups.forEach((group, index) => {
      const points = pairsFrom(group, delimiter);
      if (points.length < 2) return;
      paths.push({ points, closed: Boolean(closed[index]), fill: Boolean(filled[index]), stroke: stroked[index] !== false, color: colors[index] ?? currentColor, width: widths[index] || 4 });
    });
  }
  if (!paths.length || paths.length > 250 || paths.some(path => path.points.length > 800)) throw new Error("The code needs 1–250 paths, each with at least two points.");
  const cleaned = paths.map(cleanPath);
  if (cleaned.some(path => !path)) throw new Error("Points must stay within the canvas area.");
  return cleaned;
}

function applyEditedCode() {
  try {
    const paths = parseCodePaths(codeOutput.innerText, currentLanguage);
    saveDrawingUndo();
    showPreset = false;
    paintPaths = paths;
    presetFillOverrides = {};
    renderShapeChoices();
    render();
    codeFeedback.textContent = "CANVAS UPDATED";
  } catch (error) {
    codeFeedback.textContent = error.message;
  }
}

function distanceToSegment(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  const amount = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared));
  const x = start[0] + amount * dx;
  const y = start[1] + amount * dy;
  return Math.hypot(point[0] - x, point[1] - y);
}

function eraseAt(point) {
  const radius = Math.max(brushWidth * 1.5, 7);
  let changed = false;
  const remaining = [];
  for (const path of paintPaths) {
    if (path.points.length < 2) {
      if (Math.hypot(point[0] - path.points[0][0], point[1] - path.points[0][1]) <= radius) changed = true;
      else remaining.push(path);
      continue;
    }
    const segmentCount = path.points.length - 1 + (path.closed ? 1 : 0);
    const parts = [];
    let part = [];
    let pathChanged = false;
    for (let index = 0; index < segmentCount; index += 1) {
      const start = path.points[index];
      const end = path.points[(index + 1) % path.points.length];
      if (distanceToSegment(point, start, end) <= radius) {
        pathChanged = true;
        if (part.length > 1) parts.push(part);
        part = [];
      } else {
        if (part.length === 0) part.push(start);
        part.push(end);
      }
    }
    if (part.length > 1) parts.push(part);
    if (!pathChanged) remaining.push(path);
    else {
      changed = true;
      remaining.push(...parts.map(points => ({ ...path, points, closed: false, fill: false })));
    }
  }
  if (changed) paintPaths = remaining;
  return changed;
}

function setPaintTool(tool) {
  activeTool = tool;
  document.querySelectorAll("[data-tool]").forEach(button => {
    const selected = button.dataset.tool === activeTool;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  previewSvg.style.cursor = activeTool === "eraser" ? "cell" : "crosshair";
  persistDrawing();
}

previewSvg.addEventListener("pointerdown", event => {
  if (event.button !== 0) return;
  event.preventDefault();
  const point = pointOnCanvas(event);
  previewSvg.setPointerCapture(event.pointerId);
  const before = drawingSnapshot();
  if (activeTool === "fill") {
    if (fillAt(point)) {
      saveDrawingUndo(before);
      render();
    }
    return;
  }
  pointerAction = { id: event.pointerId, tool: activeTool, start: point, pathIndex: -1, undoState: before, savedUndo: false };
  if (activeTool === "eraser") {
    if (eraseAt(point)) {
      saveDrawingUndo(before);
      pointerAction.savedUndo = true;
    }
  } else if (activeTool === "brush") {
    saveDrawingUndo(before);
    pointerAction.savedUndo = true;
    pointerAction.pathIndex = paintPaths.length;
    paintPaths.push({ points: [point, point], closed: false, fill: false, color: currentColor, width: brushWidth });
  } else {
    saveDrawingUndo(before);
    pointerAction.savedUndo = true;
    pointerAction.pathIndex = paintPaths.length;
    paintPaths.push(makeShapePath(activeTool, point, point));
  }
  render();
});

previewSvg.addEventListener("pointermove", event => {
  if (!pointerAction || pointerAction.id !== event.pointerId) return;
  event.preventDefault();
  const point = pointOnCanvas(event);
  if (pointerAction.tool === "eraser") {
    if (eraseAt(point) && !pointerAction.savedUndo) {
      saveDrawingUndo(pointerAction.undoState);
      pointerAction.savedUndo = true;
    }
  }
  else if (pointerAction.tool === "brush") {
    const path = paintPaths[pointerAction.pathIndex];
    const previous = path.points[path.points.length - 1];
    if (Math.hypot(point[0] - previous[0], point[1] - previous[1]) >= 1.2 && path.points.length < 520) path.points.push(point);
  } else {
    paintPaths[pointerAction.pathIndex] = makeShapePath(pointerAction.tool, pointerAction.start, point);
  }
  render(true);
});

function finishPaintAction(event) {
  if (!pointerAction || pointerAction.id !== event.pointerId) return;
  if (pointerAction.tool === "brush") {
    const path = paintPaths[pointerAction.pathIndex];
    if (path && path.points.length === 2 && path.points[0][0] === path.points[1][0] && path.points[0][1] === path.points[1][1]) {
      path.points[1] = [path.points[0][0] + 0.1, path.points[0][1] + 0.1];
    }
  }
  pointerAction = null;
  render();
}

previewSvg.addEventListener("pointerup", finishPaintAction);
previewSvg.addEventListener("pointercancel", finishPaintAction);
document.querySelectorAll("[data-tool]").forEach(button => button.addEventListener("click", () => setPaintTool(button.dataset.tool)));
brushSizeInput.addEventListener("input", event => {
  brushWidth = Number(event.target.value);
  render();
});
drawingStyleInput.addEventListener("change", event => {
  drawingStyle = event.target.value;
  persistDrawing();
});
undoButton.addEventListener("click", () => {
  const previous = undoStack.pop();
  if (!previous) return;
  showPreset = previous.showPreset;
  paintPaths = previous.paintPaths;
  presetFillOverrides = previous.presetFillOverrides;
  renderShapeChoices();
  render();
});
document.querySelector("#clear-drawing").addEventListener("click", () => {
  saveDrawingUndo();
  showPreset = false;
  paintPaths = [];
  presetFillOverrides = {};
  renderShapeChoices();
  render();
});

shapeSearch.addEventListener("input", () => renderShapeChoices());
document.querySelector("#language-select").addEventListener("change", event => {
  currentLanguage = event.target.value;
  render();
});
document.querySelector("#zoom-out").addEventListener("click", () => setZoom(canvasZoom - .1));
document.querySelector("#zoom-in").addEventListener("click", () => setZoom(canvasZoom + .1));
document.querySelector("#zoom-reset").addEventListener("click", () => setZoom(1));

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function drawingSvg() {
  const clone = previewSvg.cloneNode(true);
  clone.removeAttribute("id");
  clone.setAttribute("width", "1500");
  clone.setAttribute("height", "960");
  clone.querySelector(".paint-hit-area")?.remove();
  return new XMLSerializer().serializeToString(clone);
}

document.querySelector("#export-svg").addEventListener("click", () => {
  downloadBlob(new Blob([drawingSvg()], { type: "image/svg+xml;charset=utf-8" }), "shapescript-drawing.svg");
});
document.querySelector("#export-png").addEventListener("click", () => {
  const source = drawingSvg();
  const image = new Image();
  const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1500;
    canvas.height = 960;
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (blob) downloadBlob(blob, "shapescript-drawing.png");
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    codeFeedback.textContent = "PNG EXPORT FAILED";
  };
  image.src = url;
});

document.querySelector("#apply-code").addEventListener("click", applyEditedCode);
codeOutput.addEventListener("input", () => {
  codeFeedback.textContent = "EDITED CODE · APPLY TO UPDATE CANVAS";
  lineNumbers.textContent = Array.from({ length: Math.max(1, codeOutput.innerText.split("\n").length) }, (_, index) => index + 1).join("\n");
});
codeOutput.addEventListener("keydown", event => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    applyEditedCode();
  }
});

document.addEventListener("keydown", event => {
  const target = event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName))) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undoButton.click();
    return;
  }
  const key = event.key.toLowerCase();
  if (key === "+" || key === "=") setZoom(canvasZoom + .1);
  else if (key === "-") setZoom(canvasZoom - .1);
  else if (key === "0") setZoom(1);
  else if (key === "b") setPaintTool("brush");
  else if (key === "l") setPaintTool("line");
  else if (key === "r") setPaintTool("rectangle");
  else if (key === "o") setPaintTool("ellipse");
  else if (key === "f") setPaintTool("fill");
  else if (key === "e") setPaintTool("eraser");
});

colorPalette.addEventListener("click", event => {
  const swatch = event.target.closest(".color-swatch");
  if (swatch) setInkColor(swatch.dataset.color, Number(swatch.dataset.colorIndex));
});
colorPalette.addEventListener("keydown", event => {
  const movements = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -10, ArrowDown: 10 };
  if (!(event.key in movements) && event.key !== "Home" && event.key !== "End") return;
  event.preventDefault();
  const last = paletteColors.length - 1;
  const index = Number(event.target.dataset.colorIndex);
  paletteActiveIndex = event.key === "Home" ? 0 : event.key === "End" ? last : Math.max(0, Math.min(last, index + movements[event.key]));
  colorPalette.querySelector(`[data-color-index="${paletteActiveIndex}"]`).focus();
});
customColorInput.addEventListener("input", event => setInkColor(event.target.value));

document.querySelectorAll("[data-theme-choice]").forEach(button => {
  button.addEventListener("click", () => setTheme(button.dataset.themeChoice));
});

document.querySelector("#copy-code").addEventListener("click", async () => {
  const feedback = document.querySelector("#copy-feedback");
  try {
    await navigator.clipboard.writeText(codeOutput.textContent);
    feedback.textContent = "COPIED";
  } catch {
    const range = document.createRange();
    range.selectNodeContents(codeOutput);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    feedback.textContent = "SELECTED — COPY";
  }
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => { feedback.textContent = ""; }, 2400);
});

document.querySelector("#download-code").addEventListener("click", () => {
  downloadBlob(new Blob([codeOutput.innerText], { type: "text/plain;charset=utf-8" }), languages[currentLanguage].file);
});

restoreDrawing();
let savedTheme = "light";
try {
  savedTheme = localStorage.getItem("shapescript-theme") ?? "light";
} catch {
  // Use the light theme when browser storage is unavailable.
}
setTheme(savedTheme);
document.querySelector("#shape-total").textContent = catalog.length;
document.querySelector("#language-select").value = currentLanguage;
renderShapeChoices();
buildColorPalette();
setInkColor(currentColor);
setPaintTool(activeTool);
render();
