#!/bin/sh
# Publish the prebuzz page to access.nailin.it (Cloudflare Pages project "nailinit-access").
#
# The page is kk/index.html — built from the slumber homepage by tools/kk/build.py —
# served at the root, with the assets it loads and the T&C/privacy pages the gate
# links to. Same deploy path as diwali.nailin.it: wrangler borrows the `cf` CLI's
# OAuth token. nailin.it's apex is the Shopify store: only the `access` CNAME is ours.
#
#   sh tools/kk/deploy-access.sh
set -e
SITE="$(cd "$(dirname "$0")/../.." && pwd)"
ACCOUNT=fd689e10e4af1074e33fdc69327b3b18
PROJECT=nailinit-access

python3 "$SITE/tools/kk/build.py"

ROOT="$(mktemp -d)"; DIST="$ROOT/dist"; mkdir -p "$DIST"
cp "$SITE/kk/index.html" "$DIST/index.html"
rsync -a --exclude '.DS_Store' "$SITE/assets/" "$DIST/assets/"
cp "$SITE/terms.html" "$SITE/privacy.html" "$DIST/"
# assets change rarely and config.js is cache-busted by ?v=; the page itself stays fresh
cat > "$DIST/_headers" <<'EOF'
/
  Cache-Control: public, max-age=0, must-revalidate
/assets/*
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800
EOF

cf auth whoami >/dev/null 2>&1 || true            # refreshes the OAuth token wrangler borrows below
N22="$HOME/.nvm/versions/node/v22.23.3/bin"
TOKEN=$(python3 -c "import json;print(json.load(open('$HOME/Library/Preferences/cloudflare/config/default.json'))['oauth_token'])")
cd "$ROOT"
CLOUDFLARE_API_TOKEN="$TOKEN" CLOUDFLARE_ACCOUNT_ID=$ACCOUNT PATH="$N22:$PATH" \
  npx -y wrangler@latest pages project create $PROJECT --production-branch main --force >/dev/null 2>&1 || true   # classic Pages, as with nailinit-party
CLOUDFLARE_API_TOKEN="$TOKEN" CLOUDFLARE_ACCOUNT_ID=$ACCOUNT PATH="$N22:$PATH" \
  npx -y wrangler@latest pages deploy dist --project-name $PROJECT --branch main --commit-dirty=true > "$ROOT/log.txt" 2>&1 \
  && { grep -Eo 'https://[a-z0-9.-]+\.pages\.dev' "$ROOT/log.txt" | tail -1; echo "deployed $PROJECT"; } \
  || { echo "deploy FAILED:"; tail -20 "$ROOT/log.txt"; exit 1; }
