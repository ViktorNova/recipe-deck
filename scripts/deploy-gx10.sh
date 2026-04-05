#!/usr/bin/env bash
# Back-compat alias for scripts/deploy-gb10.sh (historical name).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
echo "deploy-gx10.sh is an alias for deploy-gb10.sh" >&2
exec "${ROOT}/deploy-gb10.sh" "$@"
