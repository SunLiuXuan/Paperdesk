import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
const source=await fs.readFile(new URL('../dist/app.js',import.meta.url),'utf8');
test('full browser cache does not disable disk saving or overwrite the old cache during load',async()=>{
 const stored=[{id:'p',title:'磁盘笔记',tags:[]}];
 const old=JSON.stringify([{id:'old',title:'浏览器旧笔记',tags:[]}]);
 const elements=new Map();const notices=[];const calls=[];
 const context=vm.createContext({location:{protocol:'http:'},AbortSignal,JSON,
  localStorage:{getItem:()=>old,setItem:(key)=>{calls.push(key);throw Error('QuotaExceededError')}},
  $:selector=>{if(!elements.has(selector))elements.set(selector,{});return elements.get(selector)},
  notify:t=>notices.push(t),render:()=>{},storageStatus:()=>{},validate:x=>x,
  fetch:async url=>({ok:true,json:async()=>url==='/api/status'?{token:'test'}:{exists:true,papers:stored,revision:'rev',path:'library.json'}})
 });
 vm.runInContext("const KEY='paperdesk.v1';let diskReady=false,diskToken='',diskRevision=null,papers=[],localReadFailed=false;const diskMode=true;"+source.slice(source.indexOf('async function initStorage()'),source.indexOf('\nfunction validate(data)')),context);
 await context.initStorage();
 assert.equal(vm.runInContext('diskReady',context),true);
 assert.equal(vm.runInContext('papers[0].title',context),'磁盘笔记');
 assert.deepEqual(calls,['paperdesk.v1.before-disk']);
 assert.equal(notices.length,1);
});
