# One problem, two deliverables

Image2Other is the engineering surface for a research question: **how can a raster scientific figure become an editable document without silently changing its meaning?** The product must work before a learning claim is made. A useful product is not evidence of novelty, and a polished demo is not a research evaluation.

## Shared acceptance criteria

| Capability | Product requirement | Research measurement |
| --- | --- | --- |
| Read labels | Inspect source crops; correct before export | Exact label match and character error, separately for formulas and languages |
| Replace glyphs | Native SVG text / PPTX text boxes, without duplicate old glyphs | Editable-label coverage, residual glyphs, placement error |
| Preserve artwork | Don't silently erase overlapping lines or shapes | Changed protected pixels/objects, including changes inside text boxes |
| Edit a module | Eventually move/resize a component with its real attachments | Label ownership and directed connectivity after predefined edits |
| Limit repair | Eventually change only the justified region, with undo | Unaffected-region change, successful edits, latency and confirmation burden |

The first three are the immediate engineering priority. Component ownership, attached connectors and learned local repair are **not implemented**. Image/document conversion remains useful supporting infrastructure, not the research contribution.

## Current evidence: isolate text removal

Run from the repository root:

```sh
npm run diagnose:ocr
node scripts/ocr-diagnostic.mjs --json
```

The runner creates nine small, original raster counterexamples in memory. It supplies labels and boxes directly, so **no OCR inference is run**. It compares the previous flat-perimeter rule, the default crossing-stroke guard, a connected-component protection proposal with simulated approval, and a reference pixel-ownership control on exactly the same pixels, labels, confidence threshold and native export path. The reference keeps all non-text-only pixels using unavailable authored provenance, and is restricted to eligible flat backgrounds. This isolates the masking decision; it cannot estimate OCR accuracy or general diagram performance. These developer-designed cases are not independent samples, a held-out benchmark or a training dataset. Simulated confirmation is not a user study or an automatic product result.

Observed on 2026-10-12: the previous rule erases 80 and 32 protected pixels in the horizontal and vertical crossing cases. The guard changes zero protected pixels in these cases by refusing replacement. Clean white/transparent cases still replace the label. However, a contained rule loses 68 pixels and a diagonal loses 80 under both methods. A supplied high-confidence wrong label is still exported incorrectly. These failures remain visible in the runner and tests.

Refusal is **not** successful reconstruction: its editable-text coverage and glyph removal are zero. Zero changes outside a box also do not imply artwork preservation, because important connectors can pass through that box. This is why the report keeps those quantities separate.

The component proposal changes zero artwork pixels and removes all text-only glyph pixels in the horizontal, vertical and contained-rule cases. These gains are explained by a simple connected-component baseline, not a learning contribution. In the diagonal case, it preserves the artwork but removes only 22.4% of text-only pixels: the joined component leaves old glyphs behind. The reference-ownership control removes all recoverable glyphs without changing artwork in that case. Neither fixes a supplied wrong label. `completeLabelRecovery` requires correct native text, all text-only glyphs removed and no protected-artwork damage; it does not score font fidelity, placement or downstream relations. Shared glyph/line pixels belong to protected artwork and are excluded from recoverable text-only ink.

A separate local qualitative check used the existing 858×394 MM overview figure from the personal homepage, with eight visually checked label strings. Diagram segmentation produced 93 regions (37 default-selected before the identifier guard); document segmentation produced 28 (2 selected). Several small labels were absent or fragmented, and `(B)` became `(8)` at confidence about 90 with default replacement selected. Region counts/string presence are not OCR accuracy or end-to-end recovery: annotations are incomplete, the source is one developer-selected figure, and processing order was fixed. This finding motivated the short-identifier review heuristic, not a claim of learned accuracy. One-character Latin/digit labels and their parenthesized/bracketed forms now require explicit selection. The text is not silently corrected. The ignored local probe and report remain outside the released tests/data; no image was uploaded or newly downloaded.

Repeating that local probe after the guard yielded the same recognized strings: diagram default selection fell from 37 to 35, including the confident `(8)` error becoming unselected; document mode remained at 2. This is a conservative decision change at lower coverage, not improved recognition, an independent replication or evidence of broad reliability. Full truth/correctness annotations and matched risk/coverage evaluation remain missing.

## New product control: inspect before committing

Review mask makes this intermediate step visible: source crop with erase/protect overlay, masked artwork preview, optional component proposal, protect/clear brushes and undo/reset. Only confirmation saves; closing discards the draft. Confirmed masks may override the axis-aligned-stroke refusal, not a mixed background. Protection from all active labels is combined before removal, so a later overlapping label cannot erase already protected pixels. Unselected labels do not contribute protection. Each crop preview shows its own draft, not other labels' masks; inspect the combined build too. The original refusal reason remains in review logs. Every mask is tied to the original box, with bounded pixel area/stroke count/point count/rasterization work. User confirmation is manual intervention, not an automatic success, calibrated confidence or verified annotation. The preview deliberately precedes native text, so residual old glyphs are not concealed by a new text box. These pixel checks precede contour tracing; final vector fidelity is not guaranteed by them.

## Next experiments, in order

1. **Measure the real bottleneck.** Use a small, licensed set of complete figures with verified text, word boxes and protected artwork. Run the current engine normally, then with reference text only, then with reference text and boxes. Keep resolution/segmentation fixed. These paired controls distinguish recognition errors, box errors and removal damage. Reference input is an upper-bound diagnostic, not a deployable method.
2. **Recover, rather than only refuse.** Compare rectangular fill, conservative refusal and a text-ink mask/local background reconstruction on identical OCR outputs. Include a reference glyph-mask control. Test crossings, contained strokes, textured backgrounds and tight/clipped boxes. Measure residual glyphs and lost artwork jointly; a method that keeps all pixels or replaces nothing cannot win by preservation alone.
3. **Test a learned gate only if needed.** Independently annotate whether recognition is correct, whether the box is adequate and whether replacement damages artwork. Compare confidence-only, the existing heuristic, a small logistic model and XGBoost on fixed upstream OCR. Match confirmation burden or coverage and include feature-extraction/runtime costs. A better classifier here is an engineering result until a distinct learning contribution and nearest-work comparison support more.
4. **Reconnect to downstream editing.** Once text replacement is reliable, recover label ownership and connector attachment candidates. Compare simple geometry/snapping, supplied-graph controls and any learned relation scorer on the same move/resize/rename tasks. The research hypothesis is whether edit-response supervision helps at matched budget beyond ordinary edge classification and abstention—not whether graphs or local repair are new.

For each study, split by original figure/family, not by crops or edits of the same figure. Freeze the final test families before tuning; do not treat the nine developer counterexamples as held-out evidence. All methods process every figure, with seeded randomized order within a figure when runtime/model sessions matter. Keep fonts, languages, source sizes, engine/version, preprocessing, hardware and costs recorded. Repeated edits/runs are nested measurements of a figure, not extra independent samples. Blind manual checks to method where practical. Record failure and refusal, not just successful exports.

**Continue** when recurring real failures survive simple controls and the proposed mechanism improves successful safe edits at matched coverage/cost. **Narrow or stop** when the gain is explained by a better OCR engine, more compute, threshold tuning or extra user corrections. No effect size, statistical significance, superiority or ICML-level contribution is established by this diagnostic.

## Annotation and privacy contract

Review JSON v2 records engine observations, replacement refusal reasons and local edits. It is explicitly `annotationStatus: "unverified"`. A changed string has `textChangeKind: "unspecified"`: renaming “Model” to “Encoder” is not automatically an OCR correction. Training requires separate verified labels and explicit data permission; a checkbox or an exported review log is not ground truth. No examples are collected automatically or sent to a server.

Confirmed mask instructions are recorded separately, including protected pixel runs and brush strokes. A saved mask means the user approved an operation, not that it is correct. Report automatic conversion, simulated approval and actual human correction as different conditions; include correction time and refusal. Do not train directly on these records without additional annotation and permission.

## Research decision gate: uncertainty relevant to the requested edit

The narrow candidate is **edit-conditioned uncertainty**, not full program recovery at all costs. Let a candidate document `g` produce response `R(g,e)` to a requested edit `e`. Documents with the same response can be treated as equivalent for that edit, even if unrelated attachments differ. If two documents render identically now but respond differently to `e`, the pixels alone cannot determine the intended result. Preserving the meaning may require clarification rather than another reconstruction pass. This observation is not a new impossibility theorem or a complete algorithm.

The next minimal test should hold OCR/text/boxes fixed and compare a geometry-only scorer, edge-supervised small scorer, ordinary confidence abstention, whole-candidate entropy queries, and edit-response-based scoring/queries. Use identical candidate sets first to isolate selection, then test candidate generation end-to-end. Evaluate by intended-document family, with both identifiable and deliberately indistinguishable renders and relevant/irrelevant ambiguity. Query answers come from known authored ownership/attachments in simulation; real human answers and error rates need a separate study.

The selection objective should be **reduction in error for this edit per unit confirmation cost**, rather than entropy over every hidden detail. Full-document entropy can spend queries on dependencies that do not affect the requested change. This is a standard decision-theoretic/value-of-information construction, not claimed novelty. [Active program synthesis](https://arxiv.org/abs/2006.12638) already selects informative user queries; [interactive inverse modeling](https://graphics.cs.berkeley.edu/papers/Andrews-II3-2012-06/) already reconstructs parameters suited to intended modifications. Both are required conceptual baselines. The possible learning delta is whether edit-response supervision generalizes to unseen diagram families and new edits beyond those baselines at matched cost; that has not been tested.

Report correct executed edits per attempted edit, wrong executed edits, abstentions, query count/time and collateral changes jointly. Also report whether the intended document is missing from the candidate set. Agreement among wrong candidates must count as a failure, not a safety certificate. Include candidate-omission stress tests and a supplied-intended-document control; do not hide omissions through abstention. A small model/XGBoost is worth testing only after the simple mechanism baseline leaves a recurring, measurable gap.

**Stop this research variant** if response-aware selection has no advantage over confidence/geometry/active-query baselines at matched coverage and cost, if gains disappear when OCR and human corrections are matched, or if candidate omission dominates error. Do not equate this plan, UI improvement or nine synthetic diagnostic cases with an ICML Oral-level contribution. No held-out real-figure study, learned reconstruction, calibrated guarantee or automatic attached-connector pipeline has been demonstrated.

No new model downloads, training or paid API runs are part of this plan. Keep experiments small until the diagnostic justifies more resources. The [reading map](research.md) records nearby work and direct overlaps; the ignored local manuscript remains pre-experimental and must not present these software checks as benchmark results.

## Engineering release gate

Every new reconstruction behavior needs a failing regression case, implementation, unit checks, actual browser/export checks and stated limitations. Run `npm test`, `npm run diagnose:ocr`, `npm run build` and the browser tests described in the README. Keep the project deployment independent of the personal homepage. Improve supported conversions first; never advertise an unimplemented button as a conversion backend.
