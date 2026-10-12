# Figure spec: response-only supervision

- Figure ID: `fig:response`
- Section: Introduction
- Placement: full-width
- Archetype: comparison schematic plus pipeline flow
- Backend: TikZ
- Claim: an initial raster can hide edit-divergent bindings; real edited states supervise latent bindings without edge annotations.
- Narrative role: show the ambiguity, then show where external evidence enters training and what is available at test time.
- Components: one common initial layout; one module move; two alternative label responses; initial raster and objects; observed edited states; relation scorer; candidate executor; execute/query decision.
- Connections: one move is shown with two mutually exclusive responses; image/objects enter scorer; observed states enter response likelihood; scorer enters executor; executor enters decision.
- Flow: left-to-right within two labeled rows. The top row is a worked ambiguity, the lower row separates training and inference.
- Size target: ICML two-column text width, approximately 6.75 inches; labels at 8 pt or above.
- Color: blue for input/learned relation, green for externally observed response, red for unresolved disagreement, gray for context. White background; no decorative fills.
- Caption: Equal initial pixels can lead to different edited states. Source edits supervise the latent relation scorer; test-time agreement is conditional on retained candidates.
- TikZ source: `figures/fig_response.tex`
- Generated: 2026-10-13
- Critique: visually inspected after compilation. Both outcomes are marked as the same move from the common initial layout. A/B are external schematic IDs above the boxes, not text introduced into the edited graphics; the caption states this explicitly. Labels remain legible at print scale.
