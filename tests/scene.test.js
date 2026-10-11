import test from 'node:test';
import assert from 'node:assert/strict';
import { validateScene, sceneToSvg, pathToPoints, outputName, traceToScene } from '../src/scene.js';

const scene = { width: 400, height: 200, background: '#ffffff', nodes: [
  { id: 'box', type: 'rect', x: 20, y: 30, width: 80, height: 40, fill: '#e0e7ff', stroke: '#4f46e5', strokeWidth: 2 },
  { id: 'label', type: 'text', x: 25, y: 35, width: 70, height: 25, text: '<script> & "title"', fontSize: 16, fill: '#111111' }
] };
test('SVG contains real shapes and escaped editable text, never a raster wrapper', () => {
  const svg = sceneToSvg(scene);
  assert.match(svg, /<rect/); assert.match(svg, /<text/);
  assert.match(svg, /&lt;script&gt; &amp;/); assert.doesNotMatch(svg, /<image|<script/);
});
test('scene rejects unsupported nodes, nonfinite geometry and unsafe colors', () => {
  for (const node of [{ type: 'image', href: 'evil' }, { ...scene.nodes[0], x: NaN }, { ...scene.nodes[0], fill: 'url(https://evil)' }]) {
    assert.throws(() => validateScene({ ...scene, nodes: [node] }), /Unsupported|finite|color/);
  }
});
test('scene keeps supported line arrows and text styles', () => {
  const valid = validateScene({ ...scene, nodes: [{ id:'arrow', type:'line', x:10, y:10, x2:30, y2:50, stroke:'#000000', strokeWidth:2, arrow:true }] });
  assert.match(sceneToSvg(valid), /marker-end/);
});
test('custom path geometry preserves holes as separate move commands and quadratic curves', () => {
  const points = pathToPoints('M 0 0 L 10 0 Q 15 5 10 10 Z M 2 2 L 4 2 L 4 4 Z', .01);
  assert.equal(points.filter(p => p.moveTo).length, 2);
  assert.equal(points.filter(p => p.close).length, 2);
  assert.equal(points.find(p => p.curve)?.curve.type, 'quadratic');
});
test('paths reject unsupported commands rather than silently damaging geometry', () => {
  assert.throws(() => pathToPoints('M 0 0 A 10 10 0 0 0 2 2', 1), /Unsupported/);
});
test('trace yields independently editable vector paths and respects alpha', () => {
  const result = traceToScene({width:10, height:10, palette:[{r:10,g:20,b:30,a:255},{r:0,g:0,b:0,a:0}], layers:[
    [{segments:[{type:'L',x1:0,y1:0,x2:10,y2:0},{type:'L',x1:10,y1:0,x2:10,y2:10}],holechildren:[],isholepath:false}], []
  ]});
  assert.equal(result.nodes.length, 1);
  assert.equal(result.nodes[0].fill, '#0a141e'); assert.match(result.nodes[0].d, /M 0 0/);
});
test('download filename strips paths and replaces its extension', () => {
  assert.equal(outputName('../../my figure.PNG', 'svg'), 'my figure.svg');
});
