import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
const source=await fs.readFile(new URL('../dist/app.js',import.meta.url),'utf8');
function fixture(){
 const fields={'#search':{value:''},'#date-kind':{value:'published'},'#from':{value:''},'#to':{value:''},'#sort':{value:'title'}};
 const ctx=vm.createContext({$:s=>fields[s],validateImages:x=>x||[],crypto:{randomUUID:()=> 'new'},structuredClone,FormData:class{constructor(){return new Map(Object.entries({title:'Edited',tags:'',venue:''}))}},notify:()=>{}});
 vm.runInContext("let papers=[{id:'1',title:'A',tags:['CV'],status:'待读',starred:true},{id:'2',title:'B',tags:['CV'],status:'已读'}];let state={status:'全部文献',tag:'',starredOnly:true};",ctx);
 vm.runInContext(source.slice(source.indexOf('function validate(data)'),source.indexOf('function resourceLinks')),ctx);
 return {ctx,fields};
}
test('starred filter combines with status and backup import preserves true booleans',()=>{
 const {ctx,fields}=fixture();assert.equal(ctx.filtered().length,1);
 vm.runInContext("state.status='已读'",ctx);assert.equal(ctx.filtered().length,0);
 vm.runInContext("state.status='全部文献';state.starredOnly=false",ctx);assert.equal(ctx.filtered().length,2);
 fields['#search'].value='B';assert.equal(ctx.filtered()[0].id,'2');
 assert.equal(ctx.validate([{id:'a',title:'A',tags:[],starred:true}])[0].starred,true);
 assert.equal(ctx.validate([{id:'a',title:'A',tags:[]}])[0].starred,false);
 assert.equal(ctx.validate([{id:'a',title:'A',tags:[],starred:'false'}])[0].starred,false);
});
test('editing a starred paper retains its star',async()=>{
 const {ctx,fields}=fixture();let saved;
 fields['#form']={};fields['#editor']={close:()=>{}};
 Object.assign(ctx,{persist:async next=>{saved=next;return true},url:()=>true});
 vm.runInContext("let editing='1',imageLoading=false,editorImages=[];",ctx);
 vm.runInContext(source.slice(source.indexOf("$('#form').onsubmit="),source.indexOf('function download(')),ctx);
 await fields['#form'].onsubmit({preventDefault(){},target:{}});
 assert.equal(saved[0].title,'Edited');assert.equal(saved[0].starred,true);
});
