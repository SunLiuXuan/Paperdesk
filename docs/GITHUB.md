# 上传到 GitHub

## 推荐：上传干净源码目录

1. 执行 `scripts/package-source.ps1`（命令见主 README）。
2. 打开生成的 `releases/paperdesk-source-时间戳/`，这里仅包含允许公开的源码和模板。
3. 在 GitHub 创建空仓库，选择公开或私有。若使用下述 Git 命令，不要预先生成 README。
4. 在生成的源码目录打开终端，执行：

```sh
git init -b main
git add .
git status --short
git commit -m "Initial release of PaperDesk"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

将地址替换为你自己的仓库地址。也可使用 GitHub Desktop 添加该目录，检查变更后提交和发布。不要把 ZIP 当作源码直接上传；先解压再提交内部文件。ZIP 可作为 Release 附件。

新目录不包含旧 Git 历史，也不包含本机部署配置。不要复制 `.env` 或 `data/` 到上传目录；`.env.example` 是空配置模板，可以提交。

## 继续使用原目录的 Git 仓库

原目录已补齐忽略规则，旧 `.openai/hosting.json` 已从当前 Git 索引移除，本机文件仍保留。但旧提交仍可能保留该部署元数据；本次未改写历史。若不需要早期开发记录，优先采用上述干净源码目录。

上传前执行 `git status --short`，确认没有个人数据或密钥。`.gitignore` 只影响未跟踪文件；曾提交过的敏感数据需要另行从历史中处理，密钥也应撤销。

## 后续更新

保留本机 `.env` 和 `data/`，在源码目录修改和提交。发布前运行：

```sh
node scripts/build-local.cjs
node --test tests/*.test.mjs
```

如果选择了开源许可证，将 LICENSE 加入仓库，同时加入 `scripts/package-source.ps1` 的白名单，再生成新的源码包。
