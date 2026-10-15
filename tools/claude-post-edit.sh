#!/usr/bin/env bash
set -u
cd "$(dirname "$0")/.."

file=$(jq -r '.tool_response.filePath // .tool_input.file_path')
[ -f "$file" ] || exit 0

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.jsonc|*.md|*.yaml|*.yml) ;;
  *) exit 0 ;;
esac

status=0
bunx oxfmt "$file" || status=1

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
    bunx oxlint --fix "$file" || status=1
    ;;
esac

case "$file" in
  *.ts|*.tsx)
    dir=$(dirname "$file")
    while [ "$dir" != "." ] && [ "$dir" != "/" ]; do
      if [ -f "$dir/tsconfig.json" ]; then
        (cd "$dir" && bunx tsc --noEmit -p tsconfig.json) || status=1
        break
      fi
      dir=$(dirname "$dir")
    done
    ;;
esac

[ $status -eq 0 ] && exit 0 || exit 2
