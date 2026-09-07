#!/bin/bash
# 使用前请替换 ORIGIN_URL
ORIGIN_URL="https://github.com/Miano-Design/wxlh-game.git"
set -e
if [ "$ORIGIN_URL" = "https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git" ]; then
  echo "请先编辑 deploy.sh，将 ORIGIN_URL 替换为你的仓库地址后再运行。"
  exit 1
fi

echo "初始化 git 并推送到远端（main）..."
git init
git add .
git commit -m "Initial prototype: static web build"
git branch -M main

git remote add origin "$ORIGIN_URL" || git remote set-url origin "$ORIGIN_URL"
git push -u origin main

echo "已推送到 origin main。若要使用 GitHub Pages，请在仓库设置中启用 Pages，或者使用工作流自动部署。"
