#!/bin/bash
set -euo pipefail

# Only run in remote (cloud) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

pnpm install

# Install the Supabase CLI binary if it's missing. The `supabase` npm package's
# postinstall (which downloads the ~95MB Go binary from GitHub releases) is
# intentionally skipped during `pnpm install` via `ignoredBuiltDependencies` in
# pnpm-workspace.yaml, so other environments without GitHub access don't fail.
# Web sessions can reach GitHub through the agent proxy, so fetch it here on
# demand. Best-effort: never fail the session if the download is unavailable.
if [ ! -x node_modules/supabase/bin/supabase ]; then
  echo "Installing Supabase CLI binary…"
  if ( cd node_modules/supabase && node scripts/postinstall.js ); then
    ln -sf ../supabase/bin/supabase node_modules/.bin/supabase
    echo "Supabase CLI installed: $(node_modules/.bin/supabase --version 2>/dev/null | head -1)"
  else
    echo "Supabase CLI install skipped (download unavailable)."
  fi
fi
