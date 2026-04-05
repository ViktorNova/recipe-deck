#!/usr/bin/env bash
# Interactive helper: create .env from .env.example, set SPARK_VLLM_ROOT, optional deploy env, systemd hints.
# Does not require Node. Run from repo root: ./scripts/setup.sh [--deploy] [--systemd-hint]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

usage() {
  cat <<'EOF'
Usage: ./scripts/setup.sh [--deploy] [--systemd-hint]

  (default)       Ensure .env exists; prompt for SPARK_VLLM_ROOT; verify run-recipe.py; print file reminder.
  --deploy        Also create operator.local.env from example if missing; prompt for DEPLOY_SSH.
  --systemd-hint  Print a suggested user systemd ExecStart (no files written). Skips SPARK_VLLM_ROOT prompts if used alone.

Remote deploy: ./scripts/deploy-gb10.sh  (alias: ./scripts/deploy-gx10.sh)
Docs: docs/OPERATOR-LOCAL.md, README.md
EOF
}

DO_DEPLOY=0
DO_SYSTEMD=0
for arg in "$@"; do
  case "$arg" in
    --help|-h) usage; exit 0 ;;
    --deploy) DO_DEPLOY=1 ;;
    --systemd-hint) DO_SYSTEMD=1 ;;
    *) echo "unknown option: $arg" >&2; usage >&2; exit 1 ;;
  esac
done

ensure_env_file() {
  if [[ ! -f "${ROOT}/.env.example" ]]; then
    echo "error: missing .env.example in ${ROOT}" >&2
    exit 1
  fi
  if [[ ! -f "${ROOT}/.env" ]]; then
    cp "${ROOT}/.env.example" "${ROOT}/.env"
    echo "created ${ROOT}/.env from .env.example"
  fi
}

get_current_spark_root() {
  local line
  line="$(grep -E '^[[:space:]]*SPARK_VLLM_ROOT=' "${ROOT}/.env" 2>/dev/null | head -1 || true)"
  if [[ -z "$line" ]]; then
    echo ""
    return
  fi
  line="${line#SPARK_VLLM_ROOT=}"
  line="${line#"${line%%[![:space:]]*}"}"
  echo "$line"
}

set_spark_vllm_root_in_env() {
  local new_root="$1"
  local env_file="${ROOT}/.env"
  local tmp
  tmp="$(mktemp)"
  local found=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^[[:space:]]*SPARK_VLLM_ROOT= ]]; then
      echo "SPARK_VLLM_ROOT=${new_root}"
      found=1
    else
      printf '%s\n' "$line"
    fi
  done < "$env_file" > "$tmp"
  if [[ "$found" -eq 0 ]]; then
    { echo "SPARK_VLLM_ROOT=${new_root}"; cat "$env_file"; } > "$tmp"
  fi
  mv "$tmp" "$env_file"
}

prompt_spark_root() {
  local current def display
  current="$(get_current_spark_root)"
  def="${current:-/path/to/spark-vllm-docker}"
  read -r -p "SPARK_VLLM_ROOT (absolute path to spark-vllm-docker) [${def}]: " display || true
  if [[ -z "${display// }" ]]; then
    display="$def"
  fi
  # trim
  display="${display#"${display%%[![:space:]]*}"}"
  display="${display%"${display##*[![:space:]]}"}"

  if [[ "$display" != /* ]]; then
    echo "error: SPARK_VLLM_ROOT must be an absolute path (start with /)." >&2
    exit 1
  fi
  if [[ ! -d "$display" ]]; then
    echo "error: directory does not exist: $display" >&2
    exit 1
  fi
  if [[ ! -f "$display/run-recipe.py" ]]; then
    echo "error: expected run-recipe.py under SPARK_VLLM_ROOT: $display/run-recipe.py" >&2
    exit 1
  fi
  set_spark_vllm_root_in_env "$display"
  echo "updated SPARK_VLLM_ROOT in .env"
}

print_file_reminder() {
  cat <<'EOF'

--- Configuration files ---
  .env                 App runtime (SPARK_VLLM_ROOT, ports, etc.) — read by Recipe Deck and systemd EnvironmentFile=.
  operator.local.env   Deploy-from-laptop only (DEPLOY_SSH, DEPLOY_REMOTE_PATH) — used by scripts/deploy-gb10.sh; gitignored.

Remote deploy: ./scripts/deploy-gb10.sh   (legacy alias: ./scripts/deploy-gx10.sh)
EOF
}

do_deploy_env() {
  local ex="${ROOT}/operator.local.env.example"
  if [[ ! -f "$ex" ]]; then
    echo "error: missing operator.local.env.example" >&2
    exit 1
  fi
  local ol="${ROOT}/operator.local.env"
  if [[ ! -f "$ol" ]]; then
    cp "$ex" "$ol"
    echo "created ${ol} from operator.local.env.example"
  fi
  local cur_ssh
  cur_ssh="$(grep -E '^[[:space:]]*DEPLOY_SSH=' "$ol" 2>/dev/null | head -1 | sed 's/^[^=]*=//' | tr -d '\r' || true)"
  read -r -p "DEPLOY_SSH (user@host for GB10-class inference host) [${cur_ssh:-operator@your-inference-host.example}]: " ans || true
  if [[ -n "${ans// }" ]]; then
    cur_ssh="$ans"
  fi
  if [[ -z "${cur_ssh// }" ]]; then
    echo "error: DEPLOY_SSH is required for deploy." >&2
    exit 1
  fi
  local tmp
  tmp="$(mktemp)"
  local found=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^[[:space:]]*DEPLOY_SSH= ]]; then
      echo "DEPLOY_SSH=${cur_ssh}"
      found=1
    else
      printf '%s\n' "$line"
    fi
  done < "$ol" > "$tmp"
  if [[ "$found" -eq 0 ]]; then
    echo "DEPLOY_SSH=${cur_ssh}" >> "$tmp"
  fi
  mv "$tmp" "$ol"
  echo "updated DEPLOY_SSH in operator.local.env"
  echo "Optional: set DEPLOY_REMOTE_PATH in operator.local.env if the default (repos/recipe-deck) is wrong."
}

systemd_hint() {
  local node path
  node="$(command -v node 2>/dev/null || echo "/usr/bin/node")"
  path="$ROOT"
  cat <<EOF

--- Suggested user systemd snippet (adjust paths; paste into ~/.config/systemd/user/recipe-deck.service) ---
WorkingDirectory=${path}
EnvironmentFile=-${path}/.env
ExecStart=${node} ${path}/dist/server/main.js

If \`command -v node\` differs from /usr/bin/node (nvm, fnm, etc.), use the absolute path shown above for ExecStart.
Build first: npm ci && npm run build
Then: systemctl --user daemon-reload && systemctl --user enable --now recipe-deck.service

See docs/systemd/recipe-deck.service for a full unit example.
EOF
}

ONLY_SYSTEMD=0
if [[ "$DO_SYSTEMD" -eq 1 ]] && [[ "$DO_DEPLOY" -eq 0 ]]; then
  ONLY_SYSTEMD=1
fi

if [[ "$ONLY_SYSTEMD" -eq 0 ]]; then
  ensure_env_file
  prompt_spark_root
  print_file_reminder
fi

if [[ "$DO_DEPLOY" -eq 1 ]]; then
  do_deploy_env
fi

if [[ "$DO_SYSTEMD" -eq 1 ]]; then
  systemd_hint
fi

echo ""
echo "Next: npm install && npm run dev   (development)"
echo "      npm ci && npm run build && npm start   (production; set env as in .env)"
echo "See README.md for full deployment options."
