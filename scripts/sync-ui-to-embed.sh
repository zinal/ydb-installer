#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
(cd "$ROOT/ui" && npm run build)
rm -rf "$ROOT/cmd/installer/web"/*
cp -a "$ROOT/ui/dist/." "$ROOT/cmd/installer/web/"
echo "Synced ui/dist -> cmd/installer/web (for go:embed)."
