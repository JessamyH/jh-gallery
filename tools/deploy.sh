#!/usr/bin/env bash
# Publish the gallery to the private S3 bucket behind CloudFront.
#
# Only media that data/works.local.js refers to is uploaded, so leftovers in
# media/archive/ (and media/samples/) never go online. Media that is no longer
# referenced is deleted from the bucket.
#
# Usage:
#   tools/deploy.sh --dry-run    # show what would change, upload nothing
#   tools/deploy.sh
#
# Needs the AWS CLI, python3, and `terraform apply` done in infra/.
# Profile: $AWS_PROFILE, default jessamy-lab.
set -euo pipefail

cd "$(dirname "$0")/.."
export AWS_PROFILE="${AWS_PROFILE:-jessamy-lab}"
DRY=""
[[ "${1:-}" == "--dry-run" ]] && DRY="--dryrun"

[[ -f data/works.local.js ]] || { echo "data/works.local.js is missing; run tools/build.py --data first." >&2; exit 1; }

BUCKET=$(terraform -chdir=infra output -raw bucket_name)
DIST=$(terraform -chdir=infra output -raw distribution_id)
URL=$(terraform -chdir=infra output -raw site_url)

# Stage the referenced media as symlinks; `aws s3 sync` follows them.
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

python3 -I - "$STAGE" <<'EOF'
import json, os, sys
from pathlib import Path

stage = Path(sys.argv[1])
text = Path("data/works.local.js").read_text(encoding="utf-8")
data = json.loads(text[text.index("{"):text.rindex("}") + 1])

refs = set()
for w in data["works"]:
    for m in [{"cover": w.get("cover")}, *w.get("media", [])]:
        for key in ("src", "poster", "thumb", "cover"):
            if m.get(key):
                refs.add(m[key].split("?")[0])

bad = sorted(r for r in refs if not r.startswith("media/archive/"))
missing = sorted(r for r in refs if not Path(r).is_file())
if bad or missing:
    sys.exit("Not deploying.\n  outside media/archive/: %s\n  missing: %s" % (bad, missing))

for r in refs:
    link = stage / Path(r).relative_to("media/archive")
    link.parent.mkdir(parents=True, exist_ok=True)
    os.symlink(Path(r).resolve(), link)
print(f"{len(data['works'])} works, {len(refs)} media files")
EOF

echo "Deploying to $BUCKET ${DRY:+(dry run)}"

# Media: file URLs carry ?v=<version>, so a changed file gets a new URL; cache for a year.
aws s3 sync "$STAGE" "s3://$BUCKET/media/archive" --delete $DRY \
  --cache-control "public, max-age=31536000, immutable"

# Page and data: always revalidate. Code: short cache (index.html bumps ?v= anyway).
put() { aws s3 cp "$1" "s3://$BUCKET/$1" --cache-control "$2" $DRY; }
put data/works.local.js "no-cache"
put data/works.js       "no-cache"
put script.js           "public, max-age=300"
put styles.css          "public, max-age=300"
put favicon.svg         "public, max-age=86400"
put index.html          "no-cache"

if [[ -z "$DRY" ]]; then
  aws cloudfront create-invalidation --distribution-id "$DIST" \
    --paths "/" "/index.html" "/data/*" "/script.js" "/styles.css" \
    --query 'Invalidation.Id' --output text >/dev/null
  echo "Done. Live in a minute or two at $URL"
fi
