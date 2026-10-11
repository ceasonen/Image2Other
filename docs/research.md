# Research and implementation provenance

Checked 2026-10-12. Primary paper/project sources only. This is an engineering reading record, not a benchmark or a claim of a new vectorization method.

| Reference | Verified source | Lesson for Image2Other | Integration status |
| --- | --- | --- | --- |
| ImageTracerJS | [Author's repository](https://github.com/jankovicsandras/imagetracerjs), including the tracing process, options, and public-domain license | Color quantization and contour tracing can run in a browser worker without uploading source files | Used as a pinned npm dependency. Its trace geometry becomes our validated scene |
| VTracer | [Author's repository](https://github.com/visioncortex/vtracer) and [technical description](https://www.visioncortex.org/vtracer-docs) | Color stacking and compact contours are useful alternatives to large raw paths | Read for algorithm/design context only. No Rust implementation or binaries copied |
| StarVector: Generating Scalable Vector Graphics Code from Images and Text | [CVPR 2025 paper](https://openaccess.thecvf.com/content/CVPR2025/papers/Rodriguez_StarVector_Generating_Scalable_Vector_Graphics_Code_from_Images_and_Text_CVPR_2025_paper.pdf), [author's repository](https://github.com/joanrod/star-vector) | Structured primitives and text matter for meaningful editing, not just pixel similarity | Motivates the semantic scene route. No weights downloaded or model integrated; the app uses the user's compatible provider |
| Towards Layer-wise Image Vectorization | [arXiv record](https://arxiv.org/abs/2206.04655), [CVPR 2022 authors' code](https://github.com/Picsart-AI-Research/LIVE-Layerwise-Image-Vectorization) | Layer structure and path count should be considered alongside visual appearance | Research reference only; no optimization pipeline copied or claimed |
| OmniSVG: A Unified Scalable Vector Graphics Generation Model | [arXiv record](https://arxiv.org/abs/2504.06263), [authors' project](https://github.com/OmniSVG/OmniSVG) | Image-to-SVG models are another future provider route | Research reference only; no weights, data, or code copied |
| Image-to-PPT | [Maintainer's repository](https://github.com/7zSun/Image-to-PPT), Apache-2.0 | OCR/layout/detection/segmentation can offer a local semantic reconstruction route | Workflow reference only. Our initial app does not implement or advertise this pipeline |
| FigEdit | [Maintainer's repository](https://github.com/giszzt/figedit), MIT with upstream notices | SVG-to-PPTX should create native individual objects, with honest fallback reporting | Workflow reference only; no exporter copied |
| PptxGenJS | [Official repository](https://github.com/gitbrent/PptxGenJS), [native-shape documentation](https://gitbrent.github.io/PptxGenJS/docs/api-shapes.html), [maintainer's custom geometry example](https://github.com/gitbrent/PptxGenJS/blob/master/demos/modules/demo_shape.mjs) | Native custom geometry can retain multiple contours and quadratic/cubic curves | Used as a pinned npm dependency. Our scene-to-native-shape adapter is original |

## Implemented architecture

```text
Local raster input
  ├─ ImageTracerJS worker → validated paths ─┐
  ├─ consent + user's vision API → scene ──┼─ shared scene editor → SVG / native PPTX / JSON
  └─ browser canvas → PNG / JPEG / WebP    │
                 Imported scene JSON ────┘
```

The scene schema accepts only rectangles, ellipses, lines, text, and absolute M/L/Q/C/Z paths, with finite coordinates and restricted solid colors. It never accepts scripts, arbitrary SVG strings, image URLs, HTML, or raster nodes. Browser-origin tracing preserves alpha and hole contours. Both SVG and PowerPoint use the same geometry rather than independently hallucinated outputs.

## What we have verified

Unit tests inspect the generated PPTX ZIP/XML for native text and custom geometry, multiple subpaths, quadratic curves, and absence of raster media. Browser tests run tracing on an authored raster sample, inspect actual downloaded vector files, edit a scene label, export each implemented format, and check five responsive widths and a very narrow image. Both the native-shape example and actual traced-path PPTX were opened and rendered with LibreOffice for release QA; this is not a check of every PowerPoint version. Provider request/response handling is tested with mocks, not a live model. These establish functionality; they do not measure reconstruction accuracy on general images.

No third-party model weights or large datasets were downloaded. We did not fork an existing product or copy its interface. No quantitative comparison or superiority claim is supported yet.

## What a useful future evaluation needs

Use a small, licensed paired set covering diagrams, icons, charts, formulas, and complex illustrations. Record source/output dimensions, model/provider settings, time and API cost where applicable. Evaluate visual fidelity separately from text correctness, editable-text recovery, object count, path count, and ability to move/restyle a meaningful component. Report failures and raster fallbacks explicitly. Do not treat an authored demo scene as an automatic recovery result.
