import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const ctx=vm.createContext({console,atob,TextDecoder});
for(const file of ['vendor/markdown-it/markdown-it.umd.min.js','vendor/katex/katex.min.js','notes.js'])vm.runInContext(await fs.readFile(new URL('../dist/'+file,import.meta.url),'utf8'),ctx);
const render=ctx.createNoteRenderer(ctx.markdownit,ctx.katex);
test('common Markdown including tables and task lists renders',()=>{
 const html=render('# 标题\n\n**加粗** *斜体* ~~删除~~ [链接](https://example.com)\n\n> 引用\n\n- [x] 完成\n- [ ] 待办\n\n| A | B |\n|---|---|\n| 1 | 2 |');
 for(const expected of ['<h1>','<strong>加粗</strong>','<em>斜体</em>','<s>删除</s>','<blockquote>','<table>','disabled checked','rel="noopener noreferrer"'])assert.ok(html.includes(expected),expected);
});
test('math preserves underscores, backslashes, line breaks and comparisons',()=>{
 for(const source of ['$x_i < y_j$','\\(x_i\\)','$$\n\\begin{aligned}\na_i &= b_i \\\\\nc_i &= d_i\n\\end{aligned}\n$$','\\[\\frac{a}{b}\\]']){
  const html=render(source);assert.match(html,/class="katex/);assert.doesNotMatch(html,/katex-error|<em>/);
 }
});
test('code remains literal and raw HTML and unsafe links do not execute',()=>{
 const html=render('`**literal** $x_i$`\n\n```js\nconst a = "$x$";\n```\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1))\n\n![x](https://example.com/a.png)');
 assert.match(html,/<code>\*\*literal\*\* \$x_i\$<\/code>/);assert.match(html,/language-js/);assert.doesNotMatch(html,/<script>|href="javascript:|class="katex/);assert.match(html,/&lt;script&gt;/);assert.match(html,/<img/);
});

