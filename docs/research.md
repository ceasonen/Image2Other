# Research and implementation provenance

Checked 2026-10-12. Primary paper/project sources only. This is an engineering reading record, not a benchmark or a claim of a new vectorization method.

| Reference | Verified source | Lesson for Image2Other | Integration status |
| --- | --- | --- | --- |
| ImageTracerJS | [Author's repository](https://github.com/jankovicsandras/imagetracerjs), including the tracing process, options, and public-domain license | Color quantization and contour tracing can run in a browser worker without uploading source files | Used as a pinned npm dependency. Its trace geometry becomes our validated scene |
| VTracer | [Author's repository](https://github.com/visioncortex/vtracer) and [technical description](https://www.visioncortex.org/vtracer-docs) | Color stacking and compact contours are useful alternatives to large raw paths | Read for algorithm/design context only. No Rust implementation or binaries copied |
| StarVector: Generating Scalable Vector Graphics Code from Images and Text | [CVPR 2025 paper](https://openaccess.thecvf.com/content/CVPR2025/papers/Rodriguez_StarVector_Generating_Scalable_Vector_Graphics_Code_from_Images_and_Text_CVPR_2025_paper.pdf), [author's repository](https://github.com/joanrod/star-vector) | Structured primitives and text matter for meaningful editing, not just pixel similarity | Motivates the semantic scene route. No weights downloaded or model integrated; the app uses the user's compatible provider |
| Towards Layer-wise Image Vectorization | [arXiv record](https://arxiv.org/abs/2206.04655), [CVPR 2022 authors' code](https://github.com/Picsart-AI-Research/LIVE-Layerwise-Image-Vectorization) | Layer structure and path count should be considered alongside visual appearance | Research reference only; no optimization pipeline copied or claimed |
| OmniSVG: A Unified Scalable Vector Graphics Generation Model | [NeurIPS 2025 proceedings](https://papers.nips.cc/paper_files/paper/2025/hash/a510f05a574d4203ef3952973672fe2f-Abstract-Conference.html), [authors' project](https://github.com/OmniSVG/OmniSVG) | Image-to-SVG models are another future provider route | Research reference only; no weights, data, or code copied |
| Image-to-PPT | [Maintainer's repository](https://github.com/7zSun/Image-to-PPT), Apache-2.0 | OCR/layout/detection/segmentation can offer a local semantic reconstruction route | Workflow reference only; no pipeline copied. Our browser OCR/masking route does not implement its detection/segmentation stack |
| FigEdit | [Maintainer's repository](https://github.com/giszzt/figedit), MIT with upstream notices | SVG-to-PPTX should create native individual objects, with honest fallback reporting | Workflow reference only; no exporter copied |
| PptxGenJS | [Official repository](https://github.com/gitbrent/PptxGenJS), [native-shape documentation](https://gitbrent.github.io/PptxGenJS/docs/api-shapes.html), [maintainer's custom geometry example](https://github.com/gitbrent/PptxGenJS/blob/master/demos/modules/demo_shape.mjs) | Native custom geometry can retain multiple contours and quadratic/cubic curves | Used as a pinned npm dependency. Our scene-to-native-shape adapter is original |

## Implemented architecture

```text
Local raster input
  ├─ consent + local OCR → review → guarded masking + trace + native text ─┐
  ├─ ImageTracerJS worker → validated paths ─┐
  ├─ consent + user's vision API → scene ──┼─ shared scene editor → SVG / native PPTX / JSON
  └─ browser canvas → PNG / JPEG / WebP    │
                 Imported scene JSON ────┘

Local PDF / images / PPTX
  ├─ PDF-lib → merge / select / reorder / split / rotate / image PDF
  ├─ PDF.js → page images / text / single page → figure studio
  ├─ rendered PDF pages → PPTX image slides or native text + raster artwork
  └─ bounded PPTX ZIP/XML extraction → slide text / embedded raster images
```

The scene schema accepts only rectangles, ellipses, lines, text, and absolute M/L/Q/C/Z paths, with finite coordinates and restricted solid colors. It never accepts scripts, arbitrary SVG strings, image URLs, HTML, or raster nodes. Browser-origin tracing preserves alpha and hole contours. Both SVG and PowerPoint use the same geometry rather than independently hallucinated outputs.

## What we have verified

Unit tests inspect the generated PPTX ZIP/XML for native text and custom geometry, multiple subpaths, quadratic curves, and absence of raster media. Browser tests run tracing on an authored raster sample, inspect actual downloaded vector files, edit a scene label, export each implemented format, and check five responsive widths and a very narrow image. Both the native-shape example and actual traced-path PPTX were opened and rendered with LibreOffice for release QA; this is not a check of every PowerPoint version. Provider request/response handling is tested with mocks, not a live model. These establish functionality; they do not measure reconstruction accuracy on general images.

The document workspace also has unit and browser checks for actual PDF/PPTX downloads, native text-box XML, text removal from editable-slide backgrounds, page counts/rotation, merge, and PPTX text/media extraction. These check supported formats, not perfect conversion fidelity. PDF artwork remains raster in both PDF-to-slide modes; a scanned page can be sent to the figure studio's local OCR, but bulk scan OCR/searchable-PDF export is not implemented. Word/Excel conversions, Office-to-PDF rendering, encrypted files, and PDF compression are not implemented.

No large research-model weights or datasets were downloaded. The browser OCR uses small Tesseract language resources, described in the README. Eight source-only reference repositories were cloned into an ignored local research workspace for inspection. They are not shipped as conversion backends. No general benchmark comparison or superiority claim is supported yet.

## Research scope update

Our immediate priority is reliable input, conversion, editing, and export—not a paper claim. Connecting a vision API to an SVG/PPTX exporter is useful engineering, but is not by itself an established research contribution.

Additional nearby work checked through the authors' arXiv titles and abstracts on 2026-10-12 (not a full-paper methodological review): [VectorEdits: A Dataset and Benchmark for Instruction-Based Editing of Vector Graphics](https://arxiv.org/abs/2506.15903) covers instruction-guided vector editing; [AmodalSVG: Amodal Image Vectorization via Semantic Layer Peeling](https://arxiv.org/abs/2604.10940) targets independent, geometrically complete semantic layers; [Vector-Bench: Can Models Surgically Edit SVG Code?](https://arxiv.org/abs/2607.19056) separates requested repairs from preservation of other structure. Together with StarVector, these show why “semantic SVG” or “better editability” alone cannot establish novelty.

A research track should start with reproducible failures on small, redistributable examples and a closer review of existing methods. Keep visual fidelity, correct words, meaningful object structure, and successful downstream edits separate. No claim of a novel learning method, benchmark, accepted paper, or venue-level readiness is made here. Existing software tests establish that supported operations run, not that image understanding is solved.

## What a useful future evaluation needs

Use a small, licensed paired set covering diagrams, icons, charts, formulas, and complex illustrations. Record source/output dimensions, model/provider settings, time and API cost where applicable. Evaluate visual fidelity separately from text correctness, editable-text recovery, object count, path count, and ability to move/restyle a meaningful component. Report failures and raster fallbacks explicitly. Do not treat an authored demo scene as an automatic recovery result.

## Closest published work: a focused reading map

Updated 2026-10-12 after checking publisher records, author repositories, selected paper sections, and source entry points. This is not an exhaustive review. Method, evaluation, and limitations sections were inspected for SliDer, AutoFigure-Edit, StarVector, and VectorHarness, using their linked arXiv versions; final venues were checked separately where applicable. Other entries below are abstract/project-page or README-level readings, not reproduced results. None of these additional models is integrated.

| Problem | Work and verified publication status | What to borrow or investigate |
| --- | --- | --- |
| Raster slides → editable document | [SliDer, AAAI 2026](https://ojs.aaai.org/index.php/AAAI/article/view/42464) | Spatial priors and explicit text/image assets; account for raster assets in the output |
| Scientific figure generation → editable layout | [AutoFigure, ICLR 2026](https://iclr.cc/Downloads/2026) and [AutoFigure-Edit, ACL 2026 System Demonstrations](https://aclanthology.org/2026.acl-demo.6/) | The two papers have different venues and tasks. Structural indexing and appearance extraction are useful engineering references |
| Raster/text → SVG primitives | StarVector, CVPR 2025; OmniSVG, NeurIPS 2025 (sources above) | Primitive-aware representations instead of treating every component as a contour |
| Layered reconstruction | [LayerTracer, ICCV 2025](https://openaccess.thecvf.com/content/ICCV2025/html/Song_LayerTracer_Cognitive-Aligned_Layered_SVG_Synthesis_via_Diffusion_Transformer_ICCV_2025_paper.html); LIVE, CVPR 2022; AmodalSVG, arXiv preprint (above) | Layer organization, geometry optimization, and geometrically complete semantic layers already have prior art |
| Raster charts → structured editing | [Chart2SVG, accepted at VIS 2026 according to its author project page](https://yunhaiwang.net/vis2026/Chart2SVG/index.html) | Semantic chart components, dependency graphs, and rendering-aware training already exist |
| Practical raster → PPTX | Image-to-PPT (repository above; no conference claim) | The current source includes geometric arrow/connector inference and snapping. This is a necessary simple relation baseline, even where README descriptions lag behind the code |
| Relation-preserving scientific reconstruction | [VectorHarness, September 2026 preprint](https://arxiv.org/abs/2609.13294), [official repository](https://github.com/CSU-JPG/Edit_Agent) | Native objects, operational relations, affected-region repair and deterministic exports directly overlap the original graph/local-repair idea. Its inspected repository contains a short README, not runnable implementation |
| Editing existing vectors | VectorEdits and Vector-Bench (preprint records above) | Preservation and surgical changes are nearby prior art, not automatic novelty |

### SliDer: learn layout before polishing appearance

For raster slides, contour tracing loses editable words and document structure. SliDer addresses this by fine-tuning VLMs with SVG templates, optional detector-derived boxes, and previous predictions. Its reported slide experiments support text/layout recovery; the ablation shows that visual refinement need not improve box alignment. The practical insight is to ground layout rather than assume repeated prompting fixes everything. Its output retains cropped PNG assets, not exclusively native vectors. The [official repository](https://github.com/adamhazimeh/SliDer) still labels code as forthcoming on the check date. For Image2Other this is a method reference, not an available backend. [Method and ablation](https://arxiv.org/html/2511.13478v1)

### AutoFigure-Edit: separate structure from appearance

Scientific illustrations need both controllable layout and preserved visual style. AutoFigure-Edit decomposes a raster draft into indexed components, extracts transparent image assets, generates/refines an SVG template, and inserts those assets. The paper reports generation evaluations and a usability study, including PNG-to-SVG feedback; these are not our own native-PPTX accuracy measurements. Its limitations include foundation-model dependence and cascading segmentation errors. The useful lesson is stable component identity. Its hybrid output can preserve artwork without converting that artwork into editable paths. [Method, evaluation, and limitations](https://arxiv.org/html/2603.06674v1) · [Official code](https://github.com/ResearAI/AutoFigure-Edit)

### StarVector: select meaningful primitives

When text or circles become many paths, visual resemblance does not imply useful structure. StarVector connects image encoding to autoregressive SVG-code generation, learning primitive selection from paired examples. Its diagram results illustrate disagreements between pixel and perceptual metrics. The authors identify context-length, image-resolution, and non-standard-SVG limitations. Borrow the representation and evaluation lessons, not an unsupported claim that a generic API reproduces its model. [Method, results, and limitations](https://arxiv.org/html/2312.11556v4)

## Engineering priorities, not research claims

1. Recover text and layout before adding more export extensions. OCR and region proposals should support an inspectable scene, not silently overwrite labels.
2. Add component grouping and stable IDs so moving a module does not mean selecting hundreds of unrelated paths. Connector endpoints need their own representation and verification.
3. Diagnose rendered discrepancies and propose limited changes, with a visible diff and undo. Existing refinement systems make this an engineering improvement until a distinct mechanism is demonstrated.
4. Keep strict-vector and future hybrid reconstruction separate. Hybrid assets can be valuable, but the interface must disclose which elements are text, native shapes, paths, or pixels. The current scene remains strict-vector; arbitrary SVG/HTML from papers cannot be imported safely as-is.

Text-first OCR/review/native-text export is now implemented with a conservative background/crossing-stroke gate. A local mask editor adds inspectable protection suggestions, brushes and explicit confirmation. Its connected-component rule is not trained segmentation: joined text/lines can retain old glyphs. Grouping, attached connectors and semantic local repair remain future work. Read component/model licenses and attribution terms before reusing code or assets; a repository license does not automatically cover weights, datasets, trademarks, or every dependency.

## Candidate research questions, not established innovations

Our working concern is that a convincing rendering can hide an incorrect document. We have not yet demonstrated that this is a frequent failure of the closest methods.

| Candidate | Testable hypothesis | Closest-work warning / reason to stop |
| --- | --- | --- |
| Edit-consistent diagram recovery | Explicit, source-grounded attachment constraints reduce broken relationships after moving a module, without inventing connections | VectorHarness directly covers relation-preserving reconstruction and affected-region repair; Chart2SVG uses dependency graphs. This is not a stand-alone novel contribution |
| Budgeted local repair | Selecting specific uncertain objects for repair reduces collateral changes at matched cost compared with whole-document refinement | VectorHarness, SliDer and AutoFigure-Edit already cover related refinement. Ordinary local repair is not the research delta |
| Critical-content preservation | Separately verifying labels and arrow direction detects scientific errors that a visual-similarity score misses | Existing text/structure metrics cover part of this problem. Stop if the remaining benefit is only a UI checklist or ordinary OCR |
| Selective edit-response recovery | A small relation scorer trained on edit responses, paired with candidate-disagreement checks, reduces incorrect executed edits at useful coverage and limited confirmation burden | A candidate direction, not established novelty. Audit selective prediction/active querying; compare geometry, edge loss only and threshold abstention. Candidate omission can invalidate apparent agreement |

The refined question is **when uncertain reconstructed dependencies support a safe downstream edit, and when the system should ask for a minimal clarification**. Different hidden programs can have identical initial renders but different edit responses. Local prototype checks demonstrate this possibility and conditional closure propagation with supplied graphs; they do not recover graphs from pixels, train a model, or estimate real-world accuracy. Candidate agreement is conditional on retaining the intended graph. Format conversion remains an engineering deliverable, not evidence of an ICML contribution.

The selective-learning boundary matters too: [SOLA, ICML 2018](https://proceedings.mlr.press/v80/garcia18a.html) permits abstention on structured labels; [reject-option strategies, JMLR 2023](https://www.jmlr.org/papers/v24/21-0048.html) include structured outputs; [risk-controlling prediction sets](https://arxiv.org/abs/2101.02703) calibrate set-valued uncertainty. Ordinary abstention, uncertainty sets and risk/coverage plots are not new contributions. The proposed learning question needs matched selective baselines, candidate-omission accounting, and an active-query audit.

Additional checks on 2026-10-12 narrow the novelty boundary further. [Information-theoretic User Interaction, 2020 preprint](https://arxiv.org/abs/2006.12638) already studies selecting informative queries among consistent programs (abstract inspected). [Interactive Inverse 3D Modeling, CAD 2012](https://graphics.cs.berkeley.edu/papers/Andrews-II3-2012-06/) recovers editable parameterizations chosen for intended modifications (author project abstract inspected). Neither is a raster-scientific-diagram method, but asking questions and recovering task-suitable programs cannot be claimed as new. [SciDiagramEdit, July 2026 preprint](https://arxiv.org/html/2607.15272v1) learns scientific-vector editing from natural paper revisions; abstract/introduction inspected, not reproduced. Edit-response supervision needs comparison with revision-based learning rather than assuming edited pairs are novel training data. [Fig2Slide](https://github.com/Yutao-Yang/fig2slide) is a maintainer-described OCR/geometry-grounded native reconstruction workflow (README inspected); it is an engineering reference, not a reproduced conference method or deployed backend here.

### A small diagnostic before training

Use self-authored, redistributable diagrams with known text, object IDs, and connector endpoints. Keep a discovery set separate from held-out cases; variants of one underlying diagram must remain in the same split. Initial case counts are for diagnosis, not powered statistical claims.

Every method should receive the same raster inputs and predefined edits, such as replacing a label or moving one connected block. Compare a one-pass provider, a simple OCR/layout baseline when available, whole-scene refinement, and a candidate local-repair variant with the same provider/version, resolution, and stated call/token budget. Do not label an unavailable paper implementation as a reproduced baseline.

Treat the original diagram as the independent unit: repeated runs and multiple edits are nested measurements, not extra independent samples. Randomize processing order with a recorded seed, distribute methods across API sessions, and blind manual output checks. Separately record label correctness, directed connectivity, unaffected-object preservation, visual error, latency/cost, and native PPTX object validity. Include clean-source exports as a positive control for the edit/export checks.

Continue only if recurring failures survive strong simple alternatives and the proposed mechanism addresses them without sacrificing correctness elsewhere. Otherwise narrow the product scope or abandon that research hypothesis. No real-figure downstream-edit evaluation has been run yet. A nine-case developer masking diagnostic now isolates rectangle-removal damage with supplied labels/boxes; it is not OCR inference, a held-out benchmark or evidence of the selective-learning hypothesis. See the [engineering/research contract](development-contract.md) for actual observations, known failures and the staged experimental design. No training, large model-weight download, or large-data transfer is authorized by this plan.
