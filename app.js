const diagrams = {
  heart: { label: "Heart", caption: "THE HEART", short: "heart" },
  star: { label: "Star", caption: "THE STAR", short: "star" },
  circles: { label: "Circles", caption: "THE CIRCLES", short: "circles" },
  flower: { label: "Flower", caption: "THE FLOWER", short: "flower" },
  spiral: { label: "Spiral", caption: "THE SPIRAL", short: "spiral" },
  diamond: { label: "Diamond", caption: "THE DIAMOND", short: "diamond" },
};

const languages = {
  python: { file: "drawing.py", label: "Python · Turtle", note: "Runs with Python's built-in Turtle module" },
  javascript: { file: "drawing.js", label: "JavaScript · Canvas", note: "Runs in a modern web browser" },
  java: { file: "ShapeDrawing.java", label: "Java · Swing", note: "Uses Java Swing from the JDK" },
  cpp: { file: "drawing.cpp", label: "C++ · SFML", note: "Requires SFML 2.6 to compile" },
};

let currentShape = "heart";
let currentLanguage = "python";
let currentColor = "#6258d9";
let copyTimer;

const codeOutput = document.querySelector("#code-output");
const lineNumbers = document.querySelector("#line-numbers");
const previewSvg = document.querySelector("#preview-svg");

function starPoints(cx, cy, outerRadius, innerRadius, points = 5) {
  return Array.from({ length: points * 2 }, (_, index) => {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = (Math.PI * index) / points - Math.PI / 2;
    return `${(cx + Math.cos(angle) * radius).toFixed(1)},${(cy + Math.sin(angle) * radius).toFixed(1)}`;
  }).join(" ");
}

function regularPolygonPoints(cx, cy, radius, sides, start = -Math.PI / 2) {
  return Array.from({ length: sides }, (_, index) => {
    const angle = start + (Math.PI * 2 * index) / sides;
    return `${(cx + Math.cos(angle) * radius).toFixed(1)},${(cy + Math.sin(angle) * radius).toFixed(1)}`;
  }).join(" ");
}

function previewMarkup(shape) {
  if (shape === "heart") {
    return '<path class="shape-fill" d="M250 247 126 128C64 66 150 16 250 93 350 16 436 66 374 128L250 247Z"/>';
  }
  if (shape === "star") {
    return `<polygon class="shape-fill" points="${starPoints(250, 160, 118, 52)}"/>`;
  }
  if (shape === "circles") {
    return [34, 67, 100, 133].map(radius => `<circle class="shape-stroke" cx="250" cy="160" r="${radius}"/>`).join("");
  }
  if (shape === "flower") {
    const petals = Array.from({ length: 8 }, (_, index) => `<ellipse class="shape-fill" cx="250" cy="106" rx="25" ry="55" transform="rotate(${index * 45} 250 160)"/>`).join("");
    return `${petals}<circle class="shape-fill" cx="250" cy="160" r="27"/>`;
  }
  if (shape === "spiral") {
    const points = Array.from({ length: 420 }, (_, index) => {
      const angle = index * 0.105;
      const radius = 1 + index * 0.255;
      return `${(250 + Math.cos(angle) * radius).toFixed(1)},${(160 + Math.sin(angle) * radius * 0.66).toFixed(1)}`;
    }).join(" ");
    return `<polyline class="shape-stroke" points="${points}"/>`;
  }
  return `<polygon class="shape-fill" points="${regularPolygonPoints(250, 160, 116, 4, -Math.PI / 2)}"/>`;
}

function pythonCode(shape, color) {
  const drawings = {
    heart: `pen.begin_fill()\npen.left(50)\npen.forward(130)\npen.circle(48, 200)\npen.right(140)\npen.circle(48, 200)\npen.forward(130)\npen.end_fill()`,
    star: `pen.begin_fill()\nfor _ in range(5):\n    pen.forward(150)\n    pen.right(144)\npen.end_fill()`,
    circles: `for radius in (35, 68, 101, 134):\n    pen.penup()\n    pen.goto(0, -radius)\n    pen.pendown()\n    pen.circle(radius)`,
    flower: `for _ in range(8):\n    pen.circle(55)\n    pen.right(45)\n\npen.begin_fill()\npen.circle(18)\npen.end_fill()`,
    spiral: `for step in range(90):\n    pen.forward(step * 0.07)\n    pen.right(20)`,
    diamond: `pen.begin_fill()\nfor _ in range(2):\n    pen.forward(145)\n    pen.right(60)\n    pen.forward(145)\n    pen.right(120)\npen.end_fill()`,
  };
  const fill = ["heart", "star", "diamond"].includes(shape) ? `pen.fillcolor("${color}")\n` : "";
  return `import turtle\n\npen = turtle.Turtle()\npen.speed(0)\npen.pensize(4)\npen.pencolor("${color}")\n${fill}\n${drawings[shape]}\n\nturtle.done()`;
}

function javascriptCode(shape, color) {
  let drawing;
  if (shape === "heart") {
    drawing = `ctx.beginPath();\nctx.moveTo(0, 82);\nctx.bezierCurveTo(-22, 52, -94, 16, -91, -37);\nctx.bezierCurveTo(-87, -93, -18, -94, 0, -45);\nctx.bezierCurveTo(18, -94, 87, -93, 91, -37);\nctx.bezierCurveTo(94, 16, 22, 52, 0, 82);\nctx.closePath();\nctx.fill();\nctx.stroke();`;
  } else if (shape === "star") {
    drawing = `ctx.beginPath();\nfor (let i = 0; i < 10; i++) {\n  const radius = i % 2 === 0 ? 112 : 49;\n  const angle = (Math.PI * i) / 5 - Math.PI / 2;\n  const x = Math.cos(angle) * radius;\n  const y = Math.sin(angle) * radius;\n  i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);\n}\nctx.closePath();\nctx.fill();\nctx.stroke();`;
  } else if (shape === "circles") {
    drawing = `for (const radius of [34, 67, 100, 133]) {\n  ctx.beginPath();\n  ctx.arc(0, 0, radius, 0, Math.PI * 2);\n  ctx.stroke();\n}`;
  } else if (shape === "flower") {
    drawing = `for (let petal = 0; petal < 8; petal++) {\n  ctx.save();\n  ctx.rotate((Math.PI * 2 * petal) / 8);\n  ctx.beginPath();\n  ctx.ellipse(0, -54, 24, 52, 0, 0, Math.PI * 2);\n  ctx.fill();\n  ctx.stroke();\n  ctx.restore();\n}\nctx.beginPath();\nctx.arc(0, 0, 24, 0, Math.PI * 2);\nctx.fill();`;
  } else if (shape === "spiral") {
    drawing = `ctx.beginPath();\nfor (let step = 0; step < 420; step++) {\n  const angle = step * 0.105;\n  const radius = step * 0.26;\n  const x = Math.cos(angle) * radius;\n  const y = Math.sin(angle) * radius * 0.66;\n  step === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);\n}\nctx.stroke();`;
  } else {
    drawing = `ctx.beginPath();\nctx.moveTo(0, -112);\nctx.lineTo(112, 0);\nctx.lineTo(0, 112);\nctx.lineTo(-112, 0);\nctx.closePath();\nctx.fill();\nctx.stroke();`;
  }
  return `// Add <canvas id="drawing" width="500" height="320"></canvas> to your HTML first.\nconst canvas = document.querySelector("#drawing");\nconst ctx = canvas.getContext("2d");\nctx.translate(canvas.width / 2, canvas.height / 2);\nctx.strokeStyle = "${color}";\nctx.fillStyle = "${color}22";\nctx.lineWidth = 4;\nctx.lineJoin = "round";\n\n${drawing}`;
}

function javaCode(shape, color) {
  const shapes = {
    heart: `Path2D shape = new Path2D.Double();\nshape.moveTo(0, 78);\nshape.curveTo(-18, 55, -92, 14, -88, -36);\nshape.curveTo(-84, -91, -18, -90, 0, -42);\nshape.curveTo(18, -90, 84, -91, 88, -36);\nshape.curveTo(92, 14, 18, 55, 0, 78);\nshape.closePath();\ng2.fill(shape);\ng2.draw(shape);`,
    star: `Path2D shape = new Path2D.Double();\nfor (int i = 0; i < 10; i++) {\n    double radius = i % 2 == 0 ? 112 : 49;\n    double angle = Math.PI * i / 5 - Math.PI / 2;\n    double x = Math.cos(angle) * radius;\n    double y = Math.sin(angle) * radius;\n    if (i == 0) shape.moveTo(x, y);\n    else shape.lineTo(x, y);\n}\nshape.closePath();\ng2.fill(shape);\ng2.draw(shape);`,
    circles: `for (int radius : new int[]{34, 67, 100, 133}) {\n    g2.drawOval(-radius, -radius, radius * 2, radius * 2);\n}`,
    flower: `for (int petal = 0; petal < 8; petal++) {\n    Graphics2D layer = (Graphics2D) g2.create();\n    layer.rotate(Math.PI * petal / 4);\n    layer.fill(new Ellipse2D.Double(-24, -106, 48, 104));\n    layer.draw(new Ellipse2D.Double(-24, -106, 48, 104));\n    layer.dispose();\n}\ng2.fill(new Ellipse2D.Double(-24, -24, 48, 48));`,
    spiral: `Path2D shape = new Path2D.Double();\nfor (int step = 0; step < 420; step++) {\n    double angle = step * 0.105;\n    double radius = step * 0.26;\n    double x = Math.cos(angle) * radius;\n    double y = Math.sin(angle) * radius * 0.66;\n    if (step == 0) shape.moveTo(x, y);\n    else shape.lineTo(x, y);\n}\ng2.draw(shape);`,
    diamond: `Path2D shape = new Path2D.Double();\nshape.moveTo(0, -112);\nshape.lineTo(112, 0);\nshape.lineTo(0, 112);\nshape.lineTo(-112, 0);\nshape.closePath();\ng2.fill(shape);\ng2.draw(shape);`,
  };
  return `import javax.swing.*;\nimport java.awt.*;\nimport java.awt.geom.*;\n\npublic class ShapeDrawing extends JPanel {\n    @Override\n    protected void paintComponent(Graphics graphics) {\n        super.paintComponent(graphics);\n        Graphics2D g2 = (Graphics2D) graphics.create();\n        g2.translate(getWidth() / 2.0, getHeight() / 2.0);\n        g2.setColor(Color.decode("${color}"));\n        g2.setStroke(new BasicStroke(4, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));\n        ${shapes[shape].replaceAll("\n", "\n        ")}\n        g2.dispose();\n    }\n\n    public static void main(String[] args) {\n        JFrame frame = new JFrame("Shape Drawing");\n        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);\n        frame.setSize(500, 360);\n        frame.add(new ShapeDrawing());\n        frame.setLocationRelativeTo(null);\n        frame.setVisible(true);\n    }\n}`;
}

function cppCode(shape, color) {
  const rgb = color.match(/[a-f\d]{2}/gi).map(value => parseInt(value, 16)).join(", ");
  let drawing;
  if (shape === "heart") {
    drawing = `sf::ConvexShape shape;\nshape.setPointCount(100);\nfor (std::size_t i = 0; i < 100; ++i) {\n    const float t = 6.28318f * i / 100;\n    const float x = 16 * std::pow(std::sin(t), 3);\n    const float y = 13 * std::cos(t) - 5 * std::cos(2*t) - 2 * std::cos(3*t) - std::cos(4*t);\n    shape.setPoint(i, { 250 + x * 7.f, 170 - y * 7.f });\n}\nshape.setFillColor(sf::Color(${rgb}, 45));\nshape.setOutlineColor(ink);\nshape.setOutlineThickness(4);\nwindow.draw(shape);`;
  } else if (shape === "star") {
    drawing = `sf::ConvexShape shape;\nshape.setPointCount(10);\nfor (std::size_t i = 0; i < 10; ++i) {\n    const float radius = i % 2 == 0 ? 112.f : 49.f;\n    const float angle = 3.14159f * i / 5.f - 1.5708f;\n    shape.setPoint(i, { 250 + std::cos(angle) * radius, 170 + std::sin(angle) * radius });\n}\nshape.setFillColor(sf::Color(${rgb}, 45));\nshape.setOutlineColor(ink);\nshape.setOutlineThickness(4);\nwindow.draw(shape);`;
  } else if (shape === "circles") {
    drawing = `for (float radius : {34.f, 67.f, 100.f, 133.f}) {\n    sf::CircleShape circle(radius);\n    circle.setOrigin(radius, radius);\n    circle.setPosition(250, 170);\n    circle.setFillColor(sf::Color::Transparent);\n    circle.setOutlineColor(ink);\n    circle.setOutlineThickness(4);\n    window.draw(circle);\n}`;
  } else if (shape === "flower") {
    drawing = `for (int petal = 0; petal < 8; ++petal) {\n    sf::CircleShape shape(28.f);\n    shape.setOrigin(28.f, 62.f);\n    shape.setPosition(250, 170);\n    shape.setScale(0.9f, 1.7f);\n    shape.setRotation(petal * 45.f);\n    shape.setFillColor(sf::Color(${rgb}, 45));\n    shape.setOutlineColor(ink);\n    shape.setOutlineThickness(3);\n    window.draw(shape);\n}`;
  } else if (shape === "spiral") {
    drawing = `sf::VertexArray line(sf::LineStrip, 420);\nfor (std::size_t i = 0; i < 420; ++i) {\n    const float angle = i * 0.105f;\n    const float radius = i * 0.26f;\n    line[i].position = { 250 + std::cos(angle) * radius, 170 + std::sin(angle) * radius * 0.66f };\n    line[i].color = ink;\n}\nwindow.draw(line);`;
  } else {
    drawing = `sf::ConvexShape shape;\nshape.setPointCount(4);\nshape.setPoint(0, {250, 58});\nshape.setPoint(1, {362, 170});\nshape.setPoint(2, {250, 282});\nshape.setPoint(3, {138, 170});\nshape.setFillColor(sf::Color(${rgb}, 45));\nshape.setOutlineColor(ink);\nshape.setOutlineThickness(4);\nwindow.draw(shape);`;
  }
  return `#include <SFML/Graphics.hpp>\n#include <cmath>\n#include <initializer_list>\n\nint main() {\n    sf::RenderWindow window(sf::VideoMode(500, 340), "Shape Drawing");\n    const sf::Color ink(${rgb});\n\n    while (window.isOpen()) {\n        sf::Event event;\n        while (window.pollEvent(event)) {\n            if (event.type == sf::Event::Closed) window.close();\n        }\n\n        window.clear(sf::Color(250, 250, 255));\n        ${drawing.replaceAll("\n", "\n        ")}\n        window.display();\n    }\n}`;
}

function makeCode() {
  if (currentLanguage === "javascript") return javascriptCode(currentShape, currentColor);
  if (currentLanguage === "java") return javaCode(currentShape, currentColor);
  if (currentLanguage === "cpp") return cppCode(currentShape, currentColor);
  return pythonCode(currentShape, currentColor);
}

function render() {
  const diagram = diagrams[currentShape];
  const language = languages[currentLanguage];
  const code = makeCode();
  previewSvg.innerHTML = previewMarkup(currentShape);
  previewSvg.setAttribute("aria-label", `${diagram.label} diagram preview`);
  document.querySelector("#preview-title").textContent = diagram.label;
  document.querySelector("#stage-shape-label").textContent = diagram.caption;
  document.querySelector("#code-title").textContent = language.file;
  document.querySelector("#code-subtitle").textContent = language.label;
  document.querySelector("#runtime-note").textContent = language.note;
  document.querySelector("#drawing-stage").style.setProperty("--draw-color", currentColor);
  codeOutput.textContent = code;
  lineNumbers.textContent = Array.from({ length: code.split("\n").length }, (_, index) => index + 1).join("\n");
  document.querySelector("#copy-feedback").textContent = "";
}

document.querySelectorAll(".shape-choice").forEach(button => {
  button.addEventListener("click", () => {
    currentShape = button.dataset.shape;
    document.querySelectorAll(".shape-choice").forEach(choice => {
      const selected = choice === button;
      choice.classList.toggle("is-selected", selected);
      choice.setAttribute("aria-pressed", String(selected));
    });
    render();
  });
});

document.querySelector("#language-select").addEventListener("change", event => {
  currentLanguage = event.target.value;
  render();
});

document.querySelectorAll(".color-choice").forEach(button => {
  button.addEventListener("click", () => {
    currentColor = button.dataset.color;
    document.querySelectorAll(".color-choice").forEach(choice => {
      const selected = choice === button;
      choice.classList.toggle("selected", selected);
      choice.setAttribute("aria-pressed", String(selected));
    });
    render();
  });
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
  const filename = languages[currentLanguage].file;
  const blob = new Blob([codeOutput.textContent], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

render();
