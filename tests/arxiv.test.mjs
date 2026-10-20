import test from 'node:test';
import assert from 'node:assert/strict';
import {readArxiv,generate} from '../server.mjs';
test('arXiv API rate limit falls back to official HTML metadata',async()=>{
 const seen=[];const r=await readArxiv('2506.03719v2',async(u,opts)=>{seen.push(u);assert.equal(opts.redirect,'error');return u.includes('export.arxiv')?new Response('Rate exceeded',{status:429}):new Response(`<meta content="Title &amp; methods" name="citation_title"><meta name='citation_abstract' content='Abstract text'><meta name="citation_date" content="2025/06/04">`)});
 assert.equal(seen[1],'https://arxiv.org/abs/2506.03719v2');assert.equal(r.title,'Title & methods');assert.equal(r.published,'2025-06-04');assert.match(r.basis,/官方摘要页/);
});
test('both sources failing reports reasons and never invokes model without content',async()=>{
 let count=0;await assert.rejects(generate({url:'https://arxiv.org/pdf/2506.03719v2',source:''},{key:'fake',model:'fake',base:'https://example.invalid'},async()=>{count++;return new Response('',{status:429})}),/API HTTP 429.*摘要页 HTTP 429/);assert.equal(count,2);
});
test('malformed fallback HTML is not used as a paper',async()=>{
 await assert.rejects(readArxiv('2506.03719v2',async()=>new Response('<html>Challenge</html>')),/未返回有效标题和摘要/);
});
