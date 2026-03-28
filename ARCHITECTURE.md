# Architecture for YDB Installer

## 1. Architecture Drivers

The recommended architecture is driven by the following constraints:

- the backend and REST API must be implemented in `Go`;
- the web UI must use `ydb-platform/ydb-ui-components` as the primary component library;
- the Installer must be practical as a copy-and-use tool;
- the baseline product must not require external infrastructure services such as `PostgreSQL`, `Redis`, `Temporal`, or `Vault`;
- the existing `Ansible` and `Python` automation stack must not be a mandatory dependency;
- `ydbops` should be reused preferentially by embedding or directly integrating its capabilities into the Installer.

These constraints bias the design toward a single-host control plane with embedded persistence, explicit workflow state, and a small number of moving parts.

## 2. Target Deployment Shape

The recommended baseline distribution is a self-contained application package for one Control Host:

- one `Go` backend service that serves the REST API, hosts the static UI assets, manages execution, and persists state;
- one web UI bundle built with `React`, `TypeScript`, and `ydb-ui-components`;
- one local embedded database file, preferably `SQLite`, for session metadata, drafts, discovery snapshots, validation results, execution history, RBAC data, and reports;
- one local secret store layered on top of the embedded persistence model, with encryption at rest;
- optional local filesystem directories for uploaded artifacts, exported specifications, logs, and support bundles.

This shape minimizes operational prerequisites and fits offline or restricted-network use cases.

## 3. Recommended Logical Components

### 3.1 Frontend

The frontend should be a single-page web application using:

- `React` and `TypeScript`;
- `ydb-platform/ydb-ui-components` as the primary component set;
- patterns from `ydb-platform/ydb-embedded-ui` for component usage and integration style;
- a form library such as `react-hook-form` for multi-step wizard flows;
- a data-fetching layer such as `TanStack Query` for session retrieval, polling, cache consistency, and mutation handling;
- externalized i18n resource files with English fallback.

The UI should communicate only through the public REST API defined by the Installer.

### 3.2 API and Application Service Layer

The backend should expose a documented REST API implemented in `Go`, with:

- a lightweight HTTP stack such as `net/http` or `chi`;
- an `OpenAPI 3.x` contract as the authoritative API description;
- request validation, role checks, and secret redaction at the API boundary;
- session-oriented application services that own discovery, configuration, validation, execution control, reporting, and artifact export.

The service layer should remain explicit and boring rather than framework-heavy, because the product behavior is workflow-centric and highly stateful.

### 3.3 Persistence Layer

`SQLite` is the recommended default persistence mechanism because it best supports the copy-and-use requirement:

- no separate database service is needed;
- the database can be shipped, initialized, backed up, and migrated locally;
- it is sufficient for a single control-plane instance with moderate concurrency.

The schema should separate:

- session metadata and configuration drafts;
- discovery snapshots;
- validation outputs;
- execution phases, tasks, checkpoints, and logs;
- reports and exported artifact metadata;
- identities, password hashes, and authorization data;
- encrypted secret material.

The code should keep the storage layer abstract enough that a future external database adapter can be added if scale requirements change, but the baseline product should optimize for `SQLite`.

### 3.4 Secret Storage

Secrets should be stored separately from general metadata and encrypted at rest. The baseline design should prefer:

- encrypted blobs in local embedded storage;
- a local master-key strategy suitable for single-host deployment;
- strict redaction in logs, status streams, and exported reports.

External secret managers may be added later as optional integrations, but they should not be required for first-run or normal operation.

### 3.5 Discovery and Remote Access

Discovery and host-side operations should use native `Go` SSH-based integration:

- `golang.org/x/crypto/ssh` or equivalent for SSH sessions;
- SFTP or SCP support for file transfer;
- explicit bastion handling in the connection layer;
- structured collection of per-host inventory and diagnostic data.

This is preferable to shelling out to `ssh` because it gives better control over cancellation, retries, credential handling, and structured errors.

### 3.6 Execution Engine

The Installer should implement a persisted phase/task execution engine in `Go` instead of relying on an external workflow platform.

Recommended characteristics:

- one installation session corresponds to one persisted workflow instance;
- phases map directly to the specification's ordered workflow;
- tasks are recorded with timestamps, status, host scope, and structured error payloads;
- cancellation is cooperative and phase-aware;
- resumption is allowed only from explicit safe checkpoints;
- progress can be streamed to the UI through server-sent events, with polling fallback.

This approach satisfies the specification while preserving the copy-and-use property.

### 3.7 YDB Deployment Integration

The preferred deployment architecture is to integrate `ydbops` as a library or reusable internal package boundary rather than treat it as an opaque subprocess.

Recommended direction:

- refactor or wrap `ydbops` capabilities behind Go interfaces owned by the Installer;
- expose domain operations such as host preparation, storage node deployment, storage initialization, database creation, compute node startup, and verification as directly callable functions;
- translate execution events into persisted Installer tasks and progress records;
- keep the Installer responsible for orchestration, session state, RBAC, reporting, and API/UI semantics.

Using `ydbops` only as a CLI subprocess is acceptable only as a transitional compatibility measure. It should not be the target architecture because it weakens:

- structured progress reporting;
- cooperative cancellation;
- checkpoint-level resume behavior;
- typed error handling;
- secret redaction guarantees.

## 4. Recommended Technology Choices

### Choose

- `Go` for backend, API, execution engine, discovery, and remote operations.
- `React` and `TypeScript` for the web UI.
- `ydb-ui-components` as the primary UI library.
- `OpenAPI 3.x` for the public API contract.
- `SQLite` as the baseline persistence store.
- server-sent events plus polling fallback for progress updates.
- structured logging with explicit secret redaction.
- schema-driven validation for imported YAML or JSON batch specifications.

### Avoid as baseline dependencies

- `PostgreSQL`
- `Redis`
- `Temporal`
- `Kafka` or other message brokers
- mandatory `Vault` or cloud KMS dependencies
- mandatory dependence on `Ansible` or `Python`
- subprocess-heavy orchestration as the primary execution model

These may be reasonable future integrations, but they work against the baseline operating model.

## 5. Recommended Runtime Boundaries

The cleanest package/module boundaries are:

- `ui/`: frontend application and static assets
- `api/`: HTTP handlers, OpenAPI wiring, auth, and request validation
- `app/`: session services and orchestration use cases
- `domain/`: installer entities, phase models, validation types, reports
- `execution/`: persisted workflow engine and task runner
- `discovery/`: SSH inventory collection and host probing
- `ydbops/adapter/`: embedded integration boundary to reusable `ydbops` capabilities
- `storage/`: repositories, migrations, `SQLite` access, encrypted secret persistence
- `security/`: credential hashing, key management, redaction, TLS material handling
- `artifacts/`: local artifact intake, verification, and export

This keeps product concerns distinct from deployment-domain concerns and makes a later internal refactor of `ydbops` easier.

## 6. Summary Recommendation

The recommended architecture is a self-contained, single-host control plane built around:

- a `Go` backend;
- a `React` and `TypeScript` UI using `ydb-ui-components`;
- `SQLite` for baseline persistence;
- local encrypted secret storage;
- a custom persisted phase engine;
- native `Go` SSH-based discovery and remote execution support;
- direct embedding or structured integration of `ydbops` capabilities.

This architecture best satisfies the specification while preserving the intended operational model: copy, configure, and use.
