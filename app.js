const { catalog, languages, model, generateDrawingCode } = window.ShapeStudio;

let currentShape = "heart";
let currentLanguage = "python";
let currentColor = "#6258d9";
let brushWidth = 4;
let activeTool = "brush";
let showPreset = true;
let paintPaths = [];
let undoStack = [];
let pointerAction = null;
let copyTimer;
let codeUpdateTimer;

const codeOutput = document.querySelector("#code-output");
const lineNumbers = document.querySelector("#line-numbers");
const previewSvg = document.querySelector("#preview-svg");
const shapeGrid = document.querySelector("#shape-grid");
const shapeSearch = document.querySelector("#shape-search");
const noShapes = document.querySelector("#no-shapes");
const colorPalette = document.querySelector("#color-palette");
const customColorInput = document.querySelector("#custom-color");
const brushSizeInput = document.querySelector("#brush-size");
const undoButton = document.querySelector("#undo-drawing");
const themeColor = document.querySelector('meta[name="theme-color"]');
let paletteColors = [];
let paletteActiveIndex = 0;

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
    ? model(currentShape).map(path => ({ ...path, color: currentColor, width: 4 }))
    : [];
  const paths = [...presetPaths, ...paintPaths];
  const markup = paths.map(path => {
    const points = path.points.map(([x, y]) => `${x},${y}`).join(" ");
    const tag = path.closed ? "polygon" : "polyline";
    const className = path.fill ? "shape-fill" : "shape-stroke";
    const fill = path.fill ? path.color : "none";
    const fillOpacity = path.fill ? ".14" : "0";
    return `<${tag} class="${className}" points="${points}" stroke="${path.color}" stroke-width="${path.width}" fill="${fill}" fill-opacity="${fillOpacity}"/>`;
  }).join("");
  previewSvg.innerHTML = `<rect class="paint-hit-area" x="0" y="0" width="500" height="320" fill="transparent" pointer-events="all"/><g transform="translate(250 160)">${markup}</g>`;
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
  document.querySelector("#copy-feedback").textContent = "";
  document.querySelector("#brush-size-value").textContent = `${brushWidth} px`;
  undoButton.disabled = undoStack.length === 0;
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
  };
}

function saveDrawingUndo(snapshot = drawingSnapshot()) {
  undoStack.push(snapshot);
  if (undoStack.length > 40) undoStack.shift();
}

function makeShapePath(tool, start, end) {
  const style = { color: currentColor, width: brushWidth, fill: false };
  if (tool === "line") return { ...style, points: [start, end], closed: false };
  if (tool === "rectangle") {
    return { ...style, points: [start, [end[0], start[1]], end, [start[0], end[1]]], closed: true };
  }
  const centerX = (start[0] + end[0]) / 2;
  const centerY = (start[1] + end[1]) / 2;
  const radiusX = Math.abs(end[0] - start[0]) / 2;
  const radiusY = Math.abs(end[1] - start[1]) / 2;
  const points = Array.from({ length: 49 }, (_, index) => {
    const angle = Math.PI * 2 * index / 48;
    return [centerX + Math.cos(angle) * radiusX, centerY + Math.sin(angle) * radiusY];
  });
  return { ...style, points, closed: true };
}

function pointOnCanvas(event) {
  const bounds = previewSvg.getBoundingClientRect();
  const style = getComputedStyle(previewSvg);
  const left = bounds.left + parseFloat(style.paddingLeft);
  const top = bounds.top + parseFloat(style.paddingTop);
  const width = bounds.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const height = bounds.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const x = Math.max(0, Math.min(500, ((event.clientX - left) / width) * 500)) - 250;
  const y = Math.max(0, Math.min(320, ((event.clientY - top) / height) * 320)) - 160;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
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
}

previewSvg.addEventListener("pointerdown", event => {
  if (event.button !== 0) return;
  event.preventDefault();
  const point = pointOnCanvas(event);
  previewSvg.setPointerCapture(event.pointerId);
  const before = drawingSnapshot();
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
undoButton.addEventListener("click", () => {
  const previous = undoStack.pop();
  if (!previous) return;
  showPreset = previous.showPreset;
  paintPaths = previous.paintPaths;
  renderShapeChoices();
  render();
});
document.querySelector("#clear-drawing").addEventListener("click", () => {
  saveDrawingUndo();
  showPreset = false;
  paintPaths = [];
  renderShapeChoices();
  render();
});

shapeSearch.addEventListener("input", () => renderShapeChoices());
document.querySelector("#language-select").addEventListener("change", event => {
  currentLanguage = event.target.value;
  render();
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
  const blob = new Blob([codeOutput.textContent], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = languages[currentLanguage].file;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

let savedTheme = "light";
try {
  savedTheme = localStorage.getItem("shapescript-theme") ?? "light";
} catch {
  // Use the light theme when browser storage is unavailable.
}
setTheme(savedTheme);
document.querySelector("#shape-total").textContent = catalog.length;
renderShapeChoices();
buildColorPalette();
render();
