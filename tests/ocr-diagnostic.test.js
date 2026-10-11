import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';

test('shared masking diagnostic reports collateral edits, refusal and known blind spots separately',async()=>{
  const file=new URL('../scripts/ocr-diagnostic.mjs',import.meta.url);
  assert.ok(existsSync(file),'The reproducible diagnostic runner must exist');
  const {runMaskDiagnostic}=await import(file);const report=runMaskDiagnostic();
  assert.equal(report.stage,'masking-with-supplied-labels');
  assert.equal(report.ocrInferenceRun,false);assert.equal(report.generalAccuracyClaim,false);
  const rows=new Map(report.cases.map(c=>[c.id,c]));
  for(const id of ['clean','transparent']){
    const c=rows.get(id);assert.equal(c.guarded.replaced,true);
    assert.equal(c.guarded.glyphRemoval,1);assert.equal(c.guarded.artworkChangedPixels,0);
  }
  for(const id of ['horizontal-crossing','vertical-crossing']){
    const c=rows.get(id);assert.ok(c.legacy.artworkChangedPixels>0);
    assert.equal(c.guarded.replaced,false);assert.equal(c.guarded.artworkChangedPixels,0);
    assert.equal(c.guarded.glyphRemoval,0,'Refusing removal is not successful editable reconstruction');
  }
  assert.ok(rows.get('internal-rule').guarded.artworkChangedPixels>0,'Do not hide known failures inside a box');
  assert.ok(rows.get('diagonal-crossing').guarded.artworkChangedPixels>0,'Axis guard is not general connector recovery');
  assert.equal(rows.get('confident-wrong-label').guarded.nativeLabelCorrect,false);
  assert.equal(rows.get('confident-wrong-label').guarded.replaced,true,'High-confidence wrong text remains a separate failure');
  for(const c of report.cases)for(const method of ['legacy','guarded'])assert.equal(c[method].outsideBoxChangedPixels,0);
});
