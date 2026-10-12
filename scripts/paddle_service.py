# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Loopback-only OCR bridge. Uses preinstalled PaddleOCR and existing local models.

No model installation/download is performed by this script. HTTP transport can be
tested without Paddle by injecting a recognizer; that is not model validation.
"""
import argparse
import base64
import binascii
from http.server import BaseHTTPRequestHandler, HTTPServer
import io
import json
import os
from pathlib import Path
import secrets
import struct
from typing import Callable

MAX_BODY = 8_000_000
MAX_REPLY = 4_000_000
ORIGINS = frozenset({"https://ceasonen.github.io", "http://127.0.0.1:4178", "http://127.0.0.1:5178", "http://localhost:4178", "http://localhost:5178"})


def decode_image(payload: dict) -> tuple[bytes, int, int]:
    if not isinstance(payload, dict) or payload.get("version") != 1:
        raise ValueError("Unsupported request.")
    image = payload.get("image")
    prefix = "data:image/png;base64,"
    if not isinstance(image, str) or not image.startswith(prefix) or len(image) > MAX_BODY:
        raise ValueError("Send a bounded PNG data URL, not a path or remote URL.")
    try:
        raw = base64.b64decode(image[len(prefix):], validate=True)
    except (binascii.Error, ValueError) as error:
        raise ValueError("Invalid PNG encoding.") from error
    if len(raw) < 33 or raw[:8] != b"\x89PNG\r\n\x1a\n" or raw[12:16] != b"IHDR":
        raise ValueError("Invalid PNG image.")
    width, height = struct.unpack(">II", raw[16:24])
    if not 1 <= width <= 2400 or not 1 <= height <= 2400 or width * height > 4_000_000:
        raise ValueError("PNG exceeds 2400-pixel edge / 4 megapixels.")
    return raw, width, height


def model_directory(value: str | Path) -> str:
    directory = Path(value).expanduser().resolve()
    if not directory.is_dir() or not (directory / "inference.pdiparams").is_file() or not (directory / "inference.yml").is_file() or not any((directory / name).is_file() for name in ("inference.json", "inference.pdmodel")):
        raise ValueError("Provide an existing Paddle inference directory with config, graph and parameters. No models are downloaded.")
    return str(directory)


def build_recognizer(det_dir: str, rec_dir: str, tier: str) -> Callable[[bytes], dict]:
    det_dir, rec_dir = model_directory(det_dir), model_directory(rec_dir)
    names = {"v5-mobile": ("PP-OCRv5_mobile_det", "PP-OCRv5_mobile_rec"), "v6-tiny": ("PP-OCRv6_tiny_det", "PP-OCRv6_tiny_rec"), "v6-small": ("PP-OCRv6_small_det", "PP-OCRv6_small_rec")}
    if tier not in names:
        raise ValueError("Unsupported model tier.")
    os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"
    try:
        from paddleocr import PaddleOCR
        import numpy as np
        from PIL import Image
    except ImportError as error:
        raise RuntimeError("PaddleOCR/PaddlePaddle, NumPy and Pillow must already be installed in this Python environment. See docs/paddleocr.md.") from error
    det_name, rec_name = names[tier]
    pipeline = PaddleOCR(text_detection_model_name=det_name, text_detection_model_dir=det_dir, text_recognition_model_name=rec_name, text_recognition_model_dir=rec_dir, use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=False, text_det_limit_type="max", text_det_limit_side_len=2400, device="cpu")

    def recognize(raw: bytes) -> dict:
        with Image.open(io.BytesIO(raw)) as source:
            if source.format != "PNG" or source.width * source.height > 4_000_000:
                raise ValueError("Unsupported image.")
            pixels = np.asarray(source.convert("RGB"))[:, :, ::-1].copy()
        results = list(pipeline.predict(pixels))
        if len(results) != 1:
            raise ValueError("Expected a single-image OCR result.")
        data = results[0].json
        if isinstance(data, str):
            data = json.loads(data)
        return data.get("res", data)

    return recognize


def make_server(port: int, token: str, recognize: Callable[[bytes], dict]) -> HTTPServer:
    if not isinstance(token, str) or not 32 <= len(token) <= 128 or not token.isascii() or not token.replace("_", "").replace("-", "").isalnum():
        raise ValueError("A nonempty, bounded session token is required.")
    if isinstance(port, bool) or not isinstance(port, int) or not 0 <= port <= 65535:
        raise ValueError("Invalid local port.")

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass  # Never log image bytes, credentials or source text.

        def setup(self):
            super().setup()
            self.connection.settimeout(10)

        def allowed(self, authenticate=True):
            host = self.headers.get("Host")
            origin = self.headers.get("Origin")
            hosts = {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}
            supplied = self.headers.get("X-Image2Other-Token", "")
            return host in hosts and origin in ORIGINS and (not authenticate or supplied.isascii() and len(supplied) <= 128 and secrets.compare_digest(supplied, token))

        def reply(self, code, data):
            body = json.dumps(data, ensure_ascii=False, allow_nan=False).encode()
            self.send_response(code)
            if self.headers.get("Origin") in ORIGINS:
                self.send_header("Access-Control-Allow-Origin", self.headers["Origin"])
                self.send_header("Vary", "Origin")
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            if self.path != "/ocr" or not self.allowed(False):
                self.reply(403, {"error": "Local access denied."})
                return
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", self.headers["Origin"])
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Image2Other-Token")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_POST(self):
            if not self.allowed():
                self.reply(403, {"error": "Local access denied."})
                return
            if self.path != "/ocr":
                self.reply(404, {"error": "Unknown local operation."})
                return
            try:
                if self.headers.get("Transfer-Encoding") or self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                    raise ValueError("Use a bounded JSON request.")
                length = int(self.headers.get("Content-Length", "0"))
                if not 1 <= length <= MAX_BODY:
                    raise ValueError("Request exceeds 8 MB.")
                raw, width, height = decode_image(json.loads(self.rfile.read(length)))
            except (ValueError, UnicodeError, TimeoutError):
                self.reply(400, {"error": "Invalid or oversized PNG request."})
                return
            try:
                result = recognize(raw)
                output = {key: result[key] for key in ("page_index", "model_settings", "rec_texts", "rec_scores", "rec_polys")}
                if len(output["rec_texts"]) > 500:
                    raise ValueError("Too many labels.")
                data = {"version": 1, "engine": "paddleocr-local", "width": width, "height": height, "res": output}
                if len(json.dumps(data, allow_nan=False).encode()) > MAX_REPLY:
                    raise ValueError("OCR output exceeds bounds.")
            except Exception:  # The model may raise version-specific exceptions. Fail closed.
                self.reply(503, {"error": "Local OCR inference failed or output exceeded limits. Check model compatibility locally."})
                return
            self.reply(200, data)

    return HTTPServer(("127.0.0.1", port), Handler)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--det-model-dir", required=True)
    parser.add_argument("--rec-model-dir", required=True)
    parser.add_argument("--tier", choices=["v5-mobile", "v6-tiny", "v6-small"], default="v5-mobile")
    parser.add_argument("--port", type=int, default=8766)
    args = parser.parse_args()
    try:
        recognize = build_recognizer(args.det_model_dir, args.rec_model_dir, args.tier)
        token = secrets.token_urlsafe(32)
        server = make_server(args.port, token, recognize)
    except (ValueError, RuntimeError) as error:
        parser.error(str(error))
    print(f"Local PaddleOCR: http://127.0.0.1:{server.server_port}")
    print(f"Session token (paste into Local Paddle settings): {token}")
    print("Images stay in memory; restart the service to invalidate this token.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
