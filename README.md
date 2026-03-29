# YDB Installer

This repository contains an **experimental** YDB installer. It is under **active development** and is **not recommended for regular production or operational use** yet.

For design and behavior details, see `SPECIFICATION.md` and `ARCHITECTURE.md`. For contributor guidance, see `AGENTS.md`.

## Build

See **`BUILD.md`** for prerequisites, development vs production builds, and the `scripts/build-production.sh` workflow.

## Run

**Development (UI from Vite, API from Go)** — from the repository root, start the server, then in another terminal run the UI dev server as described in `BUILD.md`:

```bash
go run ./cmd/installer/
```

```bash
cd ui && npm install && npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`); it proxies `/api` to the Go process.

**Single binary (embedded UI)** — after a production build (see `BUILD.md`), run the executable you built (for example `./ydb-installer`). By default it serves HTTP on **`http://127.0.0.1:8443`**. Override the listen address with `-listen` and the state directory with `-data-dir` (see `BUILD.md`).
