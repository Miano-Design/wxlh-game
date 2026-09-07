# 无限轮回 — 原型（静态 Web）

这是基于需求文档的最小原型，可直接部署到 GitHub Pages 供手机访问。

快速部署步骤：

1. 在 GitHub 上创建一个新的空仓库（例如：`wxlh-game`）。
2. 将本项目推送到该仓库（在本地 `wxlh-game` 目录运行）：

```bash
# 编辑 deploy.sh，将 ORIGIN_URL 替换为你的仓库地址
chmod +x deploy.sh
./deploy.sh
```

或手动：

```bash
git init
git add .
git commit -m "Initial prototype"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git
git push -u origin main
```

3. 自动部署（推荐）：已提供 GitHub Actions 工作流 `.github/workflows/gh-pages.yml`，它会在 `main` 分支有 push 时，将 `wxlh-game` 目录内容发布到 GitHub Pages（使用 `gh-pages` 分支）。

4. 启用 GitHub Pages：
- 进入仓库设置 → Pages，选择 `gh-pages` 分支（或选择自动生成的选项）。页面地址会显示在界面上。

本地预览：

```bash
python3 -m http.server 8000
# 在手机浏览器打开 http://<你的电脑局域网IP>:8000 或本机 http://localhost:8000
```

下一步建议：
- 将 `V5.0《完整内容数据库》` 中的数值迁入 `js/config.js`，并实现事件/血统/装备模块。
- 我可以代你完成第一轮核心玩法实现并提交到仓库。