import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
const file=new URL('./crop-candidate-audit.mjs',import.meta.url),api=existsSync(file)?await import(file):{};
test('a missing intended label limits any candidate selector, even when candidates agree',()=>{
  assert.equal(typeof api.auditCandidates,'function');
  const report=api.auditCandidates('(B)',[{text:'(8)',confidence:90},{text:'(8)',confidence:80}]);
  assert.equal(report.intendedPresent,false);assert.equal(report.allAgree,true);assert.equal(report.highestConfidenceCorrect,false);
});
test('a correct low-score candidate and a wrong high-score candidate stay separate',()=>{
  assert.equal(typeof api.auditCandidates,'function');
  const report=api.auditCandidates('Visual-aligned path',[{text:'Visual -aligned path',confidence:84},{text:'Visual-aligned path',confidence:45}]);
  assert.equal(report.intendedPresent,true);assert.equal(report.highestConfidenceCorrect,false);
  assert.equal(api.auditCandidates('EfficientNetV2',[{text:'EfficientNetv2',confidence:90}]).intendedPresent,false,'Do not erase case distinctions');
});
