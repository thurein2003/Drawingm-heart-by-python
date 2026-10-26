# ShapeScript

ShapeScript turns the original Python turtle heart into a small interactive drawing studio. Choose a diagram and ink color, switch between Python, JavaScript, Java, or C++, then copy or download the matching code example.

**Live site:** <https://thurein2003.github.io/Drawingm-heart-by-python/>

## Diagrams

- Heart
- Star
- Circles
- Flower
- Spiral
- Diamond

The preview updates in the browser without sending your selections anywhere. The language examples use Python Turtle, JavaScript Canvas, Java Swing, and C++ with SFML. The C++ example needs SFML installed to compile.

## Run locally

Open `index.html` in a browser. The web version uses plain HTML, CSS, and JavaScript, so it does not need a package install or build step.

To run the original heart program, use Python 3:

```bash
python heart.py
```

## Publish with GitHub Pages

The `pages.yml` workflow deploys the root static site to GitHub Pages whenever a commit is pushed to `main`. In the repository, open **Settings → Pages** and set the build and deployment source to **GitHub Actions** if it is not already selected. After the first successful workflow, the site is available at the live URL above.

