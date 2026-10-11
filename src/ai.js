import {validateScene} from './scene.js';
export function parseSceneResponse(content) {
  const clean=String(content).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  return validateScene({...JSON.parse(clean),engine:'ai-rebuild'});
}
export function providerUrl(endpoint) {
  const url=new URL(endpoint);
  if(url.username || url.password || url.search || url.hash) throw new Error('Provider URL must not contain credentials, a query or a fragment');
  if(url.protocol!=='https:' && !(url.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) throw new Error('Use HTTPS for your provider endpoint');
  return url.href.replace(/\/$/,'').replace(/\/chat\/completions$/,'')+'/chat/completions';
}
export const SCENE_PROMPT=`Reconstruct the supplied diagram as editable geometry. Return ONLY JSON, no SVG, no Markdown.
Use this schema: {"width":800,"height":500,"background":"#ffffff","nodes":[...]}. Coordinates are pixels on the source image canvas. Preserve the exact source dimensions, layout, colors and words. Do not invent content. Keep text as editable text nodes, never outlines. Use at most 600 nodes. Approximate complex artwork with simple paths; do not use raster images or external resources. Order nodes from back to front.
Common node fields: id, name, type, fill (#RRGGBB or none), stroke (#RRGGBB or none), strokeWidth, opacity (0–1).
rect: x,y,width,height,radius. ellipse: x,y,width,height (bounding box). line: x,y,x2,y2,arrow (boolean). text: x,y,width,height,text,fontSize,bold,align (left|center|right); x,y are the upper-left text box corner, wrap with explicit newline. path: d (only absolute M,L,Q,C,Z commands with all coordinates explicit). Use filled paths for closed shapes. Use lines for arrows. All coordinates must be finite numbers, all dimensions positive. Preserve formulas as editable Unicode text if feasible. Output accurate editable structure rather than decorative additions.`;
export async function rebuildImage({endpoint,key,model,image,width,height,consent,signal,fetcher=fetch}) {
  if(!consent) throw new Error('Explicit consent is required before sending an image to your provider');
  const url=providerUrl(endpoint);
  if(!model?.trim() || !image?.startsWith('data:image/')) throw new Error('Choose a vision model and load an image first');
  const response=await fetcher(url,{method:'POST',signal,headers:{'Content-Type':'application/json',...(key?{Authorization:`Bearer ${key}`}:{})},
    body:JSON.stringify({model:model.trim(),temperature:0,max_tokens:14000,messages:[
      {role:'system',content:SCENE_PROMPT},
      {role:'user',content:[{type:'text',text:`Source canvas: ${width} × ${height} pixels. Reconstruct this image.`},{type:'image_url',image_url:{url:image,detail:'high'}}]}
    ]})});
  if(!response.ok) throw new Error(`Provider returned HTTP ${response.status}. Check your endpoint, vision model and API permissions.`);
  const result=await response.json();
  const content=result.choices?.[0]?.message?.content;
  if(typeof content!=='string') throw new Error('Provider did not return a JSON scene in a chat-completions response');
  return parseSceneResponse(content);
}
