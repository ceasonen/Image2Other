"""Transport tests inject a fake recognizer; they do not test Paddle model accuracy."""
import base64
import http.client
import importlib.util
import json
from pathlib import Path
import threading
import unittest

service_path = Path(__file__).resolve().parents[1] / "scripts" / "paddle_service.py"
spec = importlib.util.spec_from_file_location("paddle_service", service_path)
service = importlib.util.module_from_spec(spec)
spec.loader.exec_module(service)


class PaddleTransportTest(unittest.TestCase):
    def setUp(self):
        self.calls = []
        def recognize(image):
            self.calls.append(image)
            return {"page_index": None, "model_settings": {"use_doc_preprocessor": False, "use_textline_orientation": False}, "rec_texts": ["Model"], "rec_scores": [.97], "rec_polys": [[[20, 30], [100, 30], [100, 50], [20, 50]]]}
        self.token = "a" * 43
        self.server = service.make_server(0, self.token, recognize)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def request(self, payload, origin="https://ceasonen.github.io", token=None, host=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        headers = {"Content-Type": "application/json", "Origin": origin, "X-Image2Other-Token": self.token if token is None else token}
        if host:
            headers["Host"] = host
        connection.request("POST", "/ocr", json.dumps(payload), headers)
        response = connection.getresponse()
        result = (response.status, response.read(), response.getheader("Access-Control-Allow-Origin"))
        connection.close()
        return result

    def fixture(self):
        data = json.loads((Path(__file__).parent / "fixtures" / "ocr-mixed.json").read_text())
        return {"version": 1, "image": "data:image/png;base64," + data["png"]}

    def test_native_png_transport_with_authorized_origin(self):
        status, body, origin = self.request(self.fixture())
        self.assertEqual(status, 200)
        result = json.loads(body)
        self.assertEqual(result["res"]["rec_texts"], ["Model"])
        self.assertGreater(result["width"], 100)
        self.assertEqual(origin, "https://ceasonen.github.io")
        self.assertEqual(len(self.calls), 1)

    def test_unauthorized_and_non_png_inputs_never_reach_recognizer(self):
        for changes in [{"origin": "https://evil.test"}, {"token": ""}, {"token": "wrong"}, {"host": "evil.test"}]:
            self.assertEqual(self.request(self.fixture(), **changes)[0], 403)
        self.assertEqual(self.request({"version": 1, "image": "https://evil.test/image.png"})[0], 400)
        self.assertEqual(self.request({"version": 1, "image": "data:image/png;base64," + base64.b64encode(b"not png").decode()})[0], 400)
        self.assertEqual(self.calls, [])

    def test_configuration_and_input_bounds_fail_closed(self):
        with self.assertRaises(ValueError):
            service.make_server(0, "", lambda _: {})
        with self.assertRaises(ValueError):
            service.decode_image({"version": 1, "image": "data:image/png;base64," + "A" * (service.MAX_BODY + 1)})
        with self.assertRaises(ValueError):
            service.model_directory(Path(__file__).parent)


if __name__ == "__main__":
    unittest.main()
