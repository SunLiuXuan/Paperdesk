# PaperDesk · 文献手记

一个在本机运行的论文笔记工具：整理阅读记录、查找论文资源、生成 AI 草稿，并将笔记和附图保存在电脑中。

## 功能

- 文献卡片与概览表格；按阅读状态、标签、阅读时间和发表时间筛选。
- 论文 / arXiv、alphaXiv、Code、Dataset 快捷链接。
- 阅读笔记支持 LaTeX 公式、上传图片和粘贴截图。
- 可配置兼容 Chat Completions 的 AI 服务，生成标题、标签、总结和结构化笔记，人工确认后保存。
- 自动保存到本地 JSON，修改前保留历史版本，支持完整备份恢复。
- 导出单篇 Markdown、当前筛选的 CSV 和整个文献库的 JSON。
- 适配桌面与窄屏；附带可独立打开的单文件版本。

## 快速开始

需要 **Node.js 22 或更高版本**。运行时不依赖 npm 包，无需 `npm install`。

下载仓库并解压，在项目目录运行：

```sh
node server.mjs
```

Windows 也可以双击 [start.cmd](start.cmd)。浏览器打开 **http://127.0.0.1:4174**，确认左下角显示“自动备份已开启”。保持服务终端运行；退出前保存笔记，再关闭终端。

首次启动会自动创建 `data/`，无需准备文献数据。普通笔记、公式和本地备份不需要 AI 密钥。

> 服务仅监听本机地址，不是带账户系统的公网服务。GitHub 用于托管源码；GitHub Pages 不能运行这里的 Node.js 服务、本地文件备份或 AI 接口。

## 日常使用

1. 点击“新建笔记”，填写论文标题、链接、阅读日期和状态。其他字段可稍后补充。
2. 标签使用逗号分隔；发表时间支持 `YYYY`、`YYYY-MM`、`YYYY-MM-DD`。
3. 写一句话总结和阅读笔记，按需添加架构图。
4. 点击“保存笔记”。保存成功后更新文献卡片、概览和本地文件。
5. 点击卡片阅读详情；点击详情外侧空白或 × 返回。编辑框中的内容必须主动保存。

概览表格包含论文 / 缩写、发表时间、一句话总结、数据集、Code。发表时间和标签仍可用于筛选。有效 arXiv 链接会自动生成 alphaXiv 入口。

### 公式

编辑框填写 LaTeX 原文，保存后在笔记详情中查看排版：

```tex
行内公式：$x^2 + y^2 = z^2$

独立公式：
$$L = L_{RL} + \lambda \frac{a}{b}$$
```

也支持 `\(...\)` 和 `\[...\]`。KaTeX 脚本与字体保存在本地，无需联网。

### 架构图

在“架构图 / 附图”点击“添加图片”，或点击粘贴区域后按 Ctrl+V。支持 PNG、JPEG、WebP，每张最多 **2 MB**，每篇最多 **6 张**。可填写说明，保存后在详情中点击放大。

图片同时保存为 `data/images/` 中的独立文件，并嵌入文献库 JSON，便于完整迁移；图片不会发送给 AI。相同图片去重，删除附图不会自动清理磁盘旧图。当前文献库保存和导入上限为 **20 MB**。

## AI 配置（可选）

将 [.env.example](.env.example) 复制为 `.env`，填写自己的配置。已有 `.env` 时直接编辑，不要覆盖。

```dotenv
AI_API_KEY=你的密钥
AI_MODEL=服务商提供的准确模型名称
AI_BASE_URL=https://api.openai.com/v1
```

地址是 API 基础地址，不附加 `/chat/completions`；服务需支持 Chat Completions 和 JSON mode。修改配置后重启服务。

在新建或编辑窗口点击“AI 辅助整理”，提供论文链接或摘要 / 笔记，生成后检查并修改草稿，勾选字段填入表单，最后保存。已有非空字段默认不勾选。

- arXiv 链接读取标题、首次发表时间和摘要，**不读取 PDF 全文**。其他来源请粘贴内容。
- 点击生成会将提供的内容和现有标签发送给配置的模型服务，可能产生费用。
- 密钥仅由本地服务读取，不进入前端或文献备份。
- 实际 Prompt 位于 [prompts/paper-summary.txt](prompts/paper-summary.txt)，修改后下次生成即生效；保留 JSON 字段约定。

详见 [AI 配置与排错](docs/AI-SETUP.md) 和 [Prompt 说明](prompts/README.md)。

## 保存、导出与恢复

| 文件或操作 | 用途 |
| --- | --- |
| `data/library.json` | 当前完整文献库 |
| `data/backups/` | 每次实际变更前的完整历史版本 |
| `data/images/` | 独立图片及论文对应索引 |
| 导出完整备份 | 导出整个文献库 JSON，包含附图，不受筛选影响 |
| 导入备份 | 用所选 JSON **替换整个文献库**，并先备份当前版本 |
| 导出当前概览 CSV | 导出当前筛选结果，不含发表时间和标签列 |
| 导出 Markdown | 导出单篇元信息、笔记和内嵌图片 |

内容相同的保存不产生重复备份，每次成功保存后自动清理旧备份，只保留最新 3 份。多个窗口同时修改时，服务拒绝旧版本覆盖新版本。第一次没有磁盘文献库时，会迁移当前网址可读取的浏览器数据。

定期复制整个 `data/` 到其他磁盘。备份包含笔记和插入的图片，不包含链接指向的论文 PDF、数据集或代码仓库。Markdown 中内嵌图片是否显示取决于阅读器。

恢复旧版本：先导出当前完整备份，再从页面导入 `data/backups/` 中所需的 JSON。详见 [本地存储说明](docs/LOCAL-STORAGE.md)。

## 更新与迁移

更新代码时保留 `.env` 和整个 `data/`。保存正在编辑的内容，关闭旧终端，重新启动服务，再按 **Ctrl+F5** 刷新网页。只刷新网页不会重启后端。

换电脑时复制 `data/`，重新准备 Node.js 和 `.env`。多个浏览器使用同一本地服务会读取同一份文件；当前没有跨设备同步。

[Paperdesk.html](Paperdesk.html) 可独立打开，但数据只存在浏览器中，不支持自动落盘或 AI。正式使用推荐本地服务版。单文件版迁移到服务版时，应先导出 JSON，再在服务版导入。

## 目录结构

```text
paperdesk/
├── README.md                  使用与开发说明
├── THIRD_PARTY_NOTICES.md      第三方组件及字体说明
├── .env.example               可公开的配置模板
├── .gitignore                 排除个人数据和本地文件
├── package.json               可选 npm 命令入口，无运行时依赖
├── start.cmd                  Windows 启动入口
├── server.mjs                 本地网页服务与 AI 接口
├── storage.mjs                文件保存、图片提取和版本检查
├── Paperdesk.html             生成的单文件版本
├── dist/                      前端源码及本地静态资源
│   ├── index.html / app.js / style.css
│   ├── paperdesk-icon.svg     页面与标签页共用图标
│   └── vendor/katex/          公式组件、字体和原始许可证
├── prompts/                   AI 提示词与字段说明
├── docs/                      配置、存储和 GitHub 上传说明
├── scripts/                   构建、诊断、图片提取与源码打包
└── tests/                     自动化回归测试
```

运行后生成的 `.env`、`data/`，以及本地 `archive/`、`.openai/`、`releases/` 不进入源码包。

## 开发与验证

直接修改 `dist/` 中的前端文件，更新后构建单文件版：

```sh
node scripts/build-local.cjs
node --test tests/*.test.mjs
```

也可使用 `npm start`、`npm run build`、`npm test`。自动化测试使用模拟模型响应及临时数据目录，不调用付费 AI。

`dist/paperdesk-icon.svg` 是图标来源，构建脚本会同步页面和 favicon。`node scripts/export-images.mjs` 可从现有文献库重新提取图片。API 诊断脚本会调用已配置的服务，运行前请阅读 [AI 配置说明](docs/AI-SETUP.md)。

Windows 打包干净源码：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-source.ps1
```

输出到 `releases/`。打包使用明确的文件白名单，包含配置模板，不包含密钥、个人笔记或 Git 历史。上传步骤见 [GitHub 上传指南](docs/GITHUB.md)。

## 常见问题

| 情况 | 处理 |
| --- | --- |
| 网址打不开 | 确认服务窗口仍在运行，端口为 4174 |
| 端口占用 | 关闭旧服务后重新启动，不要同时运行两份 |
| 公式显示为原文 / 组件 404 | 重启服务，再按 Ctrl+F5；编辑框显示原文是正常行为 |
| AI 返回 403 | 检查服务端具体原因、密钥权限、模型名称及大小写 |
| 图片无法保存 | 查看编辑窗口提示，检查图片格式、大小、文献库总容量及磁盘写权限 |
| 笔记突然为空 | 核对网址和启动方式；检查 `data/library.json`，必要时导入备份 |
| 提示其他窗口已更新 | 复制未提交内容，导出已保存数据，再刷新 |
| 本地 JSON 损坏 | 停止服务并备份整个 data，再用完好的历史 JSON 恢复；不要清空原文件 |

## 许可证

本项目尚未指定整体开源许可证；公开仓库不等于授予开源许可。仓库所有者可按发布意图补充 LICENSE。第三方组件保留各自许可证，详见 [第三方声明](THIRD_PARTY_NOTICES.md)。

## Markdown 笔记

阅读笔记支持常见 Markdown：`**加粗**`、`*斜体*`、`~~删除线~~`、一至六级标题、段落、分隔线、有序 / 无序及嵌套列表、引用、链接、图片、表格、行内代码和围栏代码块。任务列表支持 `- [ ] 待办` 和 `- [x] 完成`，勾选状态在详情中只读；修改请回到编辑框。

编辑时保留 Markdown 源码，保存后在详情中显示排版，旧笔记无需重新保存。公式继续支持 `$…$`、`$$…$$`、`\(...\)` 和 `\[...\]`；代码块和行内代码中的公式符号不会被转换。表格单元格里的竖线需要写成 `\|`。

例如：

````markdown
## 核心方法

**重点结论**，*待验证假设*。

- [x] 阅读方法
- [ ] 复现实验

> 我的理解与疑问

| 方法 | 分数 |
| --- | --- |
| Ours | **92** |

行内公式：$x_i^2$。

```python
loss = model(batch)
```
````

渲染器本地运行，不将笔记发送到外部服务。原始 HTML 按文本显示；脚注、Mermaid、代码语法着色等扩展暂未提供。Markdown 网络图片需要网络访问，若希望图片随备份保存在本地，请使用“架构图 / 附图”上传。

## 联网查询发表信息与引用数

打开论文详情，在“发表信息与引用数”点击“联网查询”或“刷新查询”。每次点击会请求 Semantic Scholar 和 Crossref 最新可获取的数据库记录，显示来源、匹配标题、会议 / 期刊、统计引用数和查询时间。结果只在当前页面会话保留，不自动改写笔记或发表日期，也不进入备份。没有后台定时刷新。

这里的“最新”是数据源当前返回的结果，数据库可能延迟更新，无法保证即时获知录用。引用数按来源分别展示，不能相加，也不等同于 Google Scholar 的引用数。缺失数据不会显示成零；预印本或查不到记录不代表未录用。

优先在论文链接字段填写 `https://doi.org/...` 或 arXiv 链接。Semantic Scholar 支持按两种标识查找；Crossref 对 DOI 直接查询，对其他链接用标题查找。标题匹配仅显示规范化后完全一致的唯一结果，标为候选，仍需点击来源核对作者、版本；有多个同标题版本时提示使用正式 DOI。正式发表标题发生变化时，标题搜索可能找不到。

只发送论文标题和论文标识，不发送笔记、图片或 AI 密钥，不调用 AI 模型。数据源说明：[Semantic Scholar API](https://api.semanticscholar.org/api-docs/)、[Crossref 引用统计](https://www.crossref.org/documentation/cited-by/)。

Semantic Scholar 公共接口可能限流；可以在 `.env` 另外添加：

```dotenv
SEMANTIC_SCHOLAR_API_KEY=你的SemanticScholar密钥
```

该密钥与 AI 密钥不同，仅发送给 Semantic Scholar。可在 [Semantic Scholar API 页面](https://www.semanticscholar.org/product/api)申请；配置后重启服务。Crossref 无需此密钥，一个来源出错不会阻止另一个来源显示。

新增此功能后须关闭旧服务窗口，重新运行 `start.cmd`，再 Ctrl+F5 刷新。单文件版不支持联网查询。实现位于 `metadata.mjs`；自动化测试使用模拟响应，不依赖第三方网络。
