#!/usr/bin/env bash
# hub_publish_ci.sh (2026-10-21): run by .github/workflows/hub-articles.yml on GitHub's servers.
# Reads published www.asendify.co hub articles (Supabase shop_articles, product='hub') through the read-only
# RPC public.hub_articles(), renders them with scripts/build_hub_articles.py and commits only blog/,
# sitemap.xml and llms.txt to main. No secrets needed: the publishable key below only reaches that RPC.
# Why GitHub Actions: the night agent's cloud container and the Mac VM can't reach both Supabase and GitHub;
# GitHub's runners can, and they don't depend on the Mac being awake.
set -euo pipefail
SUPA=https://capsmeqrpeholfjewwwj.supabase.co
ANON=sb_publishable_yow9WLNOTbvm_Y2oXWUTvQ_FpT-f5FJ
OUT_FILE=${OUT_FILE:-/tmp/hub_out.json}

curl -fsS --retry 3 --max-time 60 -X POST "$SUPA/rest/v1/rpc/hub_articles" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H 'Content-Type: application/json' -d '{}' -o /tmp/hub_rows.json
python3 -c "import json; d=json.load(open('/tmp/hub_rows.json')); assert isinstance(d, list); print(len(d), 'published hub rows')"

python3 scripts/build_hub_articles.py /tmp/hub_rows.json > "$OUT_FILE"
cat "$OUT_FILE"

if [ -z "$(git status --porcelain)" ]; then echo "up to date"; echo "changed=0" >> "${GITHUB_OUTPUT:-/dev/null}"; exit 0; fi
BAD=$(git status --porcelain | awk '{print $2}' | grep -v -E '^(blog/|sitemap\.xml$|llms\.txt$)' || true)
if [ -n "$BAD" ]; then echo "unexpected files changed, not pushing: $BAD"; exit 1; fi

CHANGED=$(python3 -c "import json; print(', '.join(json.load(open('$OUT_FILE'))['changed']))")
git config user.name "Manthan Bhendkar"
git config user.email "manthanbhendkaaar@gmail.com"
git add -A blog sitemap.xml llms.txt
git commit -q -m "Hub articles: ${CHANGED:-index/sitemap refresh}" -m "Built by the Hub articles workflow from Supabase shop_articles (product=hub)."
for t in 1 2 3; do
  if git push -q origin HEAD:main; then echo "changed=1" >> "${GITHUB_OUTPUT:-/dev/null}"; echo "pushed: $CHANGED"; exit 0; fi
  git pull -q --rebase origin main || true; sleep 5
done
echo "push rejected 3 times"; exit 1
