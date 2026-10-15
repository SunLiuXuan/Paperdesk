import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
export function validateLibrary(value){
 if(!Array.isArray(value)||value.length>10000)throw Error('文献库格式无效。');
 const ids=new Set();for(const p of value){if(!p||typeof p.id!=='string'||!p.id||ids.has(p.id)||typeof p.title!=='string'||!p.title.trim()||!Array.isArray(p.tags)||p.tags.some(t=>typeof t!=='string'))throw Error('文献库格式无效。');ids.add(p.id);if(p.images!==undefined){if(!Array.isArray(p.images)||p.images.length>6)throw Error('图片数量无效。');for(const im of p.images){if(!im||typeof im.data!=='string'||im.data.length>2800000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(im.data)||typeof im.caption!=='string'||im.caption.length>1000)throw Error('图片格式无效。')}}}return value;
}
const revision=text=>createHash('sha256').update(text).digest('hex');
export function createLibraryStore(directory){
 const filename=path.join(directory,'library.json');let queue=Promise.resolve();
 async function exportImages(papers){
  const imageDir=path.join(directory,'images');await fs.mkdir(imageDir,{recursive:true});const index=[];
  for(const paper of papers){for(const [position,image] of (paper.images||[]).entries()){
   const match=image.data.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
   const bytes=Buffer.from(match[2],'base64');const extension=match[1]==='jpeg'?'jpg':match[1];
   const name=createHash('sha256').update(bytes).digest('hex')+'.'+extension;
   const target=path.join(imageDir,name);
   try{await fs.writeFile(target,bytes,{flag:'wx'})}catch(e){if(e.code!=='EEXIST')throw e;const existing=await fs.readFile(target);if(!existing.equals(bytes))throw Error('本地图片文件损坏，请先备份并检查 data/images/'+name)}
   index.push({paperId:paper.id,title:paper.title,figure:position+1,caption:image.caption,file:name});
  }}
  return index;
 }
 async function writeImageIndex(index){const target=path.join(directory,'images','index.json');const temp=target+'.'+randomUUID()+'.tmp';try{await fs.writeFile(temp,JSON.stringify(index,null,2)+'\n','utf8');await fs.rename(temp,target)}finally{await fs.unlink(temp).catch(()=>{})}}
 async function read(){try{const text=await fs.readFile(filename,'utf8');return {papers:validateLibrary(JSON.parse(text)),revision:revision(text),exists:true,path:filename}}catch(e){if(e.code==='ENOENT')return {papers:[],revision:null,exists:false,path:filename};throw Error('无法读取本地文献库，请检查 data/library.json；为保护数据，已停止覆盖。')}}
 async function write(papers,expected){
  validateLibrary(papers);const old=await read();
  if(old.revision!==expected){const e=Error('文献库已在其他窗口更新。请先导出当前内容，再刷新页面后重试。');e.status=409;throw e}
  const body=JSON.stringify(papers,null,2)+'\n';
  const imageIndex=await exportImages(papers);
  if(old.revision===revision(body)){await writeImageIndex(imageIndex);return {...old,backup:null}}
  await fs.mkdir(path.join(directory,'backups'),{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID();
  const backup=old.exists?path.join(directory,'backups','library-'+stamp+'.json'):null;
  if(backup)await fs.copyFile(filename,backup,fs.constants.COPYFILE_EXCL);
  const temp=path.join(directory,'.library-'+randomUUID()+'.tmp');
  try{const handle=await fs.open(temp,'wx');try{await handle.writeFile(body,'utf8');await handle.sync()}finally{await handle.close()}await fs.rename(temp,filename)}finally{await fs.unlink(temp).catch(()=>{})}
  await writeImageIndex(imageIndex);
  return {papers,revision:revision(body),exists:true,path:filename,backup};
 }
 return {read,save(papers,expected){const result=queue.then(()=>write(papers,expected));queue=result.catch(()=>{});return result}};
}
