# AI rebuild

AI rebuild is optional. Vector trace and image format conversion work without a model or key.

## Direct provider route

Open settings. Enter an HTTPS API base URL, an image-capable model ID, and your own key. A loopback HTTP URL is allowed for local development. The endpoint must accept `POST /chat/completions`, image data URLs, and the usual `choices[0].message.content` response. CORS must permit requests from this website.

Check the consent box before running Rebuild. The image is resized to a maximum 1,600-pixel edge and sent to that provider with the reconstruction prompt. The request can incur fees; the provider handles the submitted data under its own policies. Credentials are not persisted. Do not use an untrusted proxy or a provider URL shared by a stranger. A static site cannot conceal a browser-supplied key from the provider receiving it.

The app validates the JSON response before rendering or exporting it. Requests time out after three minutes and can be cancelled. Unsupported geometry fails explicitly. We have tested the request contract and consent boundary, but have not performed an authenticated live model evaluation.

## Existing AI chat route

1. Open an image and switch to AI rebuild.
2. Click Copy prompt and attach the original image in a vision-enabled AI chat you already use.
3. Ask for a JSON scene, save the returned JSON as a `.json` file, and choose Import JSON.
4. Compare text and geometry with the source, refine layers, and export.

The exact prompt is maintained in `src/ai.js` as `SCENE_PROMPT`. Using this route does not send data through Image2Other, but you still submit it to your AI chat provider.

## Minimal scene

```json
{
  "width": 800,
  "height": 500,
  "background": "#ffffff",
  "nodes": [
    {"type":"rect","name":"Model","x":100,"y":100,"width":180,"height":80,"radius":12,"fill":"#eeebfb","stroke":"#6056d9","strokeWidth":2},
    {"type":"text","name":"Label","x":120,"y":123,"width":140,"height":35,"text":"Model","fontSize":24,"align":"center","fill":"#333333"},
    {"type":"line","name":"Output arrow","x":290,"y":140,"x2":400,"y2":140,"stroke":"#777777","strokeWidth":2,"arrow":true}
  ]
}
```

Coordinates use the scene's pixel canvas. Text uses an upper-left text box, not a baseline. Supported types are `rect`, `ellipse`, `line`, `text`, and `path`. Paths accept explicit absolute M/L/Q/C/Z commands. Fills and strokes use six-digit hex colors or `none`; opacity ranges from 0 to 1. Explicit IDs are preserved and must be unique ASCII letters/digits/underscores/hyphens (1–80 characters). Missing IDs are generated without collisions. Gradients, raster inserts, HTML, scripts, external resources, and unsupported paths are rejected or excluded.

Text defaults to Times New Roman in SVG and native PPTX. Optional `fontFace` supports Times New Roman, Arial, Calibri or Georgia. Fonts are not embedded; substitution and exact line breaks may differ across devices. This does not recover the original font, rich text, chart data or editable mathematical structures.

Optional `connections` preserves manually supplied line endpoint constraints. For example, give the Model node `id: "model"` and the line `id: "arrow"`, then add `"connections": [{"lineId":"arrow","start":{"nodeId":"model","u":1,"v":0.5}}]`. The target must be rect/ellipse/path, never another line or text. Coordinates `u/v` lie in [0,1] within the target's exact bounding box; the validator derives line endpoints. Use the line inspector to set these manually and save Scene JSON to continue editing. SVG contains metadata and a geometric snapshot; native PPTX lines have synchronized positions, not active Office bindings. Image tracing does not infer these relationships.
