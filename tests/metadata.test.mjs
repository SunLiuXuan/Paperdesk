import test from 'node:test';
import assert from 'node:assert/strict';
import {identifiers,lookupMetadata} from '../metadata.mjs';
import {createApp} from '../server.mjs';
const json=x=>new Response(JSON.stringify(x));
test('identifiers accept DOI/arXiv only and remove arXiv version',()=>{
 assert.deepEqual(identifiers('https://arxiv.org/pdf/2411.15139v3.pdf'),{arxiv:'2411.15139'});
 assert.deepEqual(identifiers('https://doi.org/10.1000/example'),{doi:'10.1000/example'});
 assert.deepEqual(identifiers('https://arxiv.org.evil.test/abs/2411.15139'),{});
});
test('source-specific counts, preprint status and title matching remain explicit',async()=>{
 const result=await lookupMetadata({title:'A Paper',paper:'https://arxiv.org/abs/2411.15139v2'},{},async u=>{
  if(u.includes('semanticscholar')){assert.match(u,/ARXIV%3A2411.15139/);return json({title:'A Paper',venue:'arXiv.org',citationCount:0});}
  return json({message:{items:[{title:['A Paper'],'container-title':['Test Conference'],type:'proceedings-article',DOI:'10.1000/test','is-referenced-by-count':5}]}});
 });
 assert.equal(result.sources[0].citations,0);assert.match(result.sources[0].publication,/不代表未录用/);
 assert.equal(result.sources[1].citations,5);assert.equal(result.sources[1].matchedBy,'title');assert.match(result.sources[1].publication,/会议论文/);
});
test('ambiguous, missing and failed results are not turned into zero citations',async()=>{
 const r=await lookupMetadata({title:'Exact title',paper:''},{},async u=>u.includes('semanticscholar')?new Response('',{status:429}):json({message:{items:[{title:['Unrelated'],DOI:'10.1000/a'}]}}));
 assert.equal(r.sources[0].status,'error');assert.match(r.sources[0].message,/限流/);assert.equal(r.sources[1].status,'not_found');
 const a=await lookupMetadata({title:'same',paper:''},{},async u=>u.includes('semanticscholar')?json({data:[{title:'same'},{title:'same'}]}):json({message:{items:[]}}));
 assert.equal(a.sources[0].status,'not_found');assert.match(a.sources[0].message,/多个/);
});
test('DOI direct lookup supports journal records, missing counts and key isolation',async()=>{
 const r=await lookupMetadata({title:'Paper',paper:'https://doi.org/10.1000/test'},{scholarKey:'test-only'},async(u,opts)=>{
  if(u.includes('semanticscholar')){assert.equal(opts.headers['x-api-key'],'test-only');return new Response('',{status:404});}
  assert.equal(opts.headers['x-api-key'],undefined);return json({message:{title:['Paper'],'container-title':['Journal'],type:'journal-article',DOI:'10.1000/test'}});
 });
 assert.equal(r.sources[1].citations,null);assert.equal(r.sources[1].matchedBy,'identifier');assert.match(r.sources[1].publication,/期刊论文/);
});
test('metadata endpoint requires token and does not disclose configuration',async()=>{
 const app=createApp({base:'https://example.com',scholarKey:'private-test'},async()=>new Response('',{status:404}));
 await new Promise(r=>app.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.address().port;
 try{
  assert.equal((await fetch(base+'/api/metadata',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
  const status=await(await fetch(base+'/api/status')).json();assert.ok(!JSON.stringify(status).includes('private-test'));
  const r=await fetch(base+'/api/metadata',{method:'POST',headers:{'Content-Type':'application/json','X-Paperdesk-Token':status.token},body:JSON.stringify({title:'Paper',paper:''})});
  assert.equal(r.status,200);assert.equal((await r.json()).sources.length,2);
 }finally{await new Promise(r=>app.close(r))}
});
