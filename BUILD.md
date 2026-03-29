# Building the YDB Installer

This document describes how to build the Installer binary and web UI. Product behavior is defined in `SPECIFICATION.md` and `SPECIFICATION_UI.md`; layout and stack are summarized in `ARCHITECTURE.md`.

## Prerequisites

- **Go**: version matching the `go` directive in `go.mod` (used to build the server and REST API).
- **Node.js** and **npm**: for the React UI under `ui/` (Vite + TypeScript).

Optional: `git` for fetching the source tree.

## Repository layout (build-relevant)

- `cmd/installer/` — main package; static UI is embedded from `cmd/installer/web` via `//go:embed all:web`.
- `ui/` — editable UI sources. Build output is `ui/dist/`.

Edit `ui/src` and related UI sources; refresh the embedded tree under `cmd/installer/web` after each production UI build (see below).

## Development (no embedded UI refresh)

For local work you can run the API and the Vite dev server separately. The dev server proxies `/api` to the backend (see `ui/vite.config.ts`).

1. Start the Go server (from the repository root):

   ```bash
   go run ./cmd/installer/
   ```

   By default it listens on `:8443` and stores state under `./data` (see flags below).

2. In another terminal, install UI dependencies and run Vite:

   ```bash
   cd ui
   npm install
   npm run dev
   ```

   Open the URL Vite prints (typically `http://localhost:5173`). API calls go to the Go process via the proxy.

## Production build (embedded UI + binary)

Ship a single binary that serves the built SPA from embedded files.

### Recommended: `scripts/build-production.sh`

From the **repository root**, run:

```bash
./scripts/build-production.sh
```

This script:

1. Runs `npm ci` and `npm run build` in `ui/` (reproducible installs from `ui/package-lock.json`).
2. Replaces `cmd/installer/web/` with the contents of `ui/dist/` (required for `//go:embed all:web`).
3. Runs `go build -o ydb-installer ./cmd/installer/`.

**Environment variables:**

| Variable | Meaning |
| -------- | ------- |
| `OUT` | Output path for the binary (default: `ydb-installer` in the current working directory). Example: `OUT=dist/ydb-installer ./scripts/build-production.sh` |

Cross-compilation: set `GOOS` / `GOARCH` (and any other `go build` env you need) when invoking the script; they are passed through to the toolchain automatically.

```bash
GOOS=linux GOARCH=amd64 OUT=ydb-installer-linux-amd64 ./scripts/build-production.sh
```

The resulting executable contains the embedded UI and does not require Node at runtime.

### Manual steps (equivalent to the script)

1. **Build the UI** (typecheck + Vite bundle):

   ```bash
   cd ui
   npm ci
   npm run build
   ```

   Output is written to `ui/dist/`.

2. **Copy the bundle into the embed directory** expected by `cmd/installer`:

   ```bash
   cd ..
   rm -rf cmd/installer/web
   mkdir -p cmd/installer/web
   cp -a ui/dist/. cmd/installer/web/
   ```

   Ensure `cmd/installer/web/index.html` exists so `//go:embed all:web` includes the app entrypoint.

3. **Build the Installer binary** from the repository root:

   ```bash
   go build -o ydb-installer ./cmd/installer/
   ```

## Runtime flags (reference)

- `-listen` — HTTP listen address (default `:8443`).
- `-data-dir` — writable directory for SQLite and local state (default `./data`; override with env `YDB_INSTALLER_DATA_DIR` if you set it in code).

## Checks

- Compile all packages:

  ```bash
  go build ./...
  ```

- UI typecheck and production bundle (same as `npm run build` in `ui/`).

- Tests (when present):

  ```bash
  go test ./...
  ```

## Cross-compilation

Set `GOOS` and `GOARCH` for the target platform when running the production build script or `go build` directly, for example:

```bash
GOOS=linux GOARCH=amd64 ./scripts/build-production.sh
```

The `modernc.org/sqlite` driver used for persistence is pure Go; CGO is not required for a standard static build of this module.
