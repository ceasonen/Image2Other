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

The runner creates nine small, original raster counterexamples in memory. It supplies labels and boxes directly, so **no OCR inference is run**. It compares the previous flat-perimeter rule with the new crossing-stroke guard on exactly the same pixels, labels, confidence threshold and native export path. This isolates the masking decision; it cannot estimate OCR accuracy or general diagram performance. These developer-designed cases are not independent samples, a held-out benchmark or a training dataset.

Observed on 2026-10-12: the previous rule erases 80 and 32 protected pixels in the horizontal and vertical crossing cases. The guard changes zero protected pixels in these cases by refusing replacement. Clean white/transparent cases still replace the label. However, a contained rule loses 68 pixels and a diagonal loses 80 under both methods. A supplied high-confidence wrong label is still exported incorrectly. These failures remain visible in the runner and tests.

Refusal is **not** successful reconstruction: its editable-text coverage and glyph removal are zero. Zero changes outside a box also do not imply artwork preservation, because important connectors can pass through that box. This is why the report keeps those quantities separate.

## Next experiments, in order

1. **Measure the real bottleneck.** Use a small, licensed set of complete figures with verified text, word boxes and protected artwork. Run the current engine normally, then with reference text only, then with reference text and boxes. Keep resolution/segmentation fixed. These paired controls distinguish recognition errors, box errors and removal damage. Reference input is an upper-bound diagnostic, not a deployable method.
2. **Recover, rather than only refuse.** Compare rectangular fill, conservative refusal and a text-ink mask/local background reconstruction on identical OCR outputs. Include a reference glyph-mask control. Test crossings, contained strokes, textured backgrounds and tight/clipped boxes. Measure residual glyphs and lost artwork jointly; a method that keeps all pixels or replaces nothing cannot win by preservation alone.
3. **Test a learned gate only if needed.** Independently annotate whether recognition is correct, whether the box is adequate and whether replacement damages artwork. Compare confidence-only, the existing heuristic, a small logistic model and XGBoost on fixed upstream OCR. Match confirmation burden or coverage and include feature-extraction/runtime costs. A better classifier here is an engineering result until a distinct learning contribution and nearest-work comparison support more.
4. **Reconnect to downstream editing.** Once text replacement is reliable, recover label ownership and connector attachment candidates. Compare simple geometry/snapping, supplied-graph controls and any learned relation scorer on the same move/resize/rename tasks. The research hypothesis is whether edit-response supervision helps at matched budget beyond ordinary edge classification and abstention—not whether graphs or local repair are new.

For each study, split by original figure/family, not by crops or edits of the same figure. Freeze the final test families before tuning; do not treat the nine developer counterexamples as held-out evidence. All methods process every figure, with seeded randomized order within a figure when runtime/model sessions matter. Keep fonts, languages, source sizes, engine/version, preprocessing, hardware and costs recorded. Repeated edits/runs are nested measurements of a figure, not extra independent samples. Blind manual checks to method where practical. Record failure and refusal, not just successful exports.

**Continue** when recurring real failures survive simple controls and the proposed mechanism improves successful safe edits at matched coverage/cost. **Narrow or stop** when the gain is explained by a better OCR engine, more compute, threshold tuning or extra user corrections. No effect size, statistical significance, superiority or ICML-level contribution is established by this diagnostic.

## Annotation and privacy contract

Review JSON v2 records engine observations, replacement refusal reasons and local edits. It is explicitly `annotationStatus: "unverified"`. A changed string has `textChangeKind: "unspecified"`: renaming “Model” to “Encoder” is not automatically an OCR correction. Training requires separate verified labels and explicit data permission; a checkbox or an exported review log is not ground truth. No examples are collected automatically or sent to a server.

No new model downloads, training or paid API runs are part of this plan. Keep experiments small until the diagnostic justifies more resources. The [reading map](research.md) records nearby work and direct overlaps; the ignored local manuscript remains pre-experimental and must not present these software checks as benchmark results.

## Engineering release gate

Every new reconstruction behavior needs a failing regression case, implementation, unit checks, actual browser/export checks and stated limitations. Run `npm test`, `npm run diagnose:ocr`, `npm run build` and the browser tests described in the README. Keep the project deployment independent of the personal homepage. Improve supported conversions first; never advertise an unimplemented button as a conversion backend.
