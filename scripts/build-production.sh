#!/usr/bin/env bash
# Full production build: UI bundle -> cmd/installer/web embed -> Go binary.
# Run from any directory; the repository root is derived from this script's path.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UI_DIR="${ROOT}/ui"
EMBED_DIR="${ROOT}/cmd/installer/web"
OUT="${OUT:-bin/ydb-installer}"

cd "${ROOT}"

if [[ ! -f "${UI_DIR}/package.json" ]]; then
  echo "error: ${UI_DIR}/package.json not found" >&2
  exit 1
fi

echo "==> ui: npm ci"
(
  cd "${UI_DIR}"
  npm ci
)

echo "==> ui: npm run build"
(
  cd "${UI_DIR}"
  npm run build
)

if [[ ! -f "${UI_DIR}/dist/index.html" ]]; then
  echo "error: ${UI_DIR}/dist/index.html missing after UI build" >&2
  exit 1
fi

echo "==> embed: ${UI_DIR}/dist -> ${EMBED_DIR}"
rm -rf "${EMBED_DIR}"
mkdir -p "${EMBED_DIR}"
cp -a "${UI_DIR}/dist/." "${EMBED_DIR}/"

echo "==> go build -> ${OUT}"
go build -o "${OUT}" ./cmd/installer/

echo "Done: $(cd "$(dirname "${OUT}")" && pwd)/$(basename "${OUT}")"
