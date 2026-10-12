// Evaluator only: IDs and intended graph are supplied truth, not pixel inference.
import {isDeepStrictEqual} from 'node:util';
import {edit,editDisagreement} from './relations.mjs';
export function auditEditDecision(candidates,intended,id,patch){
  if(!Array.isArray(candidates)||!intended?.id||!intended.graph)throw Error('Supply candidates and intended truth.');
  const ids=new Set();
  for(const candidate of candidates){
    if(typeof candidate?.id!=='string'||!candidate.graph||ids.has(candidate.id))throw Error('Invalid or duplicate program ID.');
    ids.add(candidate.id);
    if(candidate.id===intended.id&&!isDeepStrictEqual(candidate.graph,intended.graph))throw Error('An intended ID must identify its supplied graph exactly.');
  }
  const truth=edit(intended.graph,id,patch);
  if(!candidates.length)return{usesSuppliedTruth:true,candidateAgreement:false,intendedRetained:false,executed:false,correctForSuppliedEdit:null,mismatchedObjects:[],truthResponse:truth.objects};
  const agreement=editDisagreement(candidates.map(c=>c.graph),id,patch);
  if(!agreement.safe)return{usesSuppliedTruth:true,candidateAgreement:false,intendedRetained:ids.has(intended.id),executed:false,correctForSuppliedEdit:null,mismatchedObjects:[],truthResponse:truth.objects};
  const check=editDisagreement([candidates[0].graph,intended.graph],id,patch);
  return {usesSuppliedTruth:true,candidateAgreement:true,intendedRetained:ids.has(intended.id),executed:true,correctForSuppliedEdit:check.safe,mismatchedObjects:check.ambiguous,truthResponse:truth.objects,executedResponse:agreement.results[0].objects};
}
