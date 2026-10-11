# Image2Other

**Your images. Editable again.**

A local-first conversion studio for research figures, PDFs, slides and everyday images. Trace a raster image into vector paths, reconstruct a diagram with your vision model, export native PowerPoint objects, and manage documents without uploading your files.

[Open the studio](https://ceasonen.github.io/Image2Other/) · [中文说明](docs/README.zh-CN.md) · [Research & credits](docs/research.md) · [Report an issue](https://github.com/ceasonen/Image2Other/issues)

![Image2Other studio showing an actual local raster-to-path conversion](docs/images/studio.png)

## What works today

| Mode | What you get | What stays editable | Requirements |
| --- | --- | --- | --- |
| Vector trace | Colored vector paths | Path geometry, fill, opacity; PPTX freeform objects | Browser only |
| AI rebuild | A validated scene of text, shapes, lines, and paths | Text content, geometry, colors, arrows | Your compatible vision provider, or Scene JSON from your AI chat |
| Image formats | PNG, JPEG, WebP with resize and quality options | Raster pixels, not semantic objects | Browser only |
| PDF tools | Merge, split, select/reorder/duplicate and rotate pages | Existing PDF page contents; not a page editor | Browser only |
| PDF page export | PNG/JPEG/WebP ZIP, TXT, or send one page to the figure studio | TXT preserves text content; images preserve pixels | Browser only |
| PDF → PPTX | Page-image slides, or native editable text boxes over raster artwork | Text mode: selectable PDF text; shapes/artwork remain raster | Browser only |
| Image batches | Multi-page PDF or one image per PowerPoint slide | Images remain raster | Browser only |
| PPTX extraction | Slide text as TXT; embedded raster images as ZIP | Source text/image content, not rendered slide layouts | Browser only |

**A traced letter is an outline, not a text box.** Local tracing does not recover the original layers, fonts, labels, or meaning. AI reconstruction approximates those elements and can make mistakes. Compare labels, equations, layout, and geometry against the source before publication.

Figure-studio PPTX export uses native text boxes, shapes, and custom vector geometry. Document-workspace PPTX modes are different: page-image mode is intentionally raster; text mode removes original PDF glyphs from the background and adds native text boxes. Font/color/placement are approximate, not a recovery of the original slide source. The authored example demonstrates editing/export, not reconstruction accuracy.

## Quick start

Node.js 24+ (the PDF renderer uses modern browser and runtime APIs):

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

Tests cover native PPTX XML, PDF page operations, forms/input rejection, ordered slide text extraction, safe scene parsing, and the consent boundary. Browser tests inspect actual downloaded files, verify text-mode backgrounds remove original glyphs, exercise PDF/image/slide operations, and check responsive widths. Native-shape and traced-path exports were also rendered with LibreOffice during earlier release QA. Live provider accuracy is not benchmarked.

## Privacy and limits

- Local image, PDF and PPTX tools run on your device. There is no upload backend, account, analytics, or persisted file history. PDF libraries and workers are self-hosted with the application, not fetched from a runtime CDN.
- AI rebuild sends the image and prompt **only after consent** to the endpoint you enter. That provider's fees, privacy policy, retention, and CORS rules apply. Do not send confidential review material without permission.
- Provider credentials live in the settings fields for the current page session. We do not put them in localStorage, IndexedDB, URLs, logs, or this repository. Close the page or click Clear credentials to remove them.
- Input limit: 20 MB and 24 megapixels. Local trace uses a maximum 768-pixel working edge and at most 2,000 paths. This trades fine detail for browser responsiveness. It is suited to flat graphics rather than photographic reconstruction.
- PNG/JPEG/WebP export support depends on the browser. JPEG has no transparency; select its background color. Animated inputs export one decoded frame. Resizing does not recover missing detail.
- Imported SVGs must be self-contained and have no scripts, foreign objects, external references, or style blocks. They are decoded as images; their original vector structure is not currently imported as a scene.
- The document queue allows 25 files / 50 MB total, up to 200 PDF pages. Rendering is capped at 40 pages, 12 megapixels per page and 32 megapixels per batch. PPTX extraction caps expanded archive contents at 100 MB / 1,000 files. Choose smaller batches when needed.
- Page changes refuse PDFs containing form/signature fields. Keep originals; document restructuring is not signature preservation. Password-protected PDFs/PPTX, OCR for scans, Office-to-PDF rendering, lossless compression, Word/Excel conversions, EPS and legacy `.ppt` are not implemented. This release does not claim universal conversion or feature parity with Smallpdf.
- PPTX extraction reads common DrawingML text runs and embedded PNG/JPEG/WebP/GIF media. It does not render slides, recover linked images, extract editable charts or guarantee reading order within a slide. Image-to-PDF downscales longest edges above 4,096 pixels and uses white backgrounds.
- Current figure paths support absolute M/L/Q/C/Z commands and solid fills. Gradients, editable equations and native attached-connector relationships remain outside the public figure editor.

## Deployment

The independent repository publishes at `https://ceasonen.github.io/Image2Other/`, underneath Cheng Chen's homepage. The personal homepage only links to this tool; its layouts, styles, dependencies, and build stay separate. The project URL uses the repository's case-sensitive name. In repository Settings → Pages, select **GitHub Actions** as the build source. The included workflow runs unit tests, a production build, and actual browser conversions on pull requests, and deploys only from `main` after those checks pass.

Vite's base path is `/Image2Other/`. Change it in `vite.config.js` if you fork the project under another name. Do not copy the application source into your personal homepage repository. Build output lives in `dist/`; dependencies and local test outputs are ignored.

## Development direction

Next engineering work includes OCR-assisted rebuilding, Office rendering through an explicit opt-in local service, and complex-artwork preservation. These are not implemented. Contributions should include a minimal licensed example, expected editable elements and actual output.

This is an early usable release, not a claim of better accuracy than existing systems. Our [research map](docs/research.md) separates published methods, engineering references, and actual integrations. VectorHarness directly overlaps relation-preserving reconstruction and local repair; those capabilities alone are not a new contribution. Lightweight selective edit-response recovery remains a candidate requiring evidence. Source-only reference checkouts and a pre-experimental draft stay in an ignored local research directory; no weights or large datasets were downloaded.

## License

Image2Other's original code is MIT licensed. ImageTracerJS is Unlicense/public domain; PptxGenJS and JSZip retain their own licenses. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Research references are acknowledgements, not claims that their models or code are running inside this application.
