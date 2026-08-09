#!/usr/bin/env bash
# 提交并推送内部文档。
#
# docs/ 在本仓库的 .gitignore 里，它本身是另一个（私有）git 仓库
# sherlockafa007/senridoufuu-docs，所以代码和文档要分别提交。
# 这个脚本只负责文档那一半。
#
# 用法：./docs-sync.sh "docs: 说明"
set -euo pipefail
cd "$(dirname "$0")/docs"
if [ -z "$(git status --porcelain)" ]; then
  echo "文档无改动，跳过。"
  exit 0
fi
git add -A
git commit -m "${1:-docs: 更新内部文档}"
git push
echo "✓ 已推送到 senridoufuu-docs"
