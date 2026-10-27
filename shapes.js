(() => {
  const NL = String.fromCharCode(10);
  const catalog = [
    ["heart", "Heart", "♡"], ["star", "Star", "★"], ["circles", "Circles", "◎"],
    ["flower", "Flower", "✿"], ["spiral", "Spiral", "＠"], ["diamond", "Diamond", "◇"],
    ["triangle", "Triangle", "△"], ["square", "Square", "□"], ["pentagon", "Pentagon", "⬠"],
    ["hexagon", "Hexagon", "⬡"], ["octagon", "Octagon", "⯃"], ["crescent", "Crescent", "☾"],
    ["infinity", "Infinity", "∞"], ["butterfly", "Butterfly", "⋈"], ["snowflake", "Snowflake", "❄"],
    ["sun", "Sun", "☼"], ["moon", "Moon", "◐"], ["clover", "Clover", "♣"],
    ["wave", "Wave", "≋"], ["leaf", "Leaf", "❧"], ["rainbow", "Rainbow", "⌒"],
    ["cube", "Cube", "◈"], ["smiley", "Smiley", "☺"], ["target", "Target", "⊙"],
    ["pinwheel", "Pinwheel", "✥"], ["atom", "Atom", "⚛"], ["crown", "Crown", "♛"],
    ["mountain", "Mountains", "⛰"], ["lightning", "Lightning", "ϟ"], ["cloud", "Cloud", "☁"],
  ].map(([id, label, glyph]) => ({ id, label, glyph }));

  const languages = {
    python: { file: "drawing.py", label: "Python · Turtle", note: "Runs with Python's built-in Turtle module" },
    javascript: { file: "drawing.js", label: "JavaScript · Canvas", note: "Runs in a modern web browser" },
    java: { file: "ShapeDrawing.java", label: "Java · Swing", note: "Uses Java Swing from the JDK" },
    cpp: { file: "drawing.cpp", label: "C++ · SFML", note: "Outline example · requires SFML 2.6" },
  };

  const round = value => Number(value.toFixed(1));
  const makePath = (points, closed = false, fill = false) => ({
    points: points.map(([x, y]) => [round(x), round(y)]), closed, fill,
  });
  const line = points => makePath(points);
  const polygon = (points, fill = true) => makePath(points, true, fill);

  function ellipse(cx, cy, rx, ry, rotation = 0, count = 40) {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return Array.from({ length: count }, (_, index) => {
      const angle = (Math.PI * 2 * index) / count;
      const x = Math.cos(angle) * rx;
      const y = Math.sin(angle) * ry;
      return [cx + x * cos - y * sin, cy + x * sin + y * cos];
    });
  }

  function arc(cx, cy, radius, start, end, count = 32) {
    return Array.from({ length: count + 1 }, (_, index) => {
      const angle = start + ((end - start) * index) / count;
      return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
    });
  }

  function quadratic(start, control, end, count = 12) {
    return Array.from({ length: count + 1 }, (_, index) => {
      const t = index / count;
      const inverse = 1 - t;
      return [
        inverse * inverse * start[0] + 2 * inverse * t * control[0] + t * t * end[0],
        inverse * inverse * start[1] + 2 * inverse * t * control[1] + t * t * end[1],
      ];
    });
  }

  function regular(sides, radius = 108, rotation = -Math.PI / 2) {
    return Array.from({ length: sides }, (_, index) => {
      const angle = rotation + (Math.PI * 2 * index) / sides;
      return [radius * Math.cos(angle), radius * Math.sin(angle)];
    });
  }

  function star(outer = 112, inner = 49, points = 5) {
    return Array.from({ length: points * 2 }, (_, index) => {
      const radius = index % 2 === 0 ? outer : inner;
      const angle = (Math.PI * index) / points - Math.PI / 2;
      return [radius * Math.cos(angle), radius * Math.sin(angle)];
    });
  }

  function heart(cx = 0, cy = 0, scale = 6.2, count = 72) {
    return Array.from({ length: count }, (_, index) => {
      const angle = (Math.PI * 2 * index) / count;
      const x = 16 * Math.pow(Math.sin(angle), 3);
      const y = 13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle);
      return [cx + x * scale, cy - y * scale];
    });
  }

  function rotate(points, angle, dx = 0, dy = 0) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return points.map(([x, y]) => [x * cos - y * sin + dx, x * sin + y * cos + dy]);
  }

  function model(id) {
    if (id === "heart") return [polygon(heart())];
    if (id === "star") return [polygon(star())];
    if (id === "circles") return [32, 59, 86, 113].map(radius => makePath(ellipse(0, 0, radius, radius), true));
    if (id === "flower") return [
      ...Array.from({ length: 8 }, (_, i) => polygon(ellipse(0, -45, 21, 43, i * Math.PI / 4))),
      polygon(ellipse(0, 0, 21, 21)),
    ];
    if (id === "spiral") return [line(Array.from({ length: 140 }, (_, i) => {
      const t = Math.PI * 6 * i / 139;
      const radius = 2 + 106 * i / 139;
      return [Math.cos(t) * radius, Math.sin(t) * radius];
    }))];
    if (id === "diamond") return [polygon(regular(4, 112))];
    if (id === "triangle") return [polygon(regular(3, 112))];
    if (id === "square") return [polygon(regular(4, 91, -Math.PI / 4))];
    if (id === "pentagon") return [polygon(regular(5, 110))];
    if (id === "hexagon") return [polygon(regular(6, 108, 0))];
    if (id === "octagon") return [polygon(regular(8, 108, Math.PI / 8))];
    if (id === "crescent") {
      const outer = Array.from({ length: 61 }, (_, i) => {
        const angle = -Math.PI / 3 - 4 * Math.PI * i / 90;
        return [108 * Math.cos(angle), 108 * Math.sin(angle)];
      });
      return [polygon([...outer, ...quadratic(outer.at(-1), [118, 0], outer[0]).slice(1)])];
    }
    if (id === "infinity") return [line(Array.from({ length: 120 }, (_, i) => {
      const t = Math.PI * 2 * i / 119;
      const denominator = 1 + Math.sin(t) ** 2;
      return [108 * Math.cos(t) / denominator, 92 * Math.sin(t) * Math.cos(t) / denominator];
    }))];
    if (id === "butterfly") return [
      polygon(ellipse(-34, -34, 39, 27, -0.45)), polygon(ellipse(34, -34, 39, 27, 0.45)),
      polygon(ellipse(-32, 33, 30, 22, 0.45)), polygon(ellipse(32, 33, 30, 22, -0.45)),
      line([[0, -63], [0, 65]]), line([[-4, -53], [-29, -82]]), line([[4, -53], [29, -82]]),
    ];
    if (id === "snowflake") {
      const paths = [];
      for (let arm = 0; arm < 6; arm++) {
        const angle = arm * Math.PI / 3;
        const tip = [Math.cos(angle) * 112, Math.sin(angle) * 112];
        paths.push(line([[0, 0], tip]));
        for (const amount of [0.57, 0.76]) {
          const base = [tip[0] * amount, tip[1] * amount];
          const size = amount === 0.57 ? 25 : 19;
          for (const side of [-1, 1]) {
            const branch = angle + side * Math.PI / 3;
            paths.push(line([base, [base[0] + Math.cos(branch) * size, base[1] + Math.sin(branch) * size]]));
          }
        }
      }
      return paths;
    }
    if (id === "sun") {
      const paths = [polygon(ellipse(0, 0, 38, 38))];
      for (let ray = 0; ray < 12; ray++) {
        const angle = ray * Math.PI / 6;
        paths.push(line([[Math.cos(angle) * 55, Math.sin(angle) * 55], [Math.cos(angle) * 106, Math.sin(angle) * 106]]));
      }
      return paths;
    }
    if (id === "moon") return [
      makePath(ellipse(0, 0, 104, 104), true), makePath(ellipse(-34, -30, 11, 11), true),
      makePath(ellipse(39, -12, 8, 8), true), makePath(ellipse(15, 43, 13, 13), true),
    ];
    if (id === "clover") return [
      ...[[-25, -27], [25, -27], [-25, 27], [25, 27]].map(([x, y]) => polygon(heart(x, y, 2.05, 40))),
      line([[0, 36], [4, 73], [21, 102]]),
    ];
    if (id === "wave") {
      const upper = Array.from({ length: 90 }, (_, i) => {
        const x = -116 + 232 * i / 89;
        return [x, Math.sin(i * 0.14) * 33 - 18];
      });
      return [line(upper), line(upper.map(([x, y]) => [x, y + 48]))];
    }
    if (id === "leaf") {
      const angle = -0.48;
      return [
        polygon(ellipse(0, 0, 108, 57, angle, 56), false),
        line(rotate([[-98, 0], [98, 0]], angle)),
        ...[-0.52, -0.15, 0.2, 0.55].flatMap(t => {
          const x = t * 85;
          return [line(rotate([[x, 0], [x + 18, -22]], angle)), line(rotate([[x, 0], [x + 18, 22]], angle))];
        }),
      ];
    }
    if (id === "rainbow") return [105, 88, 71, 54, 37].map(radius => line(arc(0, 50, radius, Math.PI, Math.PI * 2, 28)));
    if (id === "cube") return [
      line([[-60, -45], [0, -82], [63, -47], [63, 33], [0, 72], [-60, 36], [-60, -45]]),
      line([[0, -82], [0, -1], [63, 33]]), line([[0, -1], [-60, 36]]),
    ];
    if (id === "smiley") {
      const smile = Array.from({ length: 30 }, (_, i) => {
        const x = -43 + 86 * i / 29;
        return [x, 48 - x * x / 47];
      });
      return [makePath(ellipse(0, 0, 106, 106), true), polygon(ellipse(-38, -32, 7, 10)),
        polygon(ellipse(38, -32, 7, 10)), line(smile)];
    }
    if (id === "target") return [25, 52, 79, 106].map(radius => makePath(ellipse(0, 0, radius, radius), true));
    if (id === "pinwheel") return Array.from({ length: 4 }, (_, i) =>
      polygon(rotate([[0, 0], [31, -15], [107, -68], [64, 17]], i * Math.PI / 2)));
    if (id === "atom") return [
      makePath(ellipse(0, 0, 110, 44, 0), true), makePath(ellipse(0, 0, 110, 44, Math.PI / 3), true),
      makePath(ellipse(0, 0, 110, 44, -Math.PI / 3), true), polygon(ellipse(0, 0, 12, 12)),
    ];
    if (id === "crown") return [
      polygon([[-104, -53], [-61, -4], [-34, -75], [0, -8], [36, -77], [63, -3], [105, -53], [83, 62], [-83, 62]]),
      line([[-84, 82], [84, 82]]),
    ];
    if (id === "mountains") return [
      polygon([[-120, 74], [-52, -30], [-5, 38], [29, -8], [120, 74]]),
      polygon([[-52, -30], [-5, 38], [-33, 7]], false),
      polygon([[29, -8], [120, 74], [68, 44]], false), makePath(ellipse(75, -70, 21, 21), true),
    ];
    if (id === "lightning") return [polygon([[-18, -116], [53, -116], [11, -24], [72, -24], [-39, 117], [-10, 18], [-72, 18]])];

    const segments = [
      quadratic([-83, 42], [-112, 35], [-107, 8]),
      quadratic([-107, 8], [-107, -20], [-76, -28]).slice(1),
      quadratic([-76, -28], [-83, -74], [-36, -74]).slice(1),
      quadratic([-36, -74], [-8, -105], [22, -73]).slice(1),
      quadratic([22, -73], [79, -82], [77, -35]).slice(1),
      quadratic([77, -35], [119, -16], [92, 15]).slice(1),
      quadratic([92, 15], [94, 47], [58, 45]).slice(1), [[58, 45], [-63, 45]],
      quadratic([-63, 45], [-99, 50], [-83, 42]).slice(1),
    ];
    return [polygon(segments.flat())];
  }

  function pointRows(points, indent, tuple = false) {
    const left = tuple === true ? "(" : tuple === "brace" ? "{" : "[";
    const right = tuple === true ? ")" : tuple === "brace" ? "}" : "]";
    return points.map(([x, y]) => `${indent}${left}${x}, ${y}${right},`).join(NL);
  }

  function pathStyle(path, defaultColor) {
    return { color: path.color ?? defaultColor, width: path.width ?? 4 };
  }

  function pythonCode(paths, color) {
    const data = paths.map(shape => {
      const style = pathStyle(shape, color);
      return `    ([${NL}${pointRows(shape.points, "        ", true)}${NL}    ], ${shape.closed ? "True" : "False"}, ${shape.fill ? "True" : "False"}, ${shape.stroke !== false ? "True" : "False"}, "${style.color}", ${style.width}),`;
    }).join(NL);
    return [
      "import turtle", "", "pen = turtle.Turtle()", "pen.speed(0)", "", "# Points are centered on the canvas.",
      "paths = [", data, "]", "", "for points, closed, filled, stroked, color, width in paths:",
      "    pen.pencolor(color)", "    pen.fillcolor(color)", "    pen.pensize(width if stroked else 0.01)", "    pen.penup()",
      "    pen.goto(points[0][0], -points[0][1])", "    if filled:", "        pen.begin_fill()", "    pen.pendown()",
      "    for x, y in points[1:]:", "        pen.goto(x, -y)", "    if closed:", "        pen.goto(points[0][0], -points[0][1])",
      "    if filled:", "        pen.end_fill()", "", "pen.hideturtle()", "turtle.done()",
    ].join(NL);
  }

  function javascriptCode(paths, color) {
    const data = paths.map(shape => {
      const style = pathStyle(shape, color);
      return `  {${NL}    points: [${NL}${pointRows(shape.points, "      ")}${NL}    ],${NL}    closed: ${shape.closed}, fill: ${shape.fill}, stroke: ${shape.stroke !== false},${NL}    color: "${style.color}", width: ${style.width}${NL}  },`;
    }).join(NL);
    return [
      "// Add <canvas id=\"drawing\" width=\"540\" height=\"400\"></canvas> to your HTML.",
      "const canvas = document.querySelector(\"#drawing\");", "const ctx = canvas.getContext(\"2d\");",
      "ctx.translate(canvas.width / 2, canvas.height / 2);", "ctx.lineJoin = \"round\";", "ctx.lineCap = \"round\";", "",
      "const paths = [", data, "];", "", "for (const shape of paths) {", "  ctx.beginPath();", "  ctx.strokeStyle = shape.color;",
      "  ctx.fillStyle = shape.color + \"24\";", "  ctx.lineWidth = shape.width;", "  shape.points.forEach(([x, y], index) => {",
      "    if (index === 0) ctx.moveTo(x, y);", "    else ctx.lineTo(x, y);", "  });", "  if (shape.closed) ctx.closePath();",
      "  if (shape.fill) ctx.fill();", "  if (shape.stroke) ctx.stroke();", "}",
    ].join(NL);
  }

  function javaCode(paths, color) {
    const data = paths.map(shape => `        new double[][] {${NL}${pointRows(shape.points, "            ", "brace")}${NL}        },`).join(NL);
    const closed = paths.map(shape => String(shape.closed)).join(", ");
    const filled = paths.map(shape => String(shape.fill)).join(", ");
    const stroked = paths.map(shape => String(shape.stroke !== false)).join(", ");
    const inks = paths.map(shape => {
      const rgb = pathStyle(shape, color).color.match(/[a-f\d]{2}/gi).map(value => parseInt(value, 16)).join(", ");
      return `        new Color(${rgb}),`;
    }).join(NL);
    const widths = paths.map(shape => pathStyle(shape, color).width).join(", ");
    return [
      "import javax.swing.*;", "import java.awt.*;", "import java.awt.geom.*;", "", "public class ShapeDrawing extends JPanel {",
      "    private static final double[][][] POINTS = {", data, "    };", `    private static final boolean[] CLOSED = {${closed}};`,
      `    private static final boolean[] FILLED = {${filled}};`, `    private static final boolean[] STROKED = {${stroked}};`, `    private static final Color[] COLORS = {${NL}${inks}${NL}    };`,
      `    private static final float[] WIDTHS = {${widths}};`, "", "    @Override", "    protected void paintComponent(Graphics graphics) {",
      "        super.paintComponent(graphics);", "        Graphics2D g2 = (Graphics2D) graphics.create();",
      "        g2.translate(getWidth() / 2.0, getHeight() / 2.0);", "        for (int i = 0; i < POINTS.length; i++) {",
      "            g2.setStroke(new BasicStroke(WIDTHS[i], BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));", "            Path2D shape = new Path2D.Double();",
      "            shape.moveTo(POINTS[i][0][0], POINTS[i][0][1]);",
      "            for (int j = 1; j < POINTS[i].length; j++) shape.lineTo(POINTS[i][j][0], POINTS[i][j][1]);",
      "            if (CLOSED[i]) shape.closePath();", "            if (FILLED[i]) {", "                Color ink = COLORS[i];",
      "                g2.setColor(new Color(ink.getRed(), ink.getGreen(), ink.getBlue(), 40));", "                g2.fill(shape);", "            }",
      "            if (STROKED[i]) { g2.setColor(COLORS[i]); g2.draw(shape); }", "        }",
      "        g2.dispose();", "    }", "", "    public static void main(String[] args) {", "        JFrame frame = new JFrame(\"Shape Drawing\");",
      "        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);", "        frame.setSize(540, 400);", "        frame.add(new ShapeDrawing());",
      "        frame.setLocationRelativeTo(null);", "        frame.setVisible(true);", "    }", "}",
    ].join(NL);
  }

  function cppCode(paths, color) {
    const data = paths.map(shape => `    {${NL}${pointRows(shape.points, "        ", "brace")}${NL}    },`).join(NL);
    const closed = paths.map(shape => String(shape.closed)).join(", ");
    const filled = paths.map(shape => String(shape.fill)).join(", ");
    const stroked = paths.map(shape => String(shape.stroke !== false)).join(", ");
    const inks = paths.map(shape => {
      const rgb = pathStyle(shape, color).color.match(/[a-f\d]{2}/gi).map(value => parseInt(value, 16)).join(", ");
      return `    sf::Color(${rgb}),`;
    }).join(NL);
    const widths = paths.map(shape => `${pathStyle(shape, color).width}.0f`).join(", ");
    return [
      "#include <SFML/Graphics.hpp>", "#include <vector>", "#include <cmath>", "", "int main() {",
      "    sf::RenderWindow window(sf::VideoMode(540, 400), \"Shape Drawing\");",
      "    const std::vector<std::vector<sf::Vector2f>> paths = {", data, "    };", `    const std::vector<bool> closed = {${closed}};`, `    const std::vector<bool> filled = {${filled}};`, `    const std::vector<bool> stroked = {${stroked}};`,
      `    const std::vector<sf::Color> inks = {${NL}${inks}${NL}    };`, `    const std::vector<float> widths = {${widths}};`, "",
      "    while (window.isOpen()) {", "        sf::Event event;", "        while (window.pollEvent(event)) {",
      "            if (event.type == sf::Event::Closed) window.close();", "        }", "        window.clear(sf::Color(250, 250, 255));",
      "        for (std::size_t i = 0; i < paths.size(); ++i) {", "            const auto& points = paths[i];", "            if (filled[i] && closed[i]) {", "                sf::ConvexShape fill(points.size());", "                for (std::size_t k = 0; k < points.size(); ++k) fill.setPoint(k, {270.f + points[k].x, 200.f + points[k].y});", "                sf::Color fillColor = inks[i]; fillColor.a = 40; fill.setFillColor(fillColor); window.draw(fill);", "            }",
      "            const std::size_t segments = points.size() - 1 + (closed[i] ? 1 : 0);", "            for (std::size_t j = 0; j < segments; ++j) {",
      "                const auto a = points[j];", "                const auto b = points[(j + 1) % points.size()];", "                const float dx = b.x - a.x, dy = b.y - a.y;",
      "                const float length = std::sqrt(dx * dx + dy * dy);", "                if (length == 0) continue;", "                const float ox = -dy / length * widths[i] / 2.f, oy = dx / length * widths[i] / 2.f;",
      "                if (!stroked[i]) continue;", "                sf::VertexArray stroke(sf::Quads, 4);", "                stroke[0].position = {270.f + a.x + ox, 200.f + a.y + oy};",
      "                stroke[1].position = {270.f + a.x - ox, 200.f + a.y - oy};", "                stroke[2].position = {270.f + b.x - ox, 200.f + b.y - oy};",
      "                stroke[3].position = {270.f + b.x + ox, 200.f + b.y + oy};", "                for (std::size_t k = 0; k < 4; ++k) stroke[k].color = inks[i];",
      "                window.draw(stroke);", "            }", "        }",
      "        window.display();", "    }", "}",
    ].join(NL);
  }

  function generateDrawingCode(paths, language, color) {
    if (language === "javascript") return javascriptCode(paths, color);
    if (language === "java") return javaCode(paths, color);
    if (language === "cpp") return cppCode(paths, color);
    return pythonCode(paths, color);
  }

  function generateCode(shape, language, color) {
    const paths = model(shape).map(path => ({ ...path, color, width: 4 }));
    return generateDrawingCode(paths, language, color);
  }

  window.ShapeStudio = { catalog, languages, model, generateCode, generateDrawingCode };
})();
