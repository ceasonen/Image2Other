# Third-party notices

- **Tesseract.js 7.0.0** and **Tesseract.js-core 7.0.0**, naptha/Tesseract contributors. [Source](https://github.com/naptha/tesseract.js). Apache-2.0. Pinned browser ESM and worker scripts are retained in `src/vendor/tesseract/` and `public/ocr/`. Core WASM loads from jsDelivr only after permission; inference stays in the browser. Full engine and bundled dependency notices are retained in `public/licenses/tesseract*.txt` and `public/ocr/worker.min.js.LICENSE.txt`. English/Simplified Chinese LSTM language data are self-hosted in `public/ocr/languages/`, from the upstream `@tesseract.js-data/{eng,chi_sim}@1.0.0/4.0.0_best_int` distributions; Apache-2.0, with the Tesseract data license retained alongside them.

Image2Other's original application, scene schema, editor, and adapters are MIT licensed. It is not a fork of any research model or image-to-PPT product.

- **ImageTracerJS 1.2.6**, András Jankovics. [Source](https://github.com/jankovicsandras/imagetracerjs). The Unlicense / public domain. Used as an npm dependency for local contour tracing; its bundled distribution retains upstream source notices.
- **PptxGenJS 4.0.1**, Brent Ely and contributors. [Source](https://github.com/gitbrent/PptxGenJS). MIT. Used as an npm dependency for native PowerPoint export; its distribution retains upstream notices.
- **JSZip 3.10.1**, Stuart Knightley and contributors. [Source](https://github.com/Stuk/jszip). Dual MIT / GPLv3; used under MIT, including through PptxGenJS. Distribution licenses remain with the dependency.
- **Vite**, Evan You and contributors. [Source](https://github.com/vitejs/vite). MIT. Build/development dependency, not a hosted conversion service.
- **pdf-lib 1.17.1**, Andrew Dillon and contributors. [Source](https://github.com/Hopding/pdf-lib). MIT. Pinned browser ESM distribution and license retained in `src/vendor/pdf-lib/`, downloaded from the versioned jsDelivr npm distribution. Used for native PDF page operations and image embedding.
- **PDF.js / pdfjs-dist 6.4.299**, Mozilla Foundation and contributors. [Source](https://github.com/mozilla/pdf.js). Apache-2.0. Pinned browser module, worker and license retained in `src/vendor/pdfjs/`, downloaded from the versioned jsDelivr npm distribution. Self-hosted at runtime; used for local PDF rendering and selectable text extraction.

Full license texts are shipped under `public/licenses/`, including [pdf-lib](public/licenses/pdf-lib.txt) and [PDF.js](public/licenses/pdfjs.txt), as well as their vendored source directories. Transitive dependencies retain their own licenses. Academic references in `docs/research.md` are conceptual acknowledgements: source-only checkouts were inspected privately, but their code is not integrated into this app. We did not download their weights, reproduce experiments, or claim equivalent performance.

The included diagram and UI artwork are original authored examples; they contain no third-party paper figures or confidential manuscripts.
