#!/bin/sh
set -eu
FROM_ZERO_DIR=$(cd "$(dirname "$0")" && pwd)
if ! command -v node >/dev/null 2>&1; then
  echo 'Please install Node.js 24 LTS (22.18+): https://nodejs.org/' >&2
  exit 1
fi
node -e 'var v=process.versions.node.split(".").map(Number); if(v[0]<22||(v[0]===22&&v[1]<18)){console.error("Requires Node.js 22.18+; install Node 24 LTS: https://nodejs.org/");process.exit(1);}'
exec node "$FROM_ZERO_DIR/scripts/launch.mjs" "$@"
