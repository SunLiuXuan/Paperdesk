import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));process.loadEnvFile(path.join(root,'.env'));
const base=process.env.AI_BASE_URL?.replace(/\/$/,'');const model=process.env.AI_MODEL;const key=process.env.AI_API_KEY;
if(!base||!key||!model)throw Error('Missing API configuration');
const endpoint=new URL(base);if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password)throw Error('Expected HTTPS API address');
function clean(value){return String(value??'').split(key).join('[REDACTED]').replace(/Bearer\s+\S+/gi,'Bearer [REDACTED]').replace(/sk-[\w-]+/g,'[REDACTED]').slice(0,700)}
async function call(route,body){const response=await fetch(base+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(25000)});let text=await response.text();let data;try{data=JSON.parse(text)}catch{}const out={route,status:response.status};if(!response.ok){out.error=clean(data?.error?.message||data?.message||data?.error?.code||(text.includes('<html')?'HTML access-denied page':text));}else if(route==='/models'){out.exactModelListed=!!data?.data?.some(x=>x.id===model);out.relatedModels=data?.data?.filter(x=>/deepseek.*flash/i.test(x.id)).map(x=>x.id).slice(0,12)}else out.reply=clean(data?.choices?.[0]?.message?.content);console.log(JSON.stringify(out));return response.status}
console.log(JSON.stringify({base,model}));
try{await call('/models');await call('/chat/completions',{model,response_format:{type:'json_object'},messages:[{role:'user',content:'Return only this JSON object: {"ok":true}'}]})}catch(e){console.log(JSON.stringify({error:clean(e.message)}));process.exitCode=1}
