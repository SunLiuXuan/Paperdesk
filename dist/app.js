const $=s=>document.querySelector(s), KEY='paperdesk.v1';
const examples=[];
let aliasFitFrame=0;
function scheduleAliasFit(){
 cancelAnimationFrame(aliasFitFrame);
 aliasFitFrame=requestAnimationFrame(()=>{
  document.querySelectorAll('.card-identity .alias').forEach(el=>{
   el.style.fontSize='21px';
   const available=el.getBoundingClientRect().width-2;
   if(available<=0)return;
   // Measure the text itself, independently of the ellipsis/clipped box.
   const range=document.createRange();range.selectNodeContents(el);
   const textWidth=range.getBoundingClientRect().width;
   if(textWidth>available)el.style.fontSize=Math.max(14,Math.floor(21*available/textWidth*10)/10)+'px';
  });
 });
}
function starIcon(){return '<svg class="star-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m12 3 2.78 5.63L21 9.54l-4.5 4.38 1.06 6.19L12 17.18l-5.56 2.93 1.06-6.19L3 9.54l6.22-.91L12 3Z"/></svg>'}
function starButton(p){return '<button type="button" class="paper-star'+(p.starred?' starred':'')+'" data-star="'+esc(p.id)+'" aria-pressed="'+(p.starred===true)+'" aria-label="'+(p.starred?'取消星标':'添加星标')+'：'+esc(p.title)+'" title="'+(p.starred?'取消星标':'添加星标')+'">'+starIcon()+'</button>'}
async function toggleStar(id,button){
 const paper=papers.find(p=>p.id===id);if(!paper||saving)return;
 button.disabled=true;
 try{const next=papers.map(p=>p.id===id?{...p,starred:!p.starred}:p);
  if(await persist(next)){if($('#detail').open&&selected===id)showDetail(id);notify(paper.starred?'已取消星标':'已添加星标')}
 }finally{if(button.isConnected)button.disabled=false}
}
const metadataResults=new Map();
function metadataKey(p){return JSON.stringify([p.id,p.title,p.paper])}
function metadataPanel(p){
 const saved=metadataResults.get(metadataKey(p));
 return '<section class="paper-metadata"><div class="metadata-heading"><h3>发表信息与引用数</h3><button type="button" id="metadata-refresh">'+(saved?'刷新查询':'联网查询')+'</button></div><p class="hint">查询将向 Semantic Scholar、Crossref 发送论文标题与论文标识；不发送笔记。数据库更新可能滞后，不同来源的引用数分别展示；不会覆盖你填写的会议/期刊。</p><p><a href="https://scholar.google.com/scholar?q='+encodeURIComponent(p.title)+'" target="_blank" rel="noopener noreferrer">Google Scholar 搜索 ↗</a></p><div class="github-metrics"><b>GitHub Stars</b> <button type="button" id="github-refresh">刷新</button><p id="github-result" role="status">根据 Code 链接查询公开仓库；会向 GitHub 发送仓库名称。</p></div><div id="metadata-result" role="status">'+(saved?metadataHTML(saved):'点击查询最新数据库记录；未收录不等于未录用。')+'</div></section>';
}
function metadataHTML(result){
 return '<p class="metadata-time">查询时间：'+esc(new Date(result.queriedAt).toLocaleString())+'</p>'+result.sources.map(s=>'<section class="metadata-source"><b>'+esc(s.source)+'</b>'+(s.status!=='found'?'<p>'+esc(s.message)+'</p>':'<p>'+esc(s.publication)+'</p><p>场所：'+esc(s.venue||'未提供')+(s.year?' · '+esc(s.year):'')+'</p><p>引用数：<strong>'+esc(s.citations===null?'未提供':s.citations)+'</strong> <small>（'+esc(s.source)+' 统计）</small></p><p class="hint">'+(s.matchedBy==='title'?'按标题精确匹配，属于候选记录，请核对版本与作者。':'按 DOI / arXiv 标识匹配。')+'</p><p>匹配标题：'+esc(s.title)+'</p>'+(url(s.url)?'<a href="'+esc(url(s.url))+'" target="_blank" rel="noopener noreferrer">查看来源并核对 ↗</a>':''))+'</section>').join('');
}
function renderNoteMath(element){
 if(typeof renderMathInElement!=='function'){
  const message=document.createElement('p');message.className='hint';message.setAttribute('role','status');
  message.textContent='公式组件未加载。请关闭旧的服务窗口，重新运行 start.cmd，再按 Ctrl+F5 刷新页面。笔记原文已保留。';
  element.prepend(message);return;
 }
 renderMathInElement(element,{delimiters:[
  {left:'$$',right:'$$',display:true},
  {left:'\\[',right:'\\]',display:true},
  {left:'\\(',right:'\\)',display:false},
  {left:'$',right:'$',display:false}
 ],ignoredClasses:['note-math'],throwOnError:false,trust:false,strict:'ignore',maxExpand:1000});
}
let editorImages=[],imageLoading=false,imageSession=0;
function alphaLink(link){try{const u=new URL(link);if(!['arxiv.org','www.arxiv.org','export.arxiv.org'].includes(u.hostname))return '';const id=u.pathname.match(/^\/(?:abs|pdf)\/(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[A-Z]{2})?\/\d{7}(?:v\d+)?)(?:\.pdf)?\/?$/)?.[1];return id?'https://www.alphaxiv.org/abs/'+id:''}catch{return ''}}
function validateImages(images){if(images===undefined)return [];if(!Array.isArray(images)||images.length>6)throw Error('图片数量不正确');return images.map(im=>{if(!im||typeof im.data!=='string'||im.data.length>2800000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(im.data))throw Error('图片格式不正确');return {data:im.data,caption:typeof im.caption==='string'?im.caption.slice(0,1000):''}})}
function renderEditorImages(){const list=$('#figure-list');list.replaceChildren();editorImages.forEach((im,i)=>{const card=document.createElement('div');card.className='figure-item';const image=document.createElement('img');image.src=im.data;image.alt='附图 '+(i+1);const caption=document.createElement('input');caption.placeholder='图片说明，例如：模型整体架构';caption.setAttribute('aria-label','附图 '+(i+1)+' 说明');caption.value=im.caption;caption.maxLength=1000;caption.oninput=()=>{im.caption=caption.value};const remove=document.createElement('button');remove.type='button';remove.textContent='移除此图';remove.onclick=()=>{editorImages.splice(i,1);renderEditorImages()};card.append(image,caption,remove);list.append(card)})}
function figureGallery(p){return p.images?.length?'<section class="figure-gallery"><h3>架构图 / 附图</h3>'+p.images.map((im,i)=>'<figure><button type="button" class="figure-zoom" data-figure="'+i+'" aria-label="查看附图 '+(i+1)+' 大图"><img src="'+esc(im.data)+'" alt="附图 '+(i+1)+'" loading="lazy"></button><figcaption>'+esc(im.caption||'图 '+(i+1))+'</figcaption></figure>').join('')+'</section>':''}
async function addFigures(files){if(imageLoading){notify('图片读取中，请稍候');return}const chosen=Array.from(files);if(chosen.length+editorImages.length>6){notify('每篇最多添加 6 张图片');return}const session=imageSession;imageLoading=true;try{const added=[];for(const file of chosen){if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024)throw Error('请选择不超过 2 MB 的 PNG、JPEG 或 WebP 图片');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('图片读取失败'));reader.readAsDataURL(file)});await new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=()=>reject(Error('无法读取该图片，请换一张'));img.src=data});added.push({data,caption:''})}if(session===imageSession){editorImages.push(...added);renderEditorImages();notify('图片已加入草稿，请保存笔记')}}catch(e){if(session===imageSession)notify(e.message)}finally{if(session===imageSession)imageLoading=false}}
let diskReady=false,diskToken='',diskRevision=null,saving=false,localReadFailed=false;
const diskMode=location.protocol!=='file:';
let papers=[],state={status:'全部文献',tag:'',view:'cards',starredOnly:false},editing=null,selected=null;
function notify(t){$('#toast').textContent=t;$('#toast').style.display='block';if($('#editor').open)$('#editor-feedback').textContent=t;clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').style.display='none',3500)}
try{const raw=localStorage.getItem(KEY);papers=raw===null?structuredClone(examples):validate(JSON.parse(raw)).filter(p=>!(p.demo&&/^demo-\d+$/.test(p.id)))}catch(e){localReadFailed=true;papers=structuredClone(examples);setTimeout(()=>notify('无法读取本地数据，已展示示例；请先导出备份再保存。'),500)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function url(s){try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}}
function storageStatus(message,error=false){const enabled=message.includes('✓');$('#storage-status').textContent=enabled?'自动备份已开启':message;$('#storage-status').classList.toggle('storage-error',error)}
async function persist(next){
 if(saving){notify('正在保存，请稍候。');return false}
 if(diskMode&&!diskReady){notify('本地文献库未连接，请重启服务并刷新；可先导出当前备份。');return false}
 saving=true;
 try{
  if(diskMode){storageStatus('正在保存到电脑…');const res=await fetch('/api/library',{method:'POST',headers:{'Content-Type':'application/json','X-Paperdesk-Token':diskToken},body:JSON.stringify({papers:next,revision:diskRevision}),signal:AbortSignal.timeout(15000)});const result=await res.json();if(!res.ok)throw Error(result.error||'本地保存失败');diskRevision=result.revision;storageStatus('✓ 已保存到电脑 · '+new Date().toLocaleTimeString());$('#storage-status').title=result.path;}
  try{localStorage.setItem(KEY,JSON.stringify(next))}catch(e){if(!diskMode)throw Error('浏览器保存失败，请导出备份。')}
  papers=next;render();if(!diskMode)storageStatus('仅浏览器保存 · 使用 start.cmd 可自动备份到电脑');return true;
 }catch(e){storageStatus('保存未确认 · 请保留当前内容并导出备份',true);notify(e.message||'保存失败，未关闭编辑窗口。');return false}finally{saving=false}
}
async function initStorage(){
 if(!diskMode){if(!localReadFailed){try{localStorage.setItem(KEY,JSON.stringify(papers))}catch{}}storageStatus('仅浏览器保存 · 使用 start.cmd 可自动备份到电脑');return}
 storageStatus('正在读取电脑中的文献库…');
 try{
  const statusResponse=await fetch('/api/status',{signal:AbortSignal.timeout(8000)});if(!statusResponse.ok)throw Error();diskToken=(await statusResponse.json()).token;
  const response=await fetch('/api/library',{signal:AbortSignal.timeout(8000)});const data=await response.json();if(!response.ok)throw Error(data.error||'无法读取本地文件');
  diskRevision=data.revision;
  if(data.exists){const loaded=validate(data.papers);let old=null,cachePreserved=true;try{old=localStorage.getItem(KEY)}catch{}if(old&&old!==JSON.stringify(loaded)){try{localStorage.setItem(KEY+'.before-disk',old)}catch{cachePreserved=false;notify('浏览器缓存空间不足，已使用电脑文献库；浏览器旧副本仍保留。')}}papers=loaded;if(cachePreserved){try{localStorage.setItem(KEY,JSON.stringify(papers))}catch{}}diskReady=true;render();storageStatus('✓ 已从电脑文件恢复 · 自动备份已开启');$('#storage-status').title=data.path;}
  else{if(localReadFailed)throw Error('浏览器旧数据无法读取，已暂停自动迁移。请先恢复备份。');diskReady=true;if(!await persist(papers))diskReady=false;}
 }catch(e){diskReady=false;storageStatus(e.message||'本地服务未连接 · 保存已暂停，请启动 start.cmd 后刷新',true)}
}

function validate(data){if(!Array.isArray(data)||data.length>10000)throw Error('格式错误');const ids=new Set();return data.map(p=>{if(!p||typeof p.title!=='string'||!p.title.trim()||typeof p.id!=='string'||ids.has(p.id)||!Array.isArray(p.tags))throw Error('格式错误');ids.add(p.id);const out={};for(const k of ['id','title','alias','venue','published','read','summary','datasets','results','paper','code','dataset_url','notes'])out[k]=typeof p[k]==='string'?p[k]:'';out.status=['待读','在读','已读'].includes(p.status)?p.status:'待读';out.tags=p.tags.filter(x=>typeof x==='string');out.starred=p.starred===true;out.demo=p.demo===true;out.images=validateImages(p.images);return out})}
function filtered(){const q=$('#search').value.toLowerCase().trim(),kind=$('#date-kind').value,from=$('#from').value,to=$('#to').value;return papers.filter(p=>{const d=p[kind];const end=d?.length===4?d+'-12-31':d?.length===7?d+'-31':d;const start=d?.length===4?d+'-01-01':d?.length===7?d+'-01':d;return (!state.starredOnly||p.starred===true)&&(state.status==='全部文献'||p.status===state.status)&&(!state.tag||p.tags.includes(state.tag))&&(!q||[p.title,p.alias,p.venue,p.summary,p.notes,p.datasets,...p.tags].join(' ').toLowerCase().includes(q))&&(!from||(d&&end>=from))&&(!to||(d&&start<=to))}).sort((a,b)=>$('#sort').value==='title'?a.title.localeCompare(b.title):(b[$('#sort').value]||'').localeCompare(a[$('#sort').value]||''))}
function resourceLinks(p){const links=[[p.paper,'论文 / arXiv'],[alphaLink(p.paper),'alphaXiv'],[p.code,'Code'],[p.dataset_url,'Dataset']];return links.filter(([href])=>url(href)).map(([href,label])=>'<a href="'+esc(url(href))+'" target="_blank" rel="noopener">'+label+' ↗</a>').join('')}
function status(p){return `<span class="status ${p.status==='在读'?'reading':p.status==='待读'?'todo':''}">${p.status==='已读'?'✓ ':p.status==='在读'?'◐ ':'○ '}${p.status}</span>`}
function render(){const tags=[...new Set(papers.flatMap(p=>p.tags))].sort();$('#nav').innerHTML=['全部文献','在读','待读','已读'].map((s,i)=>`<button class="${state.status===s?'active':''}" data-status="${s}">${['▦','◐','◷','✓'][i]} &nbsp; ${s}<span>${s==='全部文献'?papers.length:papers.filter(p=>p.status===s).length}</span></button>`).join('');$('#tags').innerHTML=tags.map(t=>`<button class="${state.tag===t?'active':''}" data-tag="${esc(t)}"># ${esc(t)}</button>`).join('');$('#crumb').textContent=state.status;$('#stats').innerHTML=[['收藏文献',papers.length,'篇灵感积累'],['正在阅读',papers.filter(p=>p.status==='在读').length,'篇正在探索'],['完成阅读',papers.filter(p=>p.status==='已读').length,'篇已沉淀'],['研究主题',tags.length,'个方向连接']].map(([t,n,h])=>`<div class="stat"><div class="stat-top">${t}</div><div class="stat-num">${String(n).padStart(2,'0')}<small>${h}</small></div></div>`).join('');const list=filtered();$('#count').textContent=`${state.tag?'# '+state.tag+' · ':''}共 ${list.length} 篇文献`;
 $('#demo-label').textContent=papers.some(p=>p.demo)?'DEMO COLLECTION · 含虚构示例，非真实论文':'PERSONAL COLLECTION · 我的文献积累';$('#content').className=state.view==='cards'?'cards':'';
 if(!list.length){$('#content').innerHTML='<div class="empty"><h3>这里还有一页空白</h3><p>新建你的第一篇笔记，或调整搜索与筛选条件。</p><button id="empty-reset">清除筛选</button></div>';return}
 if(state.view==='cards')$('#content').innerHTML=list.map(p=>`<article class="card" data-id="${esc(p.id)}" tabindex="0" role="button" aria-label="打开 ${esc(p.title)}"><div class="card-top"><span class="card-identity"><span class="alias" title="${esc(p.alias||'Paper')}">${esc(p.alias||'Paper')}</span>${p.venue?`<span class="venue-label" title="录用会议／期刊">${esc(p.venue)}</span>`:''}</span><span class="card-controls">${starButton(p)}${status(p)}</span></div><h3>${url(p.paper)?`<a href="${esc(url(p.paper))}" target="_blank" rel="noopener">${esc(p.title)} ↗</a>`:esc(p.title)}</h3><p class="summary">${esc(p.summary||'还没有一句话总结，点击记录你的理解。')}</p><div class="chips">${p.tags.map(t=>`<span class="chip">${esc(t)}</span>`).join('')}${p.demo?'<span class="chip">示例</span>':''}</div><div class="resource-links">${resourceLinks(p)}</div><div class="card-bottom"><span>◷ ${esc(p.read||'尚未阅读')}</span><span>发表 ${esc(p.published||'待补充')}</span></div></article>`).join('');
 else $('#content').innerHTML='<div class="table-wrap"><table class="overview-table"><thead><tr>'+['论文 / 缩写','会议/期刊','发表时间','一句话总结','数据集','Code'].map(t=>`<th>${t}</th>`).join('')+'</tr></thead><tbody>'+list.map(p=>`<tr data-id="${esc(p.id)}"><td><span class="table-identity"><b>${esc(p.alias)}</b>${starButton(p)}</span>${url(p.paper)?`<a href="${esc(url(p.paper))}" target="_blank" rel="noopener">${esc(p.title)} ↗</a>`:esc(p.title)}${p.demo?' · 示例':''}</td><td>${esc(p.venue||'—')}</td><td>${esc(p.published||'—')}</td><td>${esc(p.summary||'—')}</td><td>${url(p.dataset_url)?`<a href="${esc(url(p.dataset_url))}" target="_blank" rel="noopener">${esc(p.datasets||'Dataset')} ↗</a>`:esc(p.datasets||'—')}</td><td>${url(p.code)?`<a href="${esc(url(p.code))}" target="_blank" rel="noopener">打开 ↗</a>`:'—'}</td></tr>`).join('')+'</tbody></table></div>';
}
const renderLayout=render;
render=function(){renderLayout();scheduleAliasFit();$('#star-filter').setAttribute('aria-pressed',String(state.starredOnly));$('#star-filter').classList.toggle('active',state.starredOnly);const labels=['论文 / 缩写','会议/期刊','发表时间','一句话总结','数据集','Code'];document.querySelectorAll('#content tbody tr').forEach(row=>{Array.from(row.cells).forEach((cell,i)=>{cell.dataset.label=labels[i];const value=document.createElement('div');value.className='cell-value';while(cell.firstChild)value.append(cell.firstChild);cell.append(value)})})};
function reset(){state.starredOnly=false;state.tag='';state.status='全部文献';$('#search').value='';$('#from').value='';$('#to').value='';render()}
function openEditor(p){imageSession++;imageLoading=false;editorImages=structuredClone(p?.images||[]);editing=p?.id||null;$('#form').reset();renderEditorImages();$('#editor-feedback').textContent='';$('#edit-title').textContent=p?'编辑文献笔记':'新建文献笔记';for(const el of $('#form').elements)if(el.name)el.value=p?(el.name==='tags'?p.tags.join(', '):p[el.name]||''):el.name==='status'?'待读':el.name==='read'?new Date().toLocaleDateString('en-CA'):'';$('#editor').showModal()}
function showDetail(id){const p=papers.find(x=>x.id===id);if(!p)return;selected=id;$('#detail-body').innerHTML=`<div class="dialog-head"><div><div class="eyebrow">${esc(p.alias||'PAPER NOTE')}${p.demo?' / 虚构示例':''}</div><h2>${esc(p.title)}</h2></div><button class="close" data-close="detail" aria-label="关闭">×</button></div><div class="detail-meta">${status(p)}${starButton(p)}<span>发表 ${esc(p.published||'未填写')}</span><span>阅读 ${esc(p.read||'未填写')}</span>${p.venue?`<span>录用：${esc(p.venue)}</span>`:''}</div><div class="chips">${p.tags.map(t=>`<span class="chip"># ${esc(t)}</span>`).join('')}</div><div class="callout">${esc(p.summary||'尚未填写一句话总结')}</div><div class="detail-data">数据集：${esc(p.datasets||'待补充')}<br>关键结果：${esc(p.results||'待补充')}</div><div class="detail-links">${resourceLinks(p)}</div>${metadataPanel(p)}<h3>阅读笔记</h3><div class="note-body">${renderNotes(p.notes||'还没有笔记，开始记录你的想法吧。')}</div>${figureGallery(p)}<div class="form-actions"><button class="danger" id="delete">删除笔记</button><button id="markdown">↓ 导出 Markdown</button><button class="primary" id="edit">编辑笔记</button></div>`;renderNoteMath($('#detail-body'));$('#detail').showModal();loadGithub(p)}
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(b?.dataset.star){await toggleStar(b.dataset.star,b);return}if(b?.id==='star-filter'){state.starredOnly=!state.starredOnly;render();return}if(b?.dataset.close)$('#'+b.dataset.close).close();if(b?.dataset.status){state.status=b.dataset.status;render()}if(b?.dataset.tag){state.tag=state.tag===b.dataset.tag?'':b.dataset.tag;render()}if(b?.dataset.view){state.view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b));render()}if(e.target.closest('a'))return;const card=e.target.closest('[data-id]');if(card)showDetail(card.dataset.id);if(b?.id==='empty-reset')reset();if(b?.id==='edit'){$('#detail').close();openEditor(papers.find(p=>p.id===selected))}if(b?.id==='delete'&&confirm('确定删除这篇笔记？建议先导出备份。')){if(await persist(papers.filter(p=>p.id!==selected))){$('#detail').close();notify('笔记已删除')}}if(b?.id==='markdown'){const p=papers.find(p=>p.id===selected);download((p.alias||'paper')+'.md','---\n'+['id','title','alias','venue','published','read','status','starred','tags','summary','datasets','results','paper','code','dataset_url'].map(k=>k+': '+JSON.stringify(p[k]??'')).join('\n')+'\n---\n\n'+p.notes+(p.images||[]).map((im,i)=>'\n\n![图 '+(i+1)+']('+im.data+')\n\n'+im.caption).join(''),'text/markdown')}});
document.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.matches('.card')){e.preventDefault();showDetail(e.target.dataset.id)}});
$('#new').onclick=()=>openEditor();$('#search').oninput=render;for(const id of ['sort','date-kind','from','to'])$('#'+id).onchange=render;$('#filter-toggle').onclick=()=>{$('#date-filters').hidden=!$('#date-filters').hidden};$('#reset').onclick=reset;
$('#form').onsubmit=async e=>{e.preventDefault();const p=Object.fromEntries(new FormData(e.target));p.title=p.title.trim();p.venue=(p.venue||'').trim();if(!p.title){notify('请填写论文标题');return}for(const k of ['code','paper','dataset_url'])if(p[k]&&!url(p[k])){notify('链接仅支持 http 或 https');return}if(p.published){const parts=p.published.split('-').map(Number);if((parts[1]&&(parts[1]<1||parts[1]>12))||(parts.length>1&&!parts[1])||(parts.length===3&&(parts[2]<1||parts[2]>new Date(parts[0],parts[1],0).getDate()))){notify('请填写有效的发表日期');return}}if(imageLoading){notify('图片仍在读取，请稍候保存。');return}p.images=structuredClone(editorImages);p.tags=[...new Set(p.tags.split(/[,，、]/).map(t=>t.trim()).filter(Boolean))];p.id=editing||crypto.randomUUID();p.starred=editing?papers.find(x=>x.id===editing)?.starred===true:false;p.demo=editing?papers.find(x=>x.id===editing)?.demo===true:false;const next=editing?papers.map(x=>x.id===editing?p:x):[p,...papers];if(await persist(next)){$('#editor').close();notify('笔记已保存，概览已自动更新')}};
function download(name,body,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([body],{type:type+';charset=utf-8'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function csvCell(s){s=String(s??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
$('#csv').onclick=()=>{const rows=filtered().map(p=>[p.title,p.alias,p.venue||'',p.read,p.status,p.starred?'是':'否',p.summary,p.datasets,p.results,p.paper,p.code,p.dataset_url||'',p.demo?'虚构示例':'']);download('文献概览.csv','\ufeff'+[['论文标题','缩写','会议/期刊','阅读时间','状态','星标','一句话总结','数据集','关键结果','论文链接','Code','Dataset 链接','备注'],...rows].map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv');notify(`已导出当前筛选的 ${rows.length} 篇文献`)};
$('#backup').onclick=()=>download('paperdesk-backup.json',JSON.stringify(papers,null,2),'application/json');$('#restore').onclick=()=>$('#file').click();$('#file').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>20000000)throw Error();const next=validate(JSON.parse(await f.text()));if(confirm(`将用备份中的 ${next.length} 篇笔记替换当前文献库，是否继续？`)){if(await persist(next))notify('备份导入成功')}}catch{notify('导入失败：请选择有效的 Paperdesk JSON 备份')}finally{e.target.value=''}};
let detailOutside=false;
function outsideDialog(event,dialog){const r=dialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom}
$('#detail').addEventListener('pointerdown',e=>{detailOutside=e.target===$('#detail')&&outsideDialog(e,$('#detail'))});
$('#detail').addEventListener('click',e=>{if(detailOutside&&e.target===$('#detail')&&outsideDialog(e,$('#detail')))$('#detail').close();detailOutside=false});
const aiFields={title:'论文标题',alias:'缩写',venue:'会议/期刊',published:'发表时间',tags:'标签',summary:'一句话总结',datasets:'数据集名称',results:'关键结果',paper:'论文链接',code:'Code 链接',dataset_url:'Dataset 链接',notes:'结构化阅读笔记'};
let aiToken='',aiController=null,aiSession=0;
$('#ai-open').onclick=async()=>{
 const session=++aiSession;$('#ai-preview').replaceChildren();$('#ai-apply').hidden=true;$('#ai-feedback').textContent='';$('#ai-status').textContent='正在检查服务配置…';$('#ai-generate').disabled=true;
 $('#ai-url').value=$('#form').elements.paper.value;$('#ai-source').value=$('#form').elements.notes.value;$('#ai-source').maxLength=60000;$('#ai-dialog').showModal();
 if(location.protocol==='file:'){$('#ai-status').textContent='当前是单文件版。使用 AI 请先按 docs/AI-SETUP.md 配置 .env，双击 start.cmd，再打开 http://127.0.0.1:4174。原有笔记可通过导出、导入备份迁移。';return}
 try{const res=await fetch('/api/status',{signal:AbortSignal.timeout(8000)});if(!res.ok)throw Error();const info=await res.json();if(session!==aiSession)return;aiToken=info.token;$('#ai-status').textContent=info.configured?`模型：${info.model} · 服务：${info.provider}`:'尚未配置 AI。请按 docs/AI-SETUP.md 填写 .env 中的 API Key、模型和地址，然后重启 start.cmd。';$('#ai-generate').disabled=!info.configured}catch{if(session===aiSession)$('#ai-status').textContent='未连接到 AI 本地服务。请运行 start.cmd 并从 http://127.0.0.1:4174 打开。'}
};
$('#ai-dialog').addEventListener('close',()=>{aiSession++;aiController?.abort();aiController=null});
$('#ai-generate').onclick=async()=>{
 const link=$('#ai-url').value.trim(),source=$('#ai-source').value.trim();if(link&&!url(link)){$('#ai-feedback').textContent='请输入有效的 http 或 https 链接。';return}if(!link&&!source){$('#ai-feedback').textContent='请提供论文链接或粘贴摘要、笔记。';return}
 const session=aiSession;aiController=new AbortController();$('#ai-generate').disabled=true;$('#ai-generate').textContent='正在读取与整理…';$('#ai-feedback').textContent='通常需要数十秒；请等待本次生成完成。';$('#ai-preview').replaceChildren();$('#ai-apply').hidden=true;
 try{const res=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json','X-Paperdesk-Token':aiToken},body:JSON.stringify({url:link,source,tags:[...new Set(papers.flatMap(p=>p.tags))]}),signal:aiController.signal});const result=await res.json();if(!res.ok)throw Error(result.error||'生成失败');if(session!==aiSession)return;
 $('#ai-feedback').textContent=result.basis+' 请核对以下内容；勾选的字段会替换表单中对应的值。';
 for(const [key,label] of Object.entries(aiFields)){const value=key==='tags'?(result.draft.tags||[]).join(', '):result.draft[key]||'';if(!value)continue;const row=document.createElement('section');row.className='ai-field';const caption=document.createElement('label');const check=document.createElement('input');check.type='checkbox';check.dataset.aiField=key;check.checked=!$('#form').elements.namedItem(key).value.trim();caption.append(check,document.createTextNode(label));const area=document.createElement('textarea');area.dataset.aiValue=key;area.setAttribute('aria-label','AI 草稿：'+label);area.rows=key==='notes'?8:key==='summary'?3:2;area.value=value;row.append(caption,area);$('#ai-preview').append(row)}$('#ai-apply').hidden=false;
 }catch(e){if(session===aiSession&&e.name!=='AbortError')$('#ai-feedback').textContent=e.message||'网络请求失败，请检查本地服务。'}finally{if(session===aiSession){$('#ai-generate').disabled=false;$('#ai-generate').textContent='重新生成草稿'}}
};
$('#ai-apply').onclick=()=>{let count=0;document.querySelectorAll('[data-ai-field]:checked').forEach(check=>{const key=check.dataset.aiField;$('#form').elements.namedItem(key).value=document.querySelector('[data-ai-value="'+key+'"]').value;count++});if(!count){$('#ai-feedback').textContent='请先勾选要填入的字段。';return}$('#ai-dialog').close();notify(`已填入 ${count} 个字段，请核对并保存笔记。`)};
$('#home').onclick=e=>{e.preventDefault();state.view='cards';$('#sort').value='read';$('#date-kind').value='read';$('#date-filters').hidden=true;document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view==='cards'));reset();window.scrollTo({top:0,behavior:'auto'})};
render();

$('#figure-add').onclick=()=>$('#figure-files').click();
$('#figure-files').onchange=async e=>{await addFigures(e.target.files);e.target.value=''};
$('#figure-paste').onpaste=e=>{const images=Array.from(e.clipboardData.items).filter(item=>item.type.startsWith('image/')).map(item=>item.getAsFile()).filter(Boolean);if(images.length){e.preventDefault();addFigures(images)}};
$('#editor').addEventListener('close',()=>{imageSession++;imageLoading=false});
document.addEventListener('click',e=>{const b=e.target.closest('[data-figure]');if(!b)return;const im=papers.find(p=>p.id===selected)?.images?.[Number(b.dataset.figure)];if(!im)return;$('#figure-full').src=im.data;$('#figure-full-caption').textContent=im.caption;$('#figure-view').showModal()});
$('#figure-view').addEventListener('click',e=>{if(e.target===$('#figure-view')&&outsideDialog(e,$('#figure-view')))$('#figure-view').close()});
document.addEventListener('click',async event=>{
 const button=event.target.closest('#metadata-refresh');if(!button)return;
 const p=papers.find(p=>p.id===selected),target=$('#metadata-result');if(!p||!target)return;
 if(!diskMode){target.textContent='联网查询需要本地服务，请运行 start.cmd 后打开服务版。';return}
 const key=metadataKey(p);button.disabled=true;target.textContent='正在查询两个数据源…';
 try{
  const res=await fetch('/api/metadata',{method:'POST',headers:{'Content-Type':'application/json','X-Paperdesk-Token':diskToken},body:JSON.stringify({title:p.title,paper:p.paper||''}),signal:AbortSignal.timeout(22000)});
  if(res.status===404)throw Error('请关闭旧服务，重新运行 start.cmd，再按 Ctrl+F5 刷新。');
  const result=await res.json();if(!res.ok)throw Error(result.error||'查询失败');metadataResults.set(key,result);
  if(target.isConnected)target.innerHTML=metadataHTML(result);
 }catch(e){if(target.isConnected)target.textContent=e.name==='TimeoutError'?'查询超时，请稍后重试。':e.message||'查询失败。';}
 finally{if(button.isConnected){button.disabled=false;button.textContent='刷新查询'}}
});
initStorage();

// Refit when responsive columns change, including after fonts finish loading.
let aliasContainerWidth=-1;
const aliasResizeObserver=new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(width!==aliasContainerWidth){aliasContainerWidth=width;scheduleAliasFit()}});
aliasResizeObserver.observe($('#content'));
window.addEventListener('resize',scheduleAliasFit);
document.fonts?.ready.then(scheduleAliasFit);

const githubResults=new Map(),githubPending=new Map();
async function loadGithub(p,force=false){
 const target=$('#github-result'),button=$('#github-refresh');if(!target)return;
 if(!p.code){target.textContent='填写 GitHub Code 链接后自动获取。';button.hidden=true;return}
 let valid=false;try{const u=new URL(p.code);valid=u.protocol==='https:'&&u.hostname==='github.com'}catch{}
 if(!valid){target.textContent='当前 Code 链接不是 GitHub 仓库。';button.hidden=true;return}
 if(!diskMode){target.textContent='自动获取需要通过 start.cmd 启动本地服务。';return}
 button.disabled=true;target.textContent='正在获取 GitHub Stars…';
 try{
  let result=githubResults.get(p.code);
  if(force||!result||Date.now()-Date.parse(result.queriedAt)>600000){
   let pending=githubPending.get(p.code);
   if(!pending){pending=(async()=>{const response=await fetch('/api/github',{method:'POST',headers:{'Content-Type':'application/json','X-Paperdesk-Token':diskToken},body:JSON.stringify({code:p.code}),signal:AbortSignal.timeout(20000)});if(response.status===404)throw Error('请重新运行 start.cmd 并刷新页面。');const data=await response.json();if(!response.ok)throw Error(data.error||'GitHub 查询失败');githubResults.set(p.code,data);return data})();githubPending.set(p.code,pending);pending.finally(()=>githubPending.delete(p.code)).catch(()=>{});}
   result=await pending;
  }
  if(target.isConnected)target.innerHTML='<a href="'+esc(result.url)+'" target="_blank" rel="noopener noreferrer">'+esc(result.repository)+' ↗</a> · <strong>'+esc(result.stars===null?'未提供':result.stars.toLocaleString())+' Stars</strong><br><small>GitHub 仓库关注数 · 查询时间：'+esc(new Date(result.queriedAt).toLocaleString())+'</small>';
 }catch(e){if(target.isConnected)target.textContent=e.message||'GitHub 查询失败，请稍后重试。'}
 finally{if(button.isConnected)button.disabled=false}
}
document.addEventListener('click',event=>{if(event.target.closest('#github-refresh')){const p=papers.find(p=>p.id===selected);if(p)loadGithub(p,true)}});
