// Extract existing embedded figures without changing the paper contents.
import {createLibraryStore} from '../storage.mjs';
import {fileURLToPath} from 'node:url';
const store=createLibraryStore(fileURLToPath(new URL('../data/',import.meta.url)));
const current=await store.read();
if(current.exists){await store.save(current.papers,current.revision);console.log('本地图片已导出，数量：'+current.papers.reduce((n,p)=>n+(p.images?.length||0),0))}
else console.log('尚无文献库，首次保存图片时会自动创建文件。');
