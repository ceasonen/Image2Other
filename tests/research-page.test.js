import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const path = new URL('../public/research/index.html', import.meta.url);
const app = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

test('research project page is published with the browser studio', () => {
  assert.ok(existsSync(path), 'Missing public/research/index.html');
  const html = readFileSync(path, 'utf8');
  assert.match(html, /Scientific figures should remain/);
  assert.match(html, /Image2Other/);
  assert.match(html, /Research prototype/);
  assert.doesNotMatch(html, /Nerfies: Deformable Neural Radiance Fields/);
  assert.ok(existsSync(new URL('../public/research/static/css/site.css', import.meta.url)));
  assert.ok(existsSync(new URL('../public/research/static/images/studio.png', import.meta.url)));
});

test('studio and README link to the public research page', () => {
  assert.match(app, /\/Image2Other\/research\//);
  assert.match(readme, /https:\/\/ceasonen\.github\.io\/Image2Other\/research\//);
});

test('published research assets are not excluded from Git', () => {
  const result = spawnSync('git', ['check-ignore', '-q', 'public/research/index.html']);
  assert.equal(result.status, 1, 'public/research is ignored and would not be deployed');
});
