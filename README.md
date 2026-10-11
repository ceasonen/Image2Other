# Image2Other

**Your images. Editable again.**

A local-first conversion studio for research figures, diagrams, and everyday images. Trace a raster image into real vector paths, reconstruct a diagram with your vision model, and export SVG or native editable PowerPoint objects. Convert image formats without uploading your files.

[Open the studio](https://ceasonen.github.io/Image2Other/) · [中文说明](docs/README.zh-CN.md) · [Research & credits](docs/research.md) · [Report an issue](https://github.com/ceasonen/Image2Other/issues)

![Image2Other studio showing an actual local raster-to-path conversion](docs/images/studio.png)

## What works today

| Mode | What you get | What stays editable | Requirements |
| --- | --- | --- | --- |
| Vector trace | Colored vector paths | Path geometry, fill, opacity; PPTX freeform objects | Browser only |
| AI rebuild | A validated scene of text, shapes, lines, and paths | Text content, geometry, colors, arrows | Your compatible vision provider, or Scene JSON from your AI chat |
| Image formats | PNG, JPEG, WebP with resize and quality options | Raster pixels, not semantic objects | Browser only |

**A traced letter is an outline, not a text box.** Local tracing does not recover the original layers, fonts, labels, or meaning. AI reconstruction approximates those elements and can make mistakes. Compare labels, equations, layout, and geometry against the source before publication.

PPTX export uses native text boxes, shapes, and custom vector geometry, not a full-slide screenshot or an embedded SVG that requires manual ungrouping. The authored editable example demonstrates export and editing; it is **not** evidence of automatic reconstruction accuracy.

## Quick start

Node.js 22.12+ or a supported newer release:

```sh
npm install --ignore-scripts
npm run dev
```

Open `http://127.0.0.1:5178/Image2Other/`.

1. Drop, browse, or paste an image. Try the included raster diagram if you want a quick example.
2. Choose Vector trace, AI rebuild, or Image formats.
3. Inspect the preview. Open Layers to change fills, opacity, text, or basic coordinates. Undo or add text when needed.
4. Download SVG, PPTX, Scene JSON, or a raster image.

To recover editable words, use AI rebuild. Configure your vision provider with the settings button, or copy the reconstruction prompt into your own AI chat and import its JSON response. [AI setup and scene schema](docs/ai-rebuild.md)

```sh
npm test
npm run build
npm run preview
```

The deployment workflow also runs real-browser smoke tests before publishing. To run them locally, start an isolated Chrome instance with a DevTools port:

```sh
node tests/browser.mjs http://127.0.0.1:4178/Image2Other/ 9226
```

Tests cover actual native PPTX XML, path subcomponents and curves, safe scene parsing, provider URLs, and the consent boundary. Browser tests inspect downloaded SVG/PPTX/JSON files, exercise the raster sample, tracing worker, layer editing and raster downloads, and check responsive widths and extreme image aspect ratios. Native-shape and traced-path exports were also opened and rendered with LibreOffice during release QA. Live provider accuracy is not covered by these tests and has not been benchmarked.

## Privacy and limits

- Local tracing and raster conversion run on your device. There is no upload backend, account, analytics, or persisted image history.
- AI rebuild sends the image and prompt **only after consent** to the endpoint you enter. That provider's fees, privacy policy, retention, and CORS rules apply. Do not send confidential review material without permission.
- Provider credentials live in the settings fields for the current page session. We do not put them in localStorage, IndexedDB, URLs, logs, or this repository. Close the page or click Clear credentials to remove them.
- Input limit: 20 MB and 24 megapixels. Local trace uses a maximum 768-pixel working edge and at most 2,000 paths. This trades fine detail for browser responsiveness. It is suited to flat graphics rather than photographic reconstruction.
- PNG/JPEG/WebP export support depends on the browser. JPEG has no transparency; select its background color. Animated inputs export one decoded frame. Resizing does not recover missing detail.
- Imported SVGs must be self-contained and have no scripts, foreign objects, external references, or style blocks. They are decoded as images; their original vector structure is not currently imported as a scene.
- Current scene paths support absolute M/L/Q/C/Z commands. Unsupported geometry is rejected rather than silently rasterized. Basic solid fills only; gradients, editable equations, connectors attached to shapes, batch jobs, PDF, EPS, and legacy `.ppt` are not implemented.

## Deployment

The independent repository publishes at `https://ceasonen.github.io/Image2Other/`, underneath Cheng Chen's homepage. The personal homepage only links to this tool; its layouts, styles, dependencies, and build stay separate. The project URL uses the repository's case-sensitive name. In repository Settings → Pages, select **GitHub Actions** as the build source. The included workflow runs unit tests, a production build, and actual browser conversions on pull requests, and deploys only from `main` after those checks pass.

Vite's base path is `/Image2Other/`. Change it in `vite.config.js` if you fork the project under another name. Do not copy the application source into your personal homepage repository. Build output lives in `dist/`; dependencies and local test outputs are ignored.

## Development direction

The next meaningful improvements are better text/layout recovery, local OCR-assisted rebuilding, preservation of difficult artwork, batch conversion, and a public paired-input benchmark with both visual fidelity and editability checks. None are presented as already implemented. Contributions should include a minimal licensed example, expected editable elements, and the actual output.

This is an early usable release, not a claim of better accuracy than StarVector, LIVE, or existing image-to-PPT systems. [Technical decisions and source provenance](docs/research.md)

## License

Image2Other's original code is MIT licensed. ImageTracerJS is Unlicense/public domain; PptxGenJS and JSZip retain their own licenses. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Research references are acknowledgements, not claims that their models or code are running inside this application.
