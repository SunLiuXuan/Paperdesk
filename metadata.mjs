// Fixed public scholarly endpoints; user URLs are identifiers, never fetch targets.
const normalized=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function identifiers(link){
 try{const u=new URL(link);if(!['http:','https:'].includes(u.protocol))return {};
  if(['doi.org','dx.doi.org'].includes(u.hostname)){const doi=decodeURIComponent(u.pathname.slice(1));return /^10\.\d{4,9}\/.+/i.test(doi)?{doi}:{};}
  if(['arxiv.org','www.arxiv.org','export.arxiv.org'].includes(u.hostname)){
   const id=u.pathname.match(/^\/(?:abs|pdf)\/(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[A-Z]{2})?\/\d{7}(?:v\d+)?)(?:\.pdf)?\/?$/)?.[1];
   if(id)return {arxiv:id.replace(/v\d+$/,'')};
  }
 }catch{}return {};
}
async function request(endpoint,fetcher,headers={}){
 const response=await fetcher(endpoint,{headers,redirect:'error',signal:AbortSignal.timeout(15000)});
 if(response.status===404)return null;
 if(!response.ok){const e=Error(response.status===429?'服务限流，请稍后重试':response.status===401||response.status===403?'服务拒绝访问，请检查权限或 API Key':`服务返回 HTTP ${response.status}`);throw e;}
 const reader=response.body.getReader();let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2000000)throw Error('数据源响应过大');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{})}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function candidates(list,title){const key=normalized(title);return key?list.filter(p=>normalized(Array.isArray(p.title)?p.title[0]:p.title)===key):[];}
const count=n=>Number.isSafeInteger(n)&&n>=0?n:null;
const text=s=>typeof s==='string'?s.slice(0,1000):'';
function publication(venue,type){
 if(!venue||/arxiv|biorxiv|medrxiv|preprint/i.test(venue))return '未查到会议／期刊收录记录（不代表未录用）';
 if(type==='journal')return '数据库记录为期刊论文';
 if(type==='conference')return '数据库记录为会议论文';
 return '数据库提供了发表场所，类型待核对';
}
async function semantic(input,ids,key,fetcher){
 const fields='title,url,externalIds,venue,year,citationCount,publicationTypes,publicationVenue,journal';
 const id=ids.doi?'DOI:'+ids.doi:ids.arxiv?'ARXIV:'+ids.arxiv:null;
 const endpoint=id?'https://api.semanticscholar.org/graph/v1/paper/'+encodeURIComponent(id)+'?fields='+fields:'https://api.semanticscholar.org/graph/v1/paper/search?query='+encodeURIComponent(input.title)+'&limit=5&fields='+fields;
 const response=await request(endpoint,fetcher,key?{'x-api-key':key}:{});
 const list=id?(response?[response]:[]):candidates(response?.data||[],input.title);
 if(list.length!==1)return {source:'Semantic Scholar',status:'not_found',message:list.length?'有多个同标题结果，请使用 DOI 或 arXiv 链接查询':'未找到可确认匹配的记录'};
 const p=list[0],venue=text(p.publicationVenue?.name||p.journal?.name||p.venue),type=p.publicationVenue?.type||(p.publicationTypes?.includes('JournalArticle')?'journal':p.publicationTypes?.includes('Conference')?'conference':'');
 return {source:'Semantic Scholar',status:'found',matchedBy:id?'identifier':'title',title:text(p.title),venue,year:p.year||null,publication:publication(venue,type),citations:count(p.citationCount),url:/^[a-f0-9]{40}$/i.test(p.paperId||'')?'https://www.semanticscholar.org/paper/'+p.paperId:'https://www.semanticscholar.org/search?q='+encodeURIComponent(p.title||input.title)};
}
async function crossref(input,ids,fetcher){
 const endpoint=ids.doi?'https://api.crossref.org/works/'+encodeURIComponent(ids.doi):'https://api.crossref.org/works?query.title='+encodeURIComponent(input.title)+'&rows=5&select=DOI,title,container-title,type,published,is-referenced-by-count';
 const response=await request(endpoint,fetcher,{'User-Agent':'PaperDesk/1.0 (local literature notes)'});
 const list=ids.doi?(response?.message?[response.message]:[]):candidates(response?.message?.items||[],input.title);
 if(list.length!==1)return {source:'Crossref',status:'not_found',message:list.length?'多个同标题版本，请使用正式发表 DOI 查询':'未找到可确认匹配的 DOI 记录'};
 const p=list[0],venue=text(p['container-title']?.[0]),type=p.type==='journal-article'?'journal':p.type==='proceedings-article'?'conference':'';
 return {source:'Crossref',status:'found',matchedBy:ids.doi?'identifier':'title',title:text(p.title?.[0]),venue,year:p.published?.['date-parts']?.[0]?.[0]||null,publication:publication(type?venue:'',type),citations:count(p['is-referenced-by-count']),url:'https://doi.org/'+encodeURI(p.DOI||'')};
}
export async function lookupMetadata(input,config={},fetcher=fetch){
 if(!input||typeof input.title!=='string'||!input.title.trim()||input.title.length>2000||typeof input.paper!=='string'||input.paper.length>2000)throw Error('请提供有效的论文标题和链接。');
 const ids=identifiers(input.paper);
 const tasks=await Promise.allSettled([semantic(input,ids,config.scholarKey,fetcher),crossref(input,ids,fetcher)]);
 return {queriedAt:new Date().toISOString(),sources:tasks.map((r,i)=>r.status==='fulfilled'?r.value:{source:i?'Crossref':'Semantic Scholar',status:'error',message:r.reason.name==='TimeoutError'?'查询超时，请稍后重试':/^服务|^数据源/.test(r.reason.message)?r.reason.message:'暂时无法连接数据源，请稍后重试'})};
}
