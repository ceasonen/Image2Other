import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const normal=s=>s.trim().replace(/\s+/g,' '); // Case and punctuation remain meaningful.
export function auditCandidates(expected,observations){
  if(typeof expected!=='string'||!expected.trim()||!Array.isArray(observations)||observations.length>20||observations.some(o=>typeof o.text!=='string'||!Number.isFinite(o.confidence)))throw Error('Supply a reference string and bounded observations.');
  const valid=observations.filter(o=>o.text.trim()),top=valid.reduce((best,o)=>!best||o.confidence>best.confidence?o:best,null),truth=normal(expected);
  return {usesSuppliedReference:true,intendedPresent:valid.some(o=>normal(o.text)===truth),allAgree:valid.length>0&&valid.every(o=>normal(o.text)===normal(valid[0].text)),highestConfidenceText:top?.text??null,highestConfidenceCorrect:!!top&&normal(top.text)===truth};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const data=JSON.parse(await fs.readFile('research/runs/mm-crop-color-probe.json','utf8'));
  const references={'Visual -aligned path':'Visual-aligned path','EfficientNetv2':'EfficientNetV2','(8)':'(B)'};
  const results=data.results.flatMap((row,index)=>['source','color-distance-binary'].map(variant=>({region:index,original:row.original,expected:references[row.original],variant,...auditCandidates(references[row.original],row.candidates.filter(c=>c.variant===variant))})));
  const report={annotationStatus:'agent-reviewed-development-reference',independentVerification:false,scope:'Four selected failure regions from one known developer figure. Agent read reference strings from the source, unblinded after seeing failures. Not exhaustive annotation, independent samples, held-out data or OCR accuracy. Highest confidence is a deliberately simple selection baseline; candidate inclusion is an oracle diagnostic, not an implemented selector.',results};
  await fs.writeFile('research/runs/mm-candidate-inclusion-audit.json',JSON.stringify(report,null,2));console.table(results);
}
