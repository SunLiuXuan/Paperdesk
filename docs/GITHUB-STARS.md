# GitHub Stars 配置

公开仓库 Stars 查询无需充值。未配置 Token 时按出口 IP 共享匿名额度；个人 Token 通常提供每小时 5,000 次请求额度，仍可能受到临时限流。

1. 打开 https://github.com/settings/personal-access-tokens/new ，创建 Fine-grained token。
2. 名称填写 PaperDesk，设置有效期，Resource owner 选择自己，Repository access 选择 Public repositories。无需添加写入权限，保留公开仓库只读访问即可。
3. 在项目根目录 `.env` 的 `GITHUB_TOKEN=` 后粘贴 Token，然后保存。不要使用 AI 服务的 Key。
4. 停止旧服务，重新运行 `start.cmd`，刷新网页并打开论文详情。

Token 只由本地后端发送给 GitHub API，不写入文献备份或前端页面。`.env` 已被 Git 忽略。Token 到期后在 GitHub 重新生成，更新 `.env` 并重启。

遇到额度用完提示时，等待提示的恢复时间；401 表示 Token 无效或过期，403 也可能由临时限流或访问限制导致。

官方说明：https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
