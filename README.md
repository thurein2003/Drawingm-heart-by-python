# ShapeScript

ShapeScript turns the original Python turtle heart into an interactive drawing studio. Choose from 30 diagrams, draw with the brush, line, rectangle, and oval tools, fill closed shapes, erase both the selected diagram and your added marks, and adjust the ink color and brush size. Drawings and studio preferences are saved in the browser, so they stay after a refresh.

The source panel is editable: change the path coordinates or style values, then choose **Apply** (or press Ctrl/⌘ + Enter) to update the canvas. Canvas changes regenerate the source in Python, JavaScript, Java, or C++. Export your drawing as PNG or SVG, zoom the canvas, and use keyboard shortcuts: B brush, L line, R rectangle, O oval, F fill, E eraser, +/− zoom, 0 reset zoom, and Ctrl/⌘ + Z undo.

**Live site:** <https://thurein2003.github.io/Drawingm-heart-by-python/>

## Diagrams

Heart, star, circles, flower, spiral, diamond, triangle, square, pentagon, hexagon, octagon, crescent, infinity, butterfly, snowflake, sun, moon, clover, wave, leaf, rainbow, cube, smiley, target, pinwheel, atom, crown, mountains, lightning, and cloud.

The preview updates in the browser without sending your selections anywhere. The language examples use Python Turtle, JavaScript Canvas, Java Swing, and C++ with SFML. The C++ example needs SFML installed to compile.

## Run locally

Open `index.html` in a browser. The web version uses plain HTML, CSS, and JavaScript, so it does not need a package install or build step.

To run the original heart program, use Python 3:

```bash
python heart.py
```

## Publish with GitHub Pages

The `pages.yml` workflow deploys the root static site to GitHub Pages whenever a commit is pushed to `main`. In the repository, open **Settings → Pages** and set the build and deployment source to **GitHub Actions** if it is not already selected. After the first successful workflow, the site is available at the live URL above.

