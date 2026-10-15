const fs = require('node:fs');
const path = require('node:path');
process.chdir(path.resolve(__dirname, '..'));
let html = fs.readFileSync('dist/index.html', 'utf8');
// Embed the shared brand mark in both versions, including servers started before new assets existed.
const icon='data:image/svg+xml;base64,'+fs.readFileSync('dist/paperdesk-icon.svg').toString('base64');
html=html.replace(/data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+/g,()=>icon);
fs.writeFileSync('dist/index.html',html);
html = html.replace('<link rel="stylesheet" href="style.css">', () => '<style>' + fs.readFileSync('dist/style.css', 'utf8') + '</style>');
html = html.replace('<script src="app.js"></script>', () => '<script>' + fs.readFileSync('dist/app.js', 'utf8') + '</script>');
for(const file of ['vendor/markdown-it/markdown-it.umd.min.js','notes.js'])html=html.replace('<script src="'+file+'"></script>',()=>'<script>'+fs.readFileSync('dist/'+file,'utf8').replace(/<\/script/gi,'<\\/script')+'</script>');
let mathCss=fs.readFileSync('dist/vendor/katex/katex.min.css','utf8');
mathCss=mathCss.replace(/url\((fonts\/[^)]+)\)/g,(_,file)=>{
 const ext=path.extname(file).slice(1);
 return 'url(data:font/'+ext+';base64,'+fs.readFileSync(path.join('dist/vendor/katex',file)).toString('base64')+')';
});
html=html.replace('<link rel="stylesheet" href="vendor/katex/katex.min.css">',()=>'<style>'+mathCss+'</style>');
for(const file of ['katex.min.js','contrib/auto-render.min.js'])html=html.replace('<script src="vendor/katex/'+file+'"></script>',()=>'<script>'+fs.readFileSync('dist/vendor/katex/'+file,'utf8').replace(/<\/script/gi,'<\\/script')+'</script>');
fs.writeFileSync('Paperdesk.html', html);
console.log('Created Paperdesk.html');
