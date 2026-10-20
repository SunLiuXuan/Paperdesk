import test from 'node:test';
import assert from 'node:assert/strict';
import {lookupGithub} from '../metadata.mjs';
test('GitHub stars use fixed API host and repository path, including zero',async()=>{
 const r=await lookupGithub('https://github.com/author/paper.git/tree/main',async(u,opts)=>{assert.equal(u,'https://api.github.com/repos/author/paper');assert.equal(opts.headers.Authorization,undefined);return new Response(JSON.stringify({stargazers_count:0}));});
 assert.equal(r.stars,0);assert.equal(r.repository,'author/paper');assert.ok(r.queriedAt);
});
test('GitHub rejects unrelated hosts and distinguishes failures from zero',async()=>{
 for(const link of ['https://github.com.evil.test/a/b','http://localhost/a/b','https://github.com/a','https://user:pass@github.com/a/b'])await assert.rejects(lookupGithub(link,()=>{throw Error('must not fetch')}),/有效/);
 await assert.rejects(lookupGithub('https://github.com/a/b',async()=>new Response('',{status:404})),/仓库不存在/);
 await assert.rejects(lookupGithub('https://github.com/a/b',async()=>new Response('',{status:403})),/拒绝访问/);
 const missing=await lookupGithub('https://github.com/a/b',async()=>new Response('{}'));assert.equal(missing.stars,null);
});
test('GitHub token is sent only to fixed API and not returned; rate limits are explicit',async()=>{
 const r=await lookupGithub('https://github.com/a/b',async(u,opts)=>{assert.equal(u,'https://api.github.com/repos/a/b');assert.equal(opts.headers.Authorization,'Bearer test-secret');assert.equal(opts.redirect,'error');return new Response(JSON.stringify({stargazers_count:42}));},'test-secret');
 assert.equal(r.stars,42);assert.ok(!JSON.stringify(r).includes('test-secret'));
 await assert.rejects(lookupGithub('https://github.com/a/b',async()=>new Response('',{status:403,headers:{'x-ratelimit-remaining':'0','x-ratelimit-reset':'1792465048'}})),/额度已用完.*北京时间/);
 await assert.rejects(lookupGithub('https://github.com/a/b',async()=>new Response('',{status:401}),'invalid'),/Token 无效/);
});
