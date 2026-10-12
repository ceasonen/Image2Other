# Local PaddleOCR, auxiliary to SVG reconstruction

The product remains image → reviewed native text + vector artwork → editable SVG. PaddleOCR is an optional text detector/recognizer. It does not replace contour tracing, infer figure semantics or certify correct labels. The GitHub Pages website cannot host Python inference; each user runs the service on their own machine.

## Current status

Implemented: loopback client/service, explicit consent, session authentication, bounded input, PaddleOCR 3.x result adapter, offline JSON import and the shared review/masking/native export workflow. The browser transport test still uses an **injected fake recognizer**; real Tesseract OCR is separately browser-tested. On one Apple Silicon Mac, PaddlePaddle 3.2.1 + PaddleOCR 3.7.0 with the official PP-OCRv5 mobile detection/recognition pair now initialized and recognized authored English test figures, including `Figure 1: Editable SVG`, `Accuracy 92.02%`, and an actual HTTP `/ocr` request for `Editable research figure`. A real model polygon was slightly slanted; the import adapter now accepts near-horizontal boxes while continuing to reject clearly rotated text. **This is a smoke test, not a model accuracy comparison, broad figure evaluation, or XGBoost training.** No new dataset was downloaded.

## Provisioning is explicit

The project does not download dependencies or models automatically. Use a separate Python 3.11 environment and the [official PaddleOCR installation guide](https://www.paddleocr.ai/main/en/version3.x/installation.html); the [Apple Silicon guide](https://www.paddleocr.ai/v3.6.0/en/version3.x/pipeline_usage/PaddleOCR-VL-Apple-Silicon.html) documents native PaddlePaddle installation on that hardware. The exact local smoke-test setup was:

```sh
uv venv --python 3.11 .build/paddle-env
uv pip install --python .build/paddle-env/bin/python --index-url https://www.paddlepaddle.org.cn/packages/stable/cpu/ paddlepaddle==3.2.1
uv pip install --python .build/paddle-env/bin/python paddleocr==3.7.0
```

This installed only the base OCR package, not `paddleocr[all]` or a vision-language model. On the tested Mac the isolated environment occupied about 836 MB, including transitive Python dependencies. The two official [PP-OCRv5 mobile inference models](https://www.paddleocr.ai/main/en/version3.x/pipeline_usage/OCR.html#1-ocr-pipeline-introduction) together occupied about 21 MB after extraction. Download only the detection and recognition **inference** archives, not pretrained/training weights:

```sh
mkdir -p .build/paddle-models
curl -fL 'https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv5_mobile_det_infer.tar' -o .build/paddle-models/PP-OCRv5_mobile_det_infer.tar
curl -fL 'https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv5_mobile_rec_infer.tar' -o .build/paddle-models/PP-OCRv5_mobile_rec_infer.tar
tar -xf .build/paddle-models/PP-OCRv5_mobile_det_infer.tar -C .build/paddle-models
tar -xf .build/paddle-models/PP-OCRv5_mobile_rec_infer.tar -C .build/paddle-models
```

The extracted directories are ignored by Git. Delete the temporary `.tar` files after extraction to avoid keeping duplicate copies. Neither the Python environment nor model files belong in the GitHub Pages deployment.

The script's PEP 723 metadata has no installable dependencies: it expects a provisioned environment. It validates local directories before importing Paddle; missing models fail instead of falling back to automatic downloads. Each directory needs `inference.yml`, `inference.pdiparams`, and `inference.json` or `inference.pdmodel`. These structural checks are not authenticity/compatibility verification. Use trustworthy model files only.

```sh
.build/paddle-env/bin/python scripts/paddle_service.py \
  --tier v5-mobile \
  --det-model-dir .build/paddle-models/PP-OCRv5_mobile_det_infer \
  --rec-model-dir .build/paddle-models/PP-OCRv5_mobile_rec_infer
```

`v6-tiny` / `v6-small` are also configurable, requiring the corresponding local models and a PaddleOCR release supporting them; these tiers have **not** been tested here. Default is explicit v5-mobile, not whatever the installed library happens to choose. CPU inference, document orientation, document unwarping and text-line orientation settings are fixed; preprocessing that changes coordinates is disabled. Test your own provisioned environment and actual figures before depending on it.

The service prints a fresh session token. In **Text + vectors → Local Paddle settings**, paste the loopback URL and token, authorize sending the working PNG to that local service, select **Local PaddleOCR**, and click Recognize. Check the labels, explicitly select safe replacements, then **Build with reviewed text**. SVG/PPTX text defaults to Times New Roman. Token stays in tab memory; Clear session removes it, and restarting Python invalidates it.

Browser local-network restrictions may require permission or block HTTPS-page → HTTP-loopback requests. [Chrome documents this permission boundary](https://developer.chrome.com/blog/local-network-access?hl=en). On the public website, our owned Chrome 154 test was blocked without loopback permission; explicitly granting it in that test browser allowed the same HTTP → reviewed SVG workflow to pass. That browser test used an injected recognizer; the separate real-model smoke test exercised the Python endpoint, not the public-page browser flow. The app does not grant permissions, disable browser checks or fall back to an external endpoint. If blocked, allow the browser's local-network permission only if intended, use the local preview, or import JSON. Other browsers remain unverified. Requests stop after three minutes, but aborting a browser request **does not terminate already running Python inference**. The service processes one request at a time and is not a production/multi-user server.

## Offline JSON route

With an existing Paddle environment, disable document preprocessing and line rotation when generating results, e.g. instantiate `PaddleOCR` with local model directories and all three orientation/unwarping flags `False`, then call `predict` and `save_to_json`. Upload the same original, unmodified image to Image2Other, confirm **JSON matches this unmodified source**, and choose **Import Paddle JSON**.

Supported: one image (`page_index: null`), `model_settings.use_doc_preprocessor: false`, `use_textline_orientation: false`, and matching `rec_texts`, `rec_scores`, `rec_polys`. Raw or `{"res": ...}` wrapped results are accepted. Scores must be in [0,1]; polygons must be four ordered, near-horizontal corners inside the source. Up to 500 labels / 4 MB JSON. Clearly rotated/skewed text, PDF pages and transformed coordinates are refused rather than erased with a misleading axis-aligned mask. Small detector slant is approximated by an axis-aligned box, so inspect the mask before replacement. Source identity is the user's declaration, **not automatically verified**.

The source is mapped to a working canvas capped at a 2400-pixel edge / 4 megapixels; artwork tracing is still capped at 768. Every imported/local label starts unselected regardless of score. Mixed backgrounds/crossing strokes retain the usual guards. Re-read label uses **browser Tesseract**, not Paddle, and requires separate OCR-download consent. OCR review exports record `paddleocr-local` or `paddleocr-import`, with unverified annotations; choosing/renaming a label is not training truth.

## Local transport boundaries

- Binds only `127.0.0.1`; no LAN/cloud exposure flag.
- Exact Host/Origin checks for the personal Pages origin and local preview/dev origins (4178/5178); no wildcard CORS.
- Required random per-run token, constant-time comparison; no token in URLs/storage/logs.
- POST `/ocr` accepts only bounded PNG data URLs, no filesystem paths or remote image URLs; 8 MB request, 4 megapixels, 500 labels and 4 MB response limits.
- Image decoding/inference stays in memory; no input-file persistence or telemetry. The script does not make OCR calls to external services. Model-package behavior is upstream software and requires trusted local provisioning.

Run transport checks without installing Paddle:

```sh
python3 -m unittest discover -s tests -p test_paddle_service.py
node tests/paddle-browser.mjs http://127.0.0.1:4178/Image2Other/ 9228
```

The browser check needs the built preview and an owned Chrome DevTools session on the given port. These tests verify integration, not recognition accuracy or model compatibility. Model tiers are candidates for a future matched-budget comparison on verified scientific figures; none is claimed to be universally best.

For public-origin transport QA only, the browser test accepts an explicit `--allow-loopback` argument. It mirrors granting loopback permission **only in the owned test browser**; it is not used by the application or by ordinary local CI tests. Never point these automation checks at a user's regular browser session.
