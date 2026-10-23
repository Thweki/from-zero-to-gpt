#!/bin/sh
set -eu
# Finder may omit Homebrew from PATH on Apple Silicon or Intel Macs.
if ! command -v node >/dev/null 2>&1; then
  PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
  export PATH
fi
FROM_ZERO_DIR=$(cd "$(dirname "$0")" && pwd)
exec sh "$FROM_ZERO_DIR/start-linux.sh" "$@"
