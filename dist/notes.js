// Markdown source remains unchanged in storage and exports.
function createNoteRenderer(markdownFactory, mathEngine) {
 const md=markdownFactory({html:false,linkify:true,breaks:true,typographer:false});
 const escape=md.utils.escapeHtml;
 const pairs=[['$$','$$',true],['\\[','\\]',true],['\\(','\\)',false],['$','$',false]];
 function formula(source,pos){
  for(const [left,right,display] of pairs){
   if(!source.startsWith(left,pos))continue;
   if(left==='$'&&/\s/.test(source[pos+1]||' '))return null;
   let end=pos+left.length;
   while((end=source.indexOf(right,end))!==-1){
    let slashes=0;for(let i=end-1;i>=0&&source[i]==='\\';i--)slashes++;
    if(slashes%2===0)break;end+=right.length;
   }
   if(end<0||end===pos+left.length)return null;
   const content=source.slice(pos+left.length,end);
   if(!display&&(content.includes('\n')||/\s$/.test(content)))return null;
   return {content,display,length:end+right.length-pos};
  }
  return null;
 }
 md.inline.ruler.before('escape','paperdesk_math',(state,silent)=>{
  const found=formula(state.src,state.pos);if(!found)return false;
  if(!silent){const token=state.push('paperdesk_math','',0);token.content=found.content;token.meta={display:found.display};}
  state.pos+=found.length;return true;
 });
 md.block.ruler.before('fence','paperdesk_math_block',(state,start,end,silent)=>{
  const pos=state.bMarks[start]+state.tShift[start];
  if(state.sCount[start]-state.blkIndent>=4)return false;
  if(!state.src.startsWith('$$',pos)&&!state.src.startsWith('\\[',pos))return false;
  const found=formula(state.src,pos);if(!found)return false;
  const finish=pos+found.length;
  let last=start;while(last<end&&state.eMarks[last]<finish)last++;
  if(last>=end||state.src.slice(finish,state.eMarks[last]).trim())return false;
  if(silent)return true;
  const token=state.push('paperdesk_math','',0);token.block=true;token.content=found.content;token.meta={display:true};token.map=[start,last+1];state.line=last+1;return true;
 },{alt:['paragraph','reference','blockquote','list']});
 md.renderer.rules.paperdesk_math=(tokens,i)=>{
  const token=tokens[i];const tag=token.block?'div':'span';
  let content;
  try{content=mathEngine?mathEngine.renderToString(token.content,{displayMode:token.meta.display,throwOnError:false,trust:false,strict:'ignore',maxExpand:1000}):escape((token.meta.display?'$$':'$')+token.content+(token.meta.display?'$$':'$'));}
  catch{content=escape(token.content);}
  return '<'+tag+' class="note-math">'+content+'</'+tag+'>';
 };
 // Task markers are parsed only at the beginning of list paragraphs, never code.
 md.core.ruler.after('inline','paperdesk_tasks',state=>{
  function walk(tokens){for(let i=2;i<tokens.length;i++){
   const token=tokens[i];if(token.type!=='inline'||tokens[i-1].type!=='paragraph_open'||tokens[i-2].type!=='list_item_open')continue;
   const first=token.children?.[0];const match=first?.type==='text'&&first.content.match(/^\[([ xX])\]\s+/);if(!match)continue;
   first.content=first.content.slice(match[0].length);
   const check=new state.Token('html_inline','',0);check.content='<input type="checkbox" disabled'+(match[1]!==' '?' checked':'')+' aria-label="任务状态"> ';
   token.children.unshift(check);
  }}walk(state.tokens);
 });
 const linkOpen=md.renderer.rules.link_open||((tokens,i,options,env,self)=>self.renderToken(tokens,i,options));
 md.renderer.rules.link_open=(tokens,i,options,env,self)=>{tokens[i].attrSet('target','_blank');tokens[i].attrSet('rel','noopener noreferrer');return linkOpen(tokens,i,options,env,self)};
 return source=>md.render(String(source||''));
}
let noteRenderer;
function renderNotes(source){
 if(typeof markdownit!=='function')return '<p class="hint">Markdown 组件未加载，请重启 start.cmd 并按 Ctrl+F5 刷新。</p><div class="note-plain">'+esc(source)+'</div>';
 if(!noteRenderer)noteRenderer=createNoteRenderer(markdownit,typeof katex==='undefined'?null:katex);
 return noteRenderer(source);
}
