# Working paper

**Learning Editable Diagram Relations from Edit Responses** is a pre-experimental research draft, not an accepted paper or a completed submission. It specifies a response-supervised relation learner, a conditional execution rule, and the independent-source experiments needed to test them. It reports no trained model or reconstruction benchmark result.

- [Read the PDF](main.pdf)
- [LaTeX source](main.tex)
- [Vector figure source](figures/fig_response.tex)
- [Bibliography](references.bib)

The included `style/icml2026.sty` and `style/icml2026.bst` are a working copy of the 2026 ICML style. Submission to a future edition requires checking that edition's current instructions and template.

To compile with a local LaTeX installation:

```sh
latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex
```

Small supplied-rule software checks live in `../prototype/`. They verify executor behavior and counterexamples, not raster-to-graph learning or empirical superiority.
