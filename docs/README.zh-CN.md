# Image2Other

把图片变成方便继续修改的文件。独立项目主页：<https://ceasonen.github.io/Image2Other/>。

## 三种模式

- **Vector trace，本地描摹**：PNG/JPG 等图片转成真实的彩色矢量路径，支持 SVG 和原生 PPTX 导出。无需 API Key，也不上传图片。图片里的字会变成轮廓，不会自动变成可改字的文本框。
- **AI rebuild，语义重建**：使用你自己的视觉模型，把图重建成可编辑文字、矩形、椭圆、线条、箭头和路径。也可复制提示词到自己的 AI 对话，随后导入 JSON。需要核对识别内容，不能保证原图完全还原。
- **Image formats，格式转换**：PNG/JPEG/WebP 互转，可设置输出大小、压缩质量和 JPEG 背景色。保留像素内容，不进行结构识别。

支持上传、拖拽和剪贴板粘贴。转换后可以在 Layers 中改颜色、透明度、文字和基础坐标，也可以添加文本、删除图层、撤销，以及保存 Scene JSON 继续编辑。

## 本地启动

安装 Node.js 22.12 或更高的受支持版本，在项目文件夹运行：

```sh
npm install --ignore-scripts
npm run dev
```

打开 <http://127.0.0.1:5178/Image2Other/>。验证和构建用 `npm test`、`npm run build`。

## 可编辑到底是什么意思

SVG 内是路径/文字/形状，不是套壳 PNG；PPTX 内是原生 PowerPoint 文本框、形状和自定义曲线。描摹输出仍主要是轮廓，想恢复语义化对象需要 AI rebuild。内置可编辑样例是我们手工定义的场景，仅演示编辑和导出，不代表自动识别精度。

当前输入上限 20 MB、24 百万像素。本地描摹最长边缩到 768 像素，适合平面示意图、图标；复杂照片、细小文字和公式可能失真。动画输入只导出浏览器解码的一帧。尚未实现 PDF/EPS/旧版 `.ppt`、批量转换、局部重建或 OCR。

## AI 接口与隐私

设置按钮中填入支持视觉输入的 chat-completions 兼容接口、模型 ID 和密钥。勾选明确同意后，点击 Rebuild 才会发出请求。密钥仅存在当前页面的输入框中，不持久保存；只发送到你指定的地址。接口需支持浏览器 CORS 请求。服务商可能收费和保留图片，在投稿件请先确认允许外发。

没有接口也可以使用 Copy prompt，把图片及提示词发给自己的 AI，再点 Import JSON 导入回复。完整说明见 [ai-rebuild.md](ai-rebuild.md)。

[英文说明和限制](../README.md) · [论文与开源来源](research.md) · [第三方许可证](../THIRD_PARTY_NOTICES.md)
