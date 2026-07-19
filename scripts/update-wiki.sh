#!/bin/sh
# Background wiki updater — called by post-commit hook.
# Only runs when schema, actions, or architecture-level files change.
# Uses claude -p (non-interactive) so it never blocks the commit.

REPO_DIR=$(git rev-parse --show-toplevel 2>/dev/null)
CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || git diff --name-only HEAD 2>/dev/null)

[ -z "$CHANGED" ] && exit 0

# Only structural changes warrant a wiki update — not every action/component edit
RELEVANT=$(echo "$CHANGED" | grep -E \
  '(packages/db/src/schema|src/lib/app-themes\.ts|src/middleware|CLAUDE\.md|docs/)' \
  || true)

[ -z "$RELEVANT" ] && exit 0

WIKI_LOG="${HOME}/.cache/seikatsu-wiki-update.log"
mkdir -p "$(dirname "$WIKI_LOG")"
echo "[wiki] Triggered by: $(echo "$RELEVANT" | tr '\n' ' ')" >> "$WIKI_LOG"

nohup claude -p "You are maintaining the seikatsu project wiki at graphify-out/wiki/.

Files changed in last commit that may affect the wiki:
$(echo "$RELEVANT")

Steps:
1. Read each changed file above to understand what actually changed
2. Read the relevant wiki pages:
   - packages/db/src/schema/* changed → read + update graphify-out/wiki/database.md
   - features/*/actions/* or src/middleware changed → read + update graphify-out/wiki/architecture.md
   - CLAUDE.md or docs/* changed → read + update graphify-out/wiki/index.md and/or prd.md
3. Make ONLY minimal, accurate edits to the affected sections — do not rewrite unrelated content
4. Preserve all wiki links ([[index]], [[database]], etc.) and document structure

If nothing in the changed files warrants a wiki update, do nothing." \
  --allowedTools "Read,Write" \
  --add-dir "$REPO_DIR" \
  >> "$WIKI_LOG" 2>&1 < /dev/null &
disown 2>/dev/null || true
