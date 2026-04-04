#!/usr/bin/env bash
# Periodically sync the repository with origin/main; when main advances, fast-forward,
# run the production build, and restart the embedded-UI Installer binary.
#
# Intended for a long-lived demo host so operators can review upstream changes quickly.
#
# Environment (optional):
#   DEMO_WATCH_REMOTE   — git remote name (default: origin)
#   DEMO_WATCH_BRANCH   — branch to track (default: main)
#   DEMO_WATCH_INTERVAL — seconds between checks (default: 300)
#   OUT                 — output path for go build (default: bin/ydb-installer-demo); see scripts/build-production.sh
#   DEMO_WATCH_PIDFILE  — PID file for the Installer process (default: /tmp/ydb-installer-demo-watch.pid)
#   DEMO_WATCH_LOG      — log file for Installer stdout/stderr (default: demo-watch-installer.log under repo root)
#   INSTALLER_EXTRA_ARGS — optional extra flags for the binary (space-separated, e.g. "-listen :8443")
#
# The Installer inherits the current environment (e.g. YDB_INSTALLER_OPERATOR_PASSWORD, YDB_INSTALLER_DATA_DIR).
#
# Usage: from repository root:
#   export YDB_INSTALLER_OPERATOR_PASSWORD=...
#   ./scripts/demo-watch-main.sh
#
set -euo pipefail

REMOTE="${DEMO_WATCH_REMOTE:-origin}"
BRANCH="${DEMO_WATCH_BRANCH:-main}"
INTERVAL="${DEMO_WATCH_INTERVAL:-60}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

OUT="${OUT:-bin/ydb-installer-demo}"
PIDFILE="${DEMO_WATCH_PIDFILE:-/tmp/ydb-installer-demo-watch.pid}"
LOGFILE="${DEMO_WATCH_LOG:-${ROOT}/demo-watch-installer.log}"

BIN_ABS="${ROOT}/${OUT}"
if [[ "${OUT}" = /* ]]; then
  BIN_ABS="${OUT}"
fi

log() {
  echo "[$(date -Iseconds)] $*"
}

installer_running() {
  if [[ ! -f "${PIDFILE}" ]]; then
    return 1
  fi
  local pid
  pid="$(cat "${PIDFILE}" 2>/dev/null || true)"
  [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null
}

stop_installer() {
  if [[ ! -f "${PIDFILE}" ]]; then
    return 0
  fi
  local pid
  pid="$(cat "${PIDFILE}" 2>/dev/null || true)"
  if [[ -z "${pid}" ]]; then
    rm -f "${PIDFILE}"
    return 0
  fi
  if kill -0 "${pid}" 2>/dev/null; then
    log "Stopping Installer (PID ${pid})..."
    kill -TERM "${pid}" 2>/dev/null || true
    local i=0
    while kill -0 "${pid}" 2>/dev/null && [[ "${i}" -lt 30 ]]; do
      sleep 1
      i=$((i + 1))
    done
    if kill -0 "${pid}" 2>/dev/null; then
      log "Installer did not exit cleanly; sending SIGKILL"
      kill -KILL "${pid}" 2>/dev/null || true
    fi
  fi
  rm -f "${PIDFILE}"
}

start_installer() {
  stop_installer
  if [[ ! -x "${BIN_ABS}" ]] && [[ -f "${BIN_ABS}" ]]; then
    chmod +x "${BIN_ABS}" 2>/dev/null || true
  fi
  if [[ ! -f "${BIN_ABS}" ]]; then
    log "error: binary missing: ${BIN_ABS}" >&2
    return 1
  fi
  log "Starting Installer -> ${LOGFILE}"
  # Run in background; detach from TTY but keep same environment for secrets/flags.
  (
    cd "${ROOT}"
    exec >>"${LOGFILE}" 2>&1
    # shellcheck disable=SC2086
    exec "${BIN_ABS}" ${INSTALLER_EXTRA_ARGS:-}
  ) &
  echo $! >"${PIDFILE}"
  log "Installer PID $(cat "${PIDFILE}") (listen and errors also in ${LOGFILE})"
}

do_build() {
  log "Building (OUT=${OUT})..."
  OUT="${OUT}" "${ROOT}/scripts/build-production.sh"
}

try_sync() {
  local local_rev remote_rev
  local_rev="$(git rev-parse HEAD)"
  if ! git fetch "${REMOTE}" "${BRANCH}"; then
    log "warning: git fetch ${REMOTE} ${BRANCH} failed; will retry next interval" >&2
    return 1
  fi
  remote_rev="$(git rev-parse "${REMOTE}/${BRANCH}")"
  if [[ "${local_rev}" == "${remote_rev}" ]]; then
    return 1
  fi
  log "Remote ${REMOTE}/${BRANCH} advanced (${local_rev:0:7} -> ${remote_rev:0:7}); merging..."
  if ! git merge --ff-only "${REMOTE}/${BRANCH}"; then
    log "error: fast-forward merge failed; resolve manually (local diverged from ${REMOTE}/${BRANCH})" >&2
    return 2
  fi
  return 0
}

cleanup_on_exit() {
  log "Watch script exiting; stopping Installer..."
  stop_installer
}

trap cleanup_on_exit INT TERM

log "Demo watch: repo=${ROOT} remote=${REMOTE} branch=${BRANCH} interval=${INTERVAL}s binary=${BIN_ABS}"
log "Set YDB_INSTALLER_OPERATOR_PASSWORD (and optional YDB_INSTALLER_DATA_DIR) before starting."

while true; do
  sync_rc=0
  try_sync || sync_rc=$?
  need_build=false
  if [[ "${sync_rc}" -eq 0 ]]; then
    need_build=true
  elif [[ ! -f "${BIN_ABS}" ]]; then
    log "Binary missing; building once..."
    need_build=true
  fi

  if [[ "${need_build}" == true ]]; then
    do_build
    start_installer
  elif ! installer_running; then
    log "Installer not running; starting..."
    start_installer
  else
    log "Up to date; Installer still running (PID $(cat "${PIDFILE}"))."
  fi

  sleep "${INTERVAL}"
done
