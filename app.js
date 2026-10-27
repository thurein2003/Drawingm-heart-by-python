const { catalog, languages, model, generateCode } = window.ShapeStudio;

let currentShape = "heart";
let currentLanguage = "python";
let currentColor = "#6258d9";
let copyTimer;

const codeOutput = document.querySelector("#code-output");
const lineNumbers = document.querySelector("#line-numbers");
const previewSvg = document.querySelector("#preview-svg");
const shapeGrid = document.querySelector("#shape-grid");
const shapeSearch = document.querySelector("#shape-search");
const noShapes = document.querySelector("#no-shapes");
const colorPalette = document.querySelector("#color-palette");
const customColorInput = document.querySelector("#custom-color");
const themeColor = document.querySelector('meta[name="theme-color"]');
let paletteColors = [];
let paletteActiveIndex = 0;

function renderShapeChoices(filter = shapeSearch.value) {
  const query = filter.trim().toLocaleLowerCase();
  const matchingShapes = catalog.filter(shape => `${shape.label} ${shape.id}`.toLocaleLowerCase().includes(query));
  shapeGrid.replaceChildren();

  for (const shape of matchingShapes) {
    const button = document.createElement("button");
    const selected = shape.id === currentShape;
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

function render() {
  const diagram = catalog.find(shape => shape.id === currentShape) ?? catalog[0];
  const language = languages[currentLanguage];
  const paths = model(currentShape);
  const markup = paths.map(path => {
    const points = path.points.map(([x, y]) => `${x},${y}`).join(" ");
    const tag = path.closed ? "polygon" : "polyline";
    const className = path.fill ? "shape-fill" : "shape-stroke";
    return `<${tag} class="${className}" points="${points}"/>`;
  }).join("");
  const code = generateCode(currentShape, currentLanguage, currentColor);

  previewSvg.innerHTML = `<g transform="translate(250 160)">${markup}</g>`;
  previewSvg.setAttribute("aria-label", `${diagram.label} diagram preview`);
  document.querySelector("#preview-title").textContent = diagram.label;
  document.querySelector("#stage-shape-label").textContent = `THE ${diagram.label.toLocaleUpperCase()}`;
  document.querySelector("#code-title").textContent = language.file;
  document.querySelector("#code-subtitle").textContent = language.label;
  document.querySelector("#runtime-note").textContent = language.note;
  document.querySelector("#drawing-stage").style.setProperty("--draw-color", currentColor);
  codeOutput.innerHTML = highlightCode(code);
  lineNumbers.textContent = Array.from({ length: code.split("\n").length }, (_, index) => index + 1).join("\n");
  document.querySelector("#copy-feedback").textContent = "";
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
