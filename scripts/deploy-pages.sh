#!/usr/bin/env bash
# Baut die Seite und veröffentlicht dist/ auf dem Zweig gh-pages (GitHub Pages, Quelle "gh-pages / root").
# Braucht kein Workflow-Recht – funktioniert mit einem normalen Repo-Token. Aufruf: bash scripts/deploy-pages.sh
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/build.mjs
touch dist/.nojekyll
REMOTE=$(git remote get-url origin)
TMP=$(mktemp -d)
cp -R dist/. "$TMP"/
cd "$TMP"
git init -q -b gh-pages
git config user.name "$(git -C "$OLDPWD" config user.name || echo cyber-x-hub)"
git config user.email "$(git -C "$OLDPWD" config user.email || echo bot@users.noreply.github.com)"
git add -A
git commit -q -m "Pages-Build $(date -u +%F)"
git push -q -f "$REMOTE" gh-pages
echo "Veröffentlicht: https://professororbach.github.io/cyber-x-hub/"
