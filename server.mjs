import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {createLibraryStore} from './storage.mjs';
import {lookupMetadata,lookupGithub} from './metadata.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const fields=['title','alias','venue','published','summary','datasets','results','paper','code','dataset_url','notes'];
export function cleanDraft(value,source){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('模型返回的草稿格式不正确，请重试。');
 const out={};for(const key of fields)out[key]=typeof value[key]==='string'?value[key].slice(0,18000):'';
 out.tags=Array.isArray(value.tags)?[...new Set(value.tags.filter(x=>typeof x==='string').map(x=>x.trim().slice(0,40)).filter(Boolean))].slice(0,10):[];
 const sourceURLs=new Set((source.match(/https?:\/\/[^\s<>"']+/g)||[]).map(x=>x.replace(/[),.;，。]+$/,'')));
 for(const key of ['paper','code','dataset_url']){try{const u=new URL(out[key]);if(!['https:','http:'].includes(u.protocol)||!sourceURLs.has(out[key]))out[key]=''}catch{out[key]=''}}
 if(!/^\d{4}(-\d{2})?(-\d{2})?$/.test(out.published))out.published='';
 if(!out.summary&&!out.notes&&!out.title)throw Error('模型没有返回有效内容，请补充摘要或笔记。');
 return out;
}
function decode(s){return s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).trim()}
export function arxivId(link){try{const u=new URL(link);if(!['arxiv.org','www.arxiv.org','export.arxiv.org'].includes(u.hostname)||u.protocol!=='https:')return null;return u.pathname.match(/^\/(?:abs|pdf)\/(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[A-Z]{2})?\/\d{7}(?:v\d+)?)(?:\.pdf)?\/?$/)?.[1]||null}catch{return null}}
async function boundedText(response,limit=1000000){const reader=response.body.getReader();let count=0,parts=[];try{while(true){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>limit)throw Error('响应内容过大，请缩短输入。');parts.push(Buffer.from(value))}}finally{await reader.cancel().catch(()=>{})}return Buffer.concat(parts).toString('utf8')}
export async function readArxiv(id,fetcher=fetch){
 if(arxivId('https://arxiv.org/abs/'+id)!==id)throw Error('论文编号无效');
 const errors=[];
 for(const kind of ['API','摘要页']){
  try{
   const endpoint=kind==='API'?'https://export.arxiv.org/api/query?id_list='+encodeURIComponent(id):'https://arxiv.org/abs/'+id;
   const response=await fetcher(endpoint,{signal:AbortSignal.timeout(15000),redirect:'error'});
   if(!response.ok)throw Error('HTTP '+response.status+(response.status===429?'（限流）':''));
   const body=await boundedText(response);
   let record;
   if(kind==='API'){
    const entry=body.match(/<entry>([\s\S]*?)<\/entry>/)?.[1]||'';
    const get=tag=>decode(entry.match(new RegExp('<'+tag+'[^>]*>([\\s\\S]*?)</'+tag+'>'))?.[1]||'').replace(/\s+/g,' ');
    record={title:get('title'),abstract:get('summary'),published:get('published').slice(0,10),details:'arXiv 作者备注：'+get('arxiv:comment')+'\n期刊/会议引用：'+get('arxiv:journal_ref')+'\nDOI：'+get('arxiv:doi'),basis:'已读取 arXiv 标题、首次发表时间、摘要、作者备注及发表引用；未读取 PDF 全文。'};
   }else{
    const metas={};
    for(const tag of body.match(/<meta\b[^>]*>/gi)||[]){const attrs={};for(const a of tag.matchAll(/([\w-]+)\s*=\s*(["'])([\s\S]*?)\2/g))attrs[a[1].toLowerCase()]=a[3];if(attrs.name)metas[attrs.name]=decode(attrs.content||'');}
    record={title:metas.citation_title||'',abstract:metas.citation_abstract||'',published:(metas.citation_date||'').replaceAll('/','-'),details:metas.citation_doi?'DOI：'+metas.citation_doi:'',basis:'arXiv API 暂不可用，已从官方摘要页读取标题、摘要和日期；未读取 PDF 全文或作者备注。'};
   }
   if(!record.title||record.title==='Error'||!record.abstract)throw Error('未返回有效标题和摘要');
   return record;
  }catch(e){errors.push(kind+' '+(e.name==='TimeoutError'?'连接超时':/^HTTP|^未返回/.test(e.message)?e.message:'连接失败或响应异常'));}
 }
 throw Error(errors.join('；'));
}
export async function generate(input,config,fetcher=fetch){
 if(!config.key||!config.model)throw Error('请先在 .env 中配置 API Key 和模型，然后重启本地服务。');
 if(typeof input?.source!=='string'||input.source.length>60000||typeof input?.url!=='string'||input.url.length>2000)throw Error('输入格式不正确或过长，最多粘贴 60,000 字符。');
 let source=input.source.trim(),basis='根据你提供的内容生成，未读取论文全文。',metadata=null;
 if(input.url&&!/^https?:\/\//i.test(input.url))throw Error('请输入 http 或 https 论文链接。');
 const id=arxivId(input.url);
 if(id){try{
  const record=await readArxiv(id,fetcher);metadata={title:record.title,published:record.published,paper:'https://arxiv.org/abs/'+id};
  source=`标题：${record.title}\n首次发表：${record.published}\n论文：${metadata.paper}\n摘要：${record.abstract}\n${record.details}\n\n用户补充：\n${source}`;
  basis=record.basis;
 }catch(e){if(!source)throw Error('无法读取 arXiv 摘要：'+e.message+'。请稍后重试，或粘贴摘要后生成。');basis='arXiv 读取失败，本次仅依据你粘贴的内容。'}}
 else if(!source)throw Error('链接自动读取暂支持 arXiv。其他论文请同时粘贴摘要或正文。');
 else if(input.url)basis='未自动读取该网址，本次仅依据粘贴内容和你提供的链接。';
 source+='\n用户提供的论文链接：'+input.url;
 if(metadata?.title){
  const records=await lookupMetadata({title:metadata.title,paper:metadata.paper},config,fetcher);
  const found=records.sources.filter(s=>s.status==='found'&&s.venue&&!/arxiv|preprint/i.test(s.venue));
  if(found.length){source+='\n发表信息数据库记录（请区分标识匹配与同标题候选）：\n'+JSON.stringify(found.map(s=>({source:s.source,title:s.title,venue:s.venue,year:s.year,publication:s.publication,matchedBy:s.matchedBy,url:s.url})));basis+=' 已补充发表信息数据库记录，标题候选需核对。';}
  else basis+=' 数据库未提供可用发表场所，可能尚未收录或服务不可用；将依据作者备注等来源整理。';
 }
 const tagPool=Array.isArray(input.tags)?input.tags.filter(x=>typeof x==='string').slice(0,100).map(x=>x.slice(0,40)):[];
 let endpoint;try{endpoint=new URL(config.base.replace(/\/$/,'')+'/chat/completions');if(endpoint.protocol!=='https:'&&!(endpoint.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname)))throw Error()}catch{throw Error('API_BASE_URL 必须是 HTTPS 地址，或本地模型的 HTTP 地址。')}
 const response=await fetcher(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(90000),headers:{'Authorization':'Bearer '+config.key,'Content-Type':'application/json'},body:JSON.stringify({model:config.model,response_format:{type:'json_object'},messages:[{role:'system',content:await fs.readFile(path.join(root,'prompts','paper-summary.txt'),'utf8')},{role:'user',content:JSON.stringify({existing_tags:tagPool,source})}]})});
 if(!response.ok){
  let detail='';try{const payload=JSON.parse(await boundedText(response,64000));const message=payload?.error?.message||payload?.message;if(typeof message==='string')detail=message.split(config.key).join('[已隐藏密钥]').replace(/Bearer\s+\S+/gi,'Bearer [已隐藏]').replace(/sk-[\w-]+/g,'[已隐藏密钥]').slice(0,800)}catch{}
  const reason=response.status===401?'API 密钥无效，请检查配置并重启。':response.status===403?'接口拒绝访问：请检查密钥的模型权限及模型名称（包括大小写）。':response.status===429?'模型服务额度不足或请求过于频繁，请稍后重试。':`请根据服务端原因检查请求配置。`;
  throw Error(`模型服务返回 HTTP ${response.status}：${reason}${detail?' 服务端原因：'+detail:''}`);
 }
 let data;try{data=JSON.parse(await boundedText(response))}catch{throw Error('无法解析模型服务响应。')}
 if(data.choices?.[0]?.finish_reason==='length')throw Error('模型输出被截断，请缩短输入后重试。');
 let raw;try{raw=JSON.parse(data.choices?.[0]?.message?.content)}catch{throw Error('模型未返回有效 JSON 草稿，请检查模型是否支持 JSON mode。')}
 const draft=cleanDraft(raw,source);if(metadata)Object.assign(draft,metadata);else if(input.url)draft.paper=input.url;
 return {draft,basis};
}
export function createApp(config,fetcher=fetch){
 const token=randomBytes(24).toString('hex');let busy=false,metadataBusy=false;
 const library=createLibraryStore(config.dataDir||path.join(root,'data'));
 return http.createServer(async(req,res)=>{
  const host=req.headers.host||'';
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))};
  if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host))return send(403,{error:'仅支持本机访问。'});
  if(req.headers.origin&&req.headers.origin!=='http://'+host)return send(403,{error:'请求来源不受支持。'});
  try{
   if(req.url==='/api/library'&&req.method==='GET')return send(200,await library.read());
   if(req.url==='/api/github'&&req.method==='POST'){
    if(req.headers['x-paperdesk-token']!==token)return send(403,{error:'请刷新页面后重试。'});
    if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'需要 JSON 请求。'});
    try{let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>4000)return send(413,{error:'链接过长。'});chunks.push(chunk)}
     const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
     return send(200,await lookupGithub(input.code,fetcher,config.githubToken));
    }catch(e){return send(400,{error:/^请填写|^仓库|^服务|^数据源|^GitHub/.test(e.message)?e.message:'GitHub 查询失败，请稍后重试。'})}
   }
   if(req.url==='/api/metadata'&&req.method==='POST'){
    if(req.headers['x-paperdesk-token']!==token)return send(403,{error:'请刷新页面后重试。'});
    if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'需要 JSON 请求。'});
    if(metadataBusy)return send(429,{error:'已有论文查询正在进行，请稍后重试。'});
    metadataBusy=true;
    try{let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>16000)return send(413,{error:'查询内容过长。'});chunks.push(chunk)}return send(200,await lookupMetadata(JSON.parse(Buffer.concat(chunks).toString('utf8')),config,fetcher));}
    catch(e){return send(400,{error:e.message==='请提供有效的论文标题和链接。'?e.message:'查询失败，请重试。'});}finally{metadataBusy=false}
   }
   if(req.url==='/api/library'&&req.method==='POST'){
    if(req.headers['x-paperdesk-token']!==token)return send(403,{error:'请刷新页面后重试。'});
    if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'需要 JSON 请求。'});
    try{let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>20000000)return send(413,{error:'文献库超过 20 MB，请拆分后保存。'});chunks.push(chunk)}const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));const result=await library.save(input.papers,input.revision);return send(200,{revision:result.revision,path:result.path,backup:result.backup})}catch(e){return send(e.status||400,{error:e.status?e.message:'本地文件保存失败：'+e.message})}
   }
   if(req.url==='/api/status'&&req.method==='GET')return send(200,{configured:!!(config.key&&config.model),model:config.model||'',provider:new URL(config.base).origin,token});
   if(req.url==='/api/generate'&&req.method==='POST'){
    if(req.headers['x-paperdesk-token']!==token)return send(403,{error:'请刷新页面后重试。'});
    if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'需要 JSON 请求。'});
    if(busy)return send(429,{error:'已有生成任务正在进行，请稍候。'});
    busy=true;try{let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>300000){send(413,{error:'输入过长。'});return}chunks.push(chunk)}let input;try{input=JSON.parse(Buffer.concat(chunks).toString())}catch{return send(400,{error:'无效 JSON。'})}send(200,await generate(input,config,fetcher))}catch(e){send(400,{error:e.name==='TimeoutError'?'请求超时，请重试或粘贴摘要。':e.message==='fetch failed'?'无法连接模型服务，请检查网络与 API 地址。':e.message})}finally{busy=false}return;
   }
   if(req.method!=='GET')return send(405,{error:'不支持的请求。'});
   const name=new URL(req.url,'http://'+host).pathname;
   const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/style.css':'style.css'};
   files['/notes.js']='notes.js';
   files['/vendor/markdown-it/markdown-it.umd.min.js']='vendor/markdown-it/markdown-it.umd.min.js';
   if(/^\/vendor\/katex\/(?:katex\.min\.(?:js|css)|contrib\/auto-render\.min\.js|fonts\/[A-Za-z0-9_-]+\.(?:woff2?|ttf))$/.test(name))files[name]=name.slice(1);
   if(!files[name])return send(404,{error:'未找到页面。'});
   const body=await fs.readFile(path.join(root,'dist',files[name]));const types={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf'};res.writeHead(200,{'Content-Type':types[path.extname(name)]||'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);
  }catch{send(500,{error:'服务异常，请检查配置。'})}
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{process.loadEnvFile(path.join(root,'.env'))}catch(e){if(e.code!=='ENOENT')throw e}
 const config={key:process.env.AI_API_KEY||'',model:process.env.AI_MODEL||'',base:process.env.AI_BASE_URL||'https://api.openai.com/v1',scholarKey:process.env.SEMANTIC_SCHOLAR_API_KEY||'',githubToken:process.env.GITHUB_TOKEN||''};
 const server=createApp(config);server.listen(4174,'127.0.0.1',()=>console.log('Paperdesk: http://127.0.0.1:4174\n'+(config.key&&config.model?'AI configured.':'AI not configured. See docs/AI-SETUP.md.')));server.on('error',()=>{console.error('无法启动：端口 4174 可能被占用。');process.exitCode=1});
}
