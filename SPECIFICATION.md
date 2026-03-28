# YDB Installer Specification

## 1. Document Control

### 1.1 Purpose

This document specifies a web-based YDB installer that supports interactive and batch installation of YDB clusters on bare-metal or virtual-machine infrastructure.

### 1.2 Scope

The specification addresses the following capabilities:

- collecting reference information about target systems before installation;
- configuring YDB cluster layout, storage, security, and deployment parameters;
- orchestrating installation phases on remote hosts;
- monitoring progress, validating configuration, cancelling runs, and reporting results through a web UI.

It does not prescribe low-level implementation details of the automation backend beyond externally observable functional behavior, except where this specification states explicit implementation-technology requirements.

### 1.3 Source Basis

This specification draws on the following sources:

- YDB manual deployment documentation;
- YDB Ansible deployment documentation;
- the `ydb-platform/ydb-ansible` repository: README, playbooks, and role behavior;
- the `ydbops` tool and its source repository, when available, as a reference for reusable deployment logic;
- the [`ydb-platform/ydb-ui-components`](https://github.com/ydb-platform/ydb-ui-components) repository for the UI component library;
- the [`ydb-platform/ydb-embedded-ui`](https://github.com/ydb-platform/ydb-embedded-ui) repository as the reference source of `ydb-ui-components` usage examples and integration patterns.

FR-DOC-001. The project SHALL maintain a reference index (URLs, release identifiers, or pinned repository revisions) and update it when upstream materials change in ways that affect the Installer's behavior.

The content of those sources is referenced as it existed on **2026-03-28**, unless a later revision of this document states otherwise.

Automation sources listed in this subsection are behavioral and domain references. Their inclusion does not imply a requirement to reuse `Ansible`-based or `Python`-based automation in the Installer implementation.

### 1.4 Definitions

- `Installer`: the application described by this specification.
- `Installation Session`: one persisted installer workflow instance, whether interactive or batch.
- `Operating System`, or `OS`: the software that manages hardware and provides common services for programs. YDB runs on Linux; in this document, `OS` means a supported Linux distribution unless another meaning is stated explicitly.
- `Discovery Snapshot`: immutable system inventory collected from target hosts for a given session.
- `Installation Mode`: whether the running Installer process is in **interactive** or **batch** mode. The mode is fixed at **process startup** via command-line invocation (and optional config file referenced there), per §2.5.
- `Configuration Generation`: the YDB configuration-management generation used for deployment (for example configuration V1 or V2).
- `Base Storage Topology`: the YDB distributed-storage topology within a cluster or within a bridge pile, such as `block-4-2`, `mirror-3-dc`, or `reduced mirror-3-dc`.
- `Bridge Mode`: a cluster layout in which synchronous replication is configured between two or more piles, each pile using a supported base storage topology.
- `Pile`: in bridge mode, a subdivision of the cluster, typically aligned with a data center or availability-zone group.
- `Cluster Layout`: the overall arrangement: host placement, node roles, selected base storage topology, and optional bridge mode.
- `Storage Node`: a YDB cluster process responsible for storage-layer functions. YDB documentation often calls this a `Static Node`. A Storage Node is not a host; it is an OS process on a host in the cluster.
- `Compute Node`: a YDB cluster process responsible for database and compute functions. YDB documentation often calls this a `Dynamic Node`. A Compute Node is not a host; it is an OS process on a host in the cluster.
- `Broker Node`: a YDB cluster process in the role used for coordination and routing as defined by the selected deployment model; the Installer exposes placement and selection of Broker Nodes where the configuration allows.
- `Control Host`: the environment from which automation runs.
- `Target Host`: a host on which YDB is to be installed or configured.
- `Expert Override` (disk selection): an explicit mode that allows the operator to specify block device identifiers manually instead of choosing only from the Discovery Snapshot, subject to warnings and any audit requirements stated elsewhere in this document.
- `Auto Proceed`: a batch-mode option (declared in the batch specification or equivalent settings) that skips interactive confirmation for destructive steps while preflight validation and other blocking checks still apply unless this document states otherwise for that option.
- `Degraded Completion State`: a session outcome in which the operator explicitly accepts completion despite failed or incomplete verification checks; the Installer records which checks did not pass and the fact of operator acceptance.
- `Copy-and-Use Deployment Model`: a distribution and operating model in which the Installer can be copied or unpacked onto a single Control Host and used without mandatory external infrastructure services such as a separate database, workflow engine, message broker, or secret manager for baseline operation.

## 2. Product Overview

### 2.1 Product Goal

The Installer enables an operator to deploy YDB clusters safely and repeatably using either a guided web interface or a declarative batch specification, while respecting the principal operational steps and constraints documented for YDB and remaining practical to distribute and run in a Copy-and-Use Deployment Model. Installation-mode selection is defined in §2.5, and role behavior is defined in §3.

### 2.2 Supported Scenarios

The minimum supported scenarios are:

- initial deployment of a YDB cluster;
- interactive guided installation;
- batch-specification-driven installation;
- single-datacenter and multi-datacenter cluster layouts;
- bridge-mode layouts with synchronous writes across two or more piles;
- TLS-enabled and authentication-enabled deployments;
- copy-and-use deployment on a single Control Host;
- offline or restricted-network deployments when the required artifacts are supplied.

### 2.3 Out of Scope

The following items are outside mandatory scope unless a future revision adds them explicitly:

- automated cluster scaling after initial deployment;
- migration between YDB configuration V1 and V2;
- automated rollback of partially completed installations;
- full lifecycle work unrelated to installation (for example routine upgrades and reconfiguration).

### 2.4 Implementation Technology Requirements

FR-TECH-001. The Installer automation backend and REST API implementation SHALL be written in `Go` (`Golang`).

FR-TECH-002. The Installer web UI SHALL use the `ydb-platform/ydb-ui-components` library as its primary UI component set.

FR-TECH-003. The project SHALL use the `ydb-platform/ydb-embedded-ui` repository as the reference source of usage examples and integration patterns for `ydb-platform/ydb-ui-components`.

FR-TECH-004. The Installer SHALL support the Copy-and-Use Deployment Model as a baseline operating mode.

FR-TECH-005. In the baseline operating mode, the Installer SHALL NOT require a separately managed relational database, workflow engine, message broker, or external secret-management service.

FR-TECH-006. The Installer SHALL prefer embedded or local components suitable for single-host operation for persistence, workflow state, and secret handling.

FR-TECH-006A. Optional integrations with external infrastructure MAY be added later provided they are not required for baseline operation.

FR-TECH-007. The Installer SHALL NOT depend on existing `Ansible`-based or `Python`-based automation as a mandatory execution path.

FR-TECH-008. The preferred execution architecture SHALL reuse or embed `ydbops` capabilities directly within the Installer codebase where practical so that deployment operations, progress reporting, cancellation, and error handling remain under direct Go-level control.

FR-TECH-009. If transitional compatibility requires invoking external helper executables, the Installer SHALL treat that as an implementation detail.

FR-TECH-009A. If transitional compatibility requires invoking external helper executables, the Installer SHALL preserve the same persisted phase model, structured status reporting, and secret-handling guarantees required elsewhere in this specification.

### 2.5 Installation Mode Selection (Command Line)

The Installer is a long-running service whose **Installation Mode** is fixed when the process starts. Operators choose **interactive** or **batch** by passing documented command-line flags or arguments to the server executable; configuration files can supply default flag values as specified in the requirements below.

FR-MODE-001. The Installer SHALL determine **interactive** or **batch** Installation Mode at **process startup** through **command-line invocation** of the server (flags or equivalent).

FR-MODE-001A. Flag values MAY be read from a configuration file when that file is explicitly referenced by the command line or by an equally explicit startup contract documented for the product.

FR-MODE-001B. The Installation Mode SHALL NOT be changed at runtime for a running Installer process.

FR-MODE-002. A running Installer instance SHALL expose exactly one Installation Mode to all clients.

FR-MODE-002A. The REST API and web UI SHALL behave consistently with the active Installation Mode (§6 for configuration-step interaction, §7 for batch specification sourcing and execution).

FR-MODE-003. In **interactive** Installation Mode, session configuration SHALL be performed through interactive configuration steps (§6).

FR-MODE-003A. In **batch** Installation Mode, session configuration SHALL be sourced from the declarative batch specification (§7).

FR-MODE-003B. In **batch** Installation Mode, the web UI SHALL present the effective plan through the same configuration-step structure in non-editable form.

FR-MODE-003C. The UI SHALL NOT offer batch-mode configuration overrides.

## 3. Actors and User Roles

### 3.1 Primary Actors

- `Administrator`: manages access to the Installer, secrets, and system-level policies.
- `Operator`: identity with **execution** privileges (see §3.2). Operator behavior across Installation Modes is defined in §2.5, §6, and §7.
- `Observer`: identity with **read-only** privileges in **both** **interactive** and **batch** Installation Modes. Observer permissions are defined in §3.2 and related UI requirements.

### 3.2 Permissions

FR-ACCESS-001. The Installer SHALL support role-based access to installation sessions.

FR-ACCESS-002. The Installer SHALL prevent users without **Operator** (execution) privileges from starting runs, approving destructive actions, **submitting responses to confirmation prompts that gate execution**, cancelling runs, or resuming installation runs.

FR-ACCESS-003. The Installer SHALL grant users with **Observer** privileges read-only access to the same primary session screens used by **Operator** (Home, Configuration steps, Monitoring, Logs) in both interactive and batch Installation Modes for viewing monitoring, session metadata, and progress.

FR-ACCESS-003A. **Observer** SHALL NOT modify configuration.

FR-ACCESS-003B. **Observer** SHALL NOT submit confirmation responses.

FR-ACCESS-003C. **Observer** SHALL NOT invoke execution-control actions reserved for **Operator**.

FR-ACCESS-004. The Installer SHALL provide administrative functions for managing Installer access, credentials bound to roles, and policies consistent with the Administrator role in §3.1.

FR-ACCESS-005. **Operator** SHALL be permitted to edit installation configuration through the configuration steps only when the Installer process runs in interactive Installation Mode (FR-MODE-003).

FR-ACCESS-005A. In batch Installation Mode, **Operator** SHALL rely on the batch specification (§7) for defining the plan.

FR-ACCESS-005B. In batch Installation Mode, configuration-step fields SHALL be read-only with no override controls.

## 4. High-Level Workflow

### 4.1 Installation Phases

FR-WORKFLOW-001. The Installer SHALL execute installation as an ordered sequence of named phases.

FR-WORKFLOW-002. The Installer SHALL implement at least the following phases:

1. target definition;
2. discovery;
3. configuration input or import;
4. preflight validation;
5. review and approval;
6. host preparation;
7. artifact and certificate preparation;
8. storage node installation and startup;
9. storage initialization;
10. database creation;
11. compute node installation and startup;
12. post-install verification;
13. completion and reporting.

FR-WORKFLOW-003. The Installer SHALL persist phase state for each installation session.

FR-WORKFLOW-004. The Installer SHALL show the current phase, phase result, and phase timestamps in the web UI.

### 4.2 Discovery-First Rule

FR-WORKFLOW-005. The Installer SHALL require a dedicated discovery phase before any destructive installation step.

FR-WORKFLOW-006. The Installer SHALL use the Discovery Snapshot as the default reference for cluster-layout planning and disk selection.

FR-WORKFLOW-007. The Installer SHALL NOT permit disk formatting, repartitioning, or storage initialization until discovery, configuration input or import, and validation have completed successfully.

### 4.3 Phase Alignment

Preflight validation (§12) corresponds to phase 4 above. Review and approval (phase 5) precedes host preparation and subsequent steps that change target systems.

## 5. Discovery and Reference Information Collection

### 5.1 Discovery Inputs

FR-DISCOVERY-001. The Installer SHALL allow the operator to define target hosts using hostnames or IP addresses and associated access parameters.

FR-DISCOVERY-002. The Installer SHALL support target access through direct SSH and bastion-based SSH.

FR-DISCOVERY-002A. SSH authentication SHALL support password-based and key-based methods.

FR-DISCOVERY-002B. SSH authentication settings SHALL be configurable globally with optional per-host overrides.

### 5.2 Discovery Outputs

FR-DISCOVERY-003. The Installer SHALL collect the following information from each target host:

- hostname;
- FQDN when resolvable;
- operating system and version;
- CPU count;
- memory size;
- network addresses and interfaces;
- time synchronization indicators;
- TCP port state relevant to installation;
- block device inventory, including disk size and type;
- existing partitions, labels, filesystems, and mount points;
- indicators of likely system disks.

FR-DISCOVERY-004. The Installer SHALL record discovery failures per host without discarding data collected successfully from other hosts.

FR-DISCOVERY-005. The Installer SHALL persist discovery results as a Discovery Snapshot tied to the installation session.

FR-DISCOVERY-006. The Installer SHALL allow the operator to refresh discovery data before execution.

FR-DISCOVERY-007. The Installer SHALL present discovery results in human-readable form.

FR-DISCOVERY-007A. The Installer SHALL expose discovery results through the REST API or export in structured form suitable for automation.

### 5.3 Disk Discovery Requirements

FR-DISCOVERY-008. The Installer SHALL list discovered disks per host.

FR-DISCOVERY-009. The Installer SHALL distinguish, where possible, between:

- system disks;
- mounted data disks;
- empty or unpartitioned disks;
- disks with existing partition tables, including partition sizes and mount points when present;
- disks that appear to contain prior YDB-related data or labels.

FR-DISCOVERY-010. The Installer SHALL restrict disk selection for YDB use to devices present in the Discovery Snapshot unless Expert Override is enabled.

FR-DISCOVERY-010A. When Expert Override is enabled, the Installer SHALL allow the operator to enter device identifiers manually, superseding discovery-derived choices.

FR-DISCOVERY-010B. When Expert Override is enabled, the Installer SHALL surface the associated risk warnings.

## 6. Configuration Steps Interface and Mode-Specific Behavior

### 6.1 Guided Workflow

FR-INTERACTIVE-001. When the Installer runs in **interactive** Installation Mode (FR-MODE-001, §2.5), the Installer SHALL provide an interactive web-based configuration-step flow for installation setup.

FR-INTERACTIVE-001A. When the Installer runs in **batch** Installation Mode, the same step structure SHALL present the effective batch-derived plan in non-editable form (FR-MODE-003, FR-ACCESS-005).

FR-INTERACTIVE-001B. In **batch** Installation Mode, the configuration-step flow SHALL NOT be the source of configuration input.

FR-INTERACTIVE-002. The configuration-step flow SHALL present configuration steps in a logical order that follows the installation phases.

FR-INTERACTIVE-003. The configuration steps SHALL prefill fields from the Discovery Snapshot wherever possible.

FR-INTERACTIVE-004. The configuration-step flow SHALL persist unfinished configuration drafts.

FR-INTERACTIVE-004A. The configuration-step flow SHALL allow the operator to resume unfinished configuration later.

FR-INTERACTIVE-004B. Draft persistence SHALL meet the autosave requirements in FR-USABILITY-004.

### 6.2 Configuration Screens

FR-INTERACTIVE-005. The configuration-step workflow SHALL provide screens or equivalent UI sections for:

- target host selection;
- authentication settings and overrides;
- discovery results review;
- cluster layout and role assignment;
- disk selection and storage mapping;
- network and endpoint settings;
- security and TLS settings;
- YDB version and artifact source;
- database settings;
- review and approval.

Normative descriptions of the configuration-step sequence, transition rules, and form controls appear in §6.5–§6.7 (together with FR-INTERACTIVE-009 and FR-INTERACTIVE-010). Supporting Monitoring and Logs views are specified in §6.8–§6.9. In **batch** Installation Mode, the configuration-step forms represent a pre-filled read-only projection of the effective batch specification except for confirmation and run-control actions explicitly allowed elsewhere in this specification.

FR-INTERACTIVE-006. In **interactive** Installation Mode, the configuration-step workflow SHALL validate user input before advancing to the next step.

FR-INTERACTIVE-006A. In **batch** Installation Mode, corresponding configuration-step sections SHALL be read-only.

FR-INTERACTIVE-006B. In **batch** Installation Mode, corresponding configuration-step sections SHALL display validation status derived from the batch-sourced configuration.

### 6.3 Presets

FR-INTERACTIVE-007. The Installer SHALL provide predefined setup presets at minimum for:

- single-datacenter `block-4-2` production cluster;
- multi-datacenter `mirror-3-dc` production cluster;
- `reduced mirror-3-dc` cluster;
- bridge-mode cluster.

FR-INTERACTIVE-008. Presets SHALL populate recommended defaults without preventing the operator from editing them.

### 6.4 Application Shell, Home, and Cross-Screen Navigation

FR-INTERACTIVE-009. The guided configuration-step flow SHALL present the configuration forms in the order defined in §6.5.

FR-INTERACTIVE-009A. The guided configuration-step flow SHALL enforce the transition rules stated in §6.5.

FR-INTERACTIVE-009B. The guided configuration-step flow SHALL provide the input controls identified in §6.6 for each form.

FR-INTERACTIVE-010. The Installer UI SHALL provide the application shell, Home session view, execution monitoring screen, and logs screen described in §6.4, §6.8, and §6.9 in all Installation Modes.

FR-INTERACTIVE-010A. The Installer UI SHALL provide a configuration-step view described in §6.5–§6.7 that is editable in **interactive** mode and pre-filled/read-only in **batch** mode (FR-MODE-003, FR-BATCH-001, FR-ACCESS-005).

FR-INTERACTIVE-011. The web UI SHALL be organized as a single-page application with a persistent shell (header or sidebar) and routed views.

FR-INTERACTIVE-012. The screen set SHALL be the same for both **Operator** and **Observer**.

FR-INTERACTIVE-013. Role differences in the UI SHALL be implemented through control availability rather than through separate role-specific screens.

Path names in this subsection are illustrative and may be implemented with equivalent routing.

FR-INTERACTIVE-014. Home (`/`) SHALL be the authentication entry screen.

FR-INTERACTIVE-015. Home SHALL provide a role selector (`Operator` or `Observer`) and the credential entry required for that role, including password input.

FR-INTERACTIVE-015A. Username input MAY be shown when the configured authentication scheme requires it.

FR-INTERACTIVE-016. Switching roles from an active session SHALL require re-authentication for the selected role, consistent with §10.2.

| Screen | Route (illustrative) | Purpose | Operator controls | Observer controls |
|--------|----------------------|---------|-------------------|-------------------|
| Home | `/` | Authentication and session-entry screen with role switch and credentials; after authentication, it shows the current session identity and entry points to workflow screens. | Authenticate as **Operator**; navigate to Configuration, Monitoring, and Logs; use actions permitted by role and mode. | Authenticate as **Observer**; navigate to Configuration, Monitoring, and Logs; read-only access only. |
| Configuration | `/configuration` | Multi-step session workflow (§6.5–§6.7), including configuration, review, and run-state step 11. | In **interactive** mode: edit configuration steps and execute allowed actions. In **batch** mode, or after installation has started: configuration is pre-filled and read-only. | Same steps visible in read-only form; no configuration edits, no confirmation submissions, and no execution-control actions. |
| Monitoring | `/monitoring` | Live or polled progress, phase and task detail, run state, and failure context (§14, §15). | Read run state; request cancel/resume where authorized by policy and implementation. | Read run state only; no cancel/resume or other execution-control actions. |
| Logs | `/logs` | Session log view with filtering and historical browsing for installation logs (§6.9, §14). | Read logs; use filters; export/download logs where available. | Read logs with same filtering/navigation in read-only form; no operator-only execution controls. |
| Logout | `/logout` | Terminate access to the application. | End the authenticated session and return to the Home screen. | Same as for **Operator**. |

FR-INTERACTIVE-017. Navigation links for Home, Configuration, Monitoring, Logs, and Logout SHALL be available from every screen.

FR-INTERACTIVE-018. Opening Logs MAY use a dedicated browser window or tab.

FR-INTERACTIVE-018A. When Logs is opened in a dedicated browser window or tab, the current Configuration or Monitoring context SHALL remain intact in the originating window.

Role-specific control availability follows the matrix above and FR-ACCESS-002, FR-ACCESS-003, and FR-UI-009. Draft configuration retention in interactive mode is defined by FR-INTERACTIVE-004 and FR-INTERACTIVE-004A.

### 6.5 Interactive Configuration Steps: Expected Step Sequence and Transitions

FR-INTERACTIVE-019. The interactive configuration-step flow SHALL implement the following ordered steps.

FR-INTERACTIVE-020. Step identifiers SHALL be stable product labels.

FR-INTERACTIVE-021. The UI SHALL show configuration steps as tabs or breadcrumbs at the top of the screen, using readable labels.

| Step | Id | Label (English) |
|------|-----|-----------------|
| 1 | `targets` | Target definition |
| 2 | `discovery_run` | Discovery |
| 3 | `discovery_results` | Discovery results |
| 4 | `layout` | Cluster layout |
| 5 | `storage` | Disk selection |
| 6 | `network` | Network & endpoints |
| 7 | `security` | Security & TLS |
| 8 | `artifacts` | Artifacts & version |
| 9 | `database` | Database settings |
| 10 | `review` | Review & approval |
| 11 | `run_state` | Run state & confirmations |

FR-INTERACTIVE-022. The default forward path SHALL advance in order as **1 → 2 → 3 → 4 → ... → 10 → 11**.

FR-INTERACTIVE-023. Back from any step SHALL return to the immediately previous step without discarding saved draft data unless the operator explicitly discards a session.

**Transition rules.**

FR-INTERACTIVE-024. Transition from step 1 to step 2 SHALL be allowed only after the target list is saved and contains at least one valid target address.

FR-INTERACTIVE-024A. The UI SHOULD require an explicit save action before transition from step 1 to step 2 so that server state matches the form.

FR-INTERACTIVE-025. Running discovery SHALL require saved targets.

FR-INTERACTIVE-025A. Advancing from step 2 to step 3 after a successful discovery run SHOULD be automatic or one-click.

FR-INTERACTIVE-025B. The operator MAY open step 3 when a discovery snapshot already exists, for example after a refresh.

FR-INTERACTIVE-026. Transition from step 3 to step 4 SHALL be allowed once a discovery snapshot is available for review, even if some hosts failed discovery as allowed by FR-DISCOVERY-004.

FR-INTERACTIVE-026A. The operator SHALL acknowledge discovery results before proceeding from step 3 to step 4.

FR-INTERACTIVE-027. Forward navigation through steps 4 to 9 SHALL run step validation before leaving a step that has required fields (FR-INTERACTIVE-006).

FR-INTERACTIVE-028. Entering Review & approval at step 10 SHALL require completion of preflight validation with no blocking errors (FR-VALIDATION-001, FR-VALIDATION-008).

FR-INTERACTIVE-028A. The UI MAY trigger the required preflight validation automatically when leaving step 9 or through an equivalent explicit pre-review action.

FR-INTERACTIVE-029. Starting execution from step 10 SHALL require explicit approval for destructive scope (§9.2, FR-STORAGE-011).

FR-INTERACTIVE-029A. After execution starts, the UI SHALL transition to step 11 to show current run state and any confirmation requests that gate progress.

FR-INTERACTIVE-030. The operator MAY switch to Monitoring or Logs while on step 11 at any time.

FR-INTERACTIVE-030A. Returning to step 11 SHALL preserve the latest run-state and confirmation-request context.

FR-INTERACTIVE-031. The operator MAY open Monitoring or Home while configuration is incomplete.

FR-INTERACTIVE-031A. The step strip SHOULD reflect persisted progress when returning to `/configuration`.

### 6.6 Configuration Form Definitions (Descriptions and Input Controls)

Each subsection describes **one configuration-step form**: its role in the workflow, the **primary input controls** (type and purpose), and **dependencies** on other steps or data. Control labels are illustrative. Localization and secret-handling requirements are defined by FR-I18N-001, FR-SECURITY-008, and FR-USABILITY-005.

#### 6.6.1 Step 1 — Target definition (`targets`)

**Description.** Collect the set of target hosts and parameters needed to reach them over SSH for discovery and later execution (§5.1, FR-DISCOVERY-001, FR-DISCOVERY-002).

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| Target rows (repeatable) | List | One row per target host. |
| Address | Text | Hostname or IP (FR-DISCOVERY-001). Required per row. |
| SSH port | Number | TCP port; default 22. |
| SSH user | Text | Login user for SSH. |
| SSH password | Password Text | Password for SSH. |
| SSH key | Upload button | Private key for SSH. |
| Host id (optional) | Text | Stable identifier for the host in session configuration when distinct from address. |
| Bastion host | Text | Jump host for bastion-based SSH, when used. |
| Bastion user | Text | Account on the bastion. |
| Add host / Remove row | Buttons | Maintain the list. |
| Global or per-target authentication | Password fields, private-key selector or upload, “use SSH agent” toggle | Support password-based and key-based authentication, global defaults with optional per-host overrides (FR-DISCOVERY-002). Values MUST be handled as secrets. |
| Save targets | Primary action | Persists targets to the session before discovery or later phases. |

The form should contain two blocks:
- default SSH access settings;
- table with the targets.

Both blocks should display a read-only format of the current settings, and contain buttons (for **Operator** access) to edit.

The table's edit buttons should be Add, Remove and Edit, each allowing to provide the necessary settings.

SSH access details for the particular target should allow to use the default settings, or to switch to custom settings, which must be entered in the latter case.

#### 6.6.2 Step 2 — Discovery run (`discovery_run`)

**Description.** Trigger remote discovery against saved targets and show run status (phase 2 in §4.1).

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| Run discovery | Button | Starts discovery; disabled until targets are saved. |
| Refresh discovery | Button | Re-runs discovery to update the Discovery Snapshot (FR-DISCOVERY-006). |
| Progress / error display | Text, progress indicator | Shows running state and per-session errors without leaking secrets. |

#### 6.6.3 Step 3 — Discovery results (`discovery_results`)

**Description.** Read-only presentation of the Discovery Snapshot (§5.2) for operator review before cluster design.

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| Host inventory table or cards | Read-only grid | Hostname, FQDN, OS, hardware summary, disk inventory columns, per-host discovery errors (FR-DISCOVERY-003, FR-DISCOVERY-007). |
| Continue to configuration | Primary action | Moves to layout when the operator is ready; the UI can warn if critical hosts failed discovery. |

#### 6.6.4 Step 4 — Cluster layout (`layout`)

**Description.** Define base storage topology, optional bridge mode and piles, node roles, and placement (§8, FR-LAYOUT-001–FR-LAYOUT-017, FR-INTERACTIVE-007).

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| Preset selector | Select or radio group | Single-DC `block-4-2`, multi-DC `mirror-3-dc`, `reduced mirror-3-dc`, bridge preset (FR-INTERACTIVE-007). |
| Base storage topology | Select | Must match §8.1; distinct from bridge mode (FR-LAYOUT-003). |
| Bridge mode | Toggle | When on, enables pile and synchronous-replication controls (FR-LAYOUT-002, FR-LAYOUT-014–FR-LAYOUT-017). |
| Pile definitions | Repeatable group | Name/id and failure-domain labels for each pile (FR-LAYOUT-004, FR-LAYOUT-005). |
| Per-host or per-node role assignment | Matrix, multi-select, or drag targets | Storage Node, Compute Node, Broker Node where applicable (FR-LAYOUT-008–FR-LAYOUT-010). |
| Compute nodes per host | Number (where allowed) | FR-LAYOUT-009. |
| Location attributes | Text or select per host | Rack, data center, availability zone, pile membership (FR-LAYOUT-007). |

#### 6.6.5 Step 5 — Disk selection (`storage`)

**Description.** Map discovered disks to YDB storage, partitioning, labels, and media grouping (§9, FR-STORAGE-001–FR-STORAGE-008).

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| Disk pick lists per host | Multi-select from discovery | Restricted to Discovery Snapshot unless Expert Override is on (FR-DISCOVERY-010, FR-STORAGE-001). |
| Expert Override | Toggle + text fields | Manual device identifiers with risk warnings (FR-DISCOVERY-010). |
| Partitioning scheme | Select or guided form | For unpartitioned disks (FR-STORAGE-002, FR-STORAGE-003, FR-STORAGE-004). |
| Disk type / kind / label pattern | Fields per group | FR-STORAGE-005–FR-STORAGE-008. |
| Safety summaries | Read-only callouts | Warnings for mounted, system, or in-use disks (FR-STORAGE-009–FR-STORAGE-011). |

#### 6.6.6 Step 6 — Network & endpoints (`network`)

**Description.** Client-facing and intra-cluster network settings, including separated front-end and back-end models (§8.3, FR-LAYOUT-011–FR-LAYOUT-013).

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| Network model | Radio | Standard single-network vs separated front/back (FR-LAYOUT-011, FR-LAYOUT-012). |
| Front-end FQDN / endpoints | Text | Client access (FR-LAYOUT-013). |
| Back-end FQDN / internal addresses | Text | Intra-cluster communication (FR-LAYOUT-013). |
| Additional listeners / ports | Text or number | As required by selected layout and validation. |

#### 6.6.7 Step 7 — Security & TLS (`security`)

**Description.** TLS materials, Installer-facing HTTPS options where relevant, and YDB authentication settings (§10).

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| TLS mode | Select | Operator-provided certs, installer-managed generation, or equivalent (FR-SECURITY-002, FR-SECURITY-003). |
| Certificate and key material | File upload or path on control host | FR-SECURITY-002; masked display. |
| Certificate generation parameters | Form fields | Validity, SANs, CA settings as supported (FR-SECURITY-003). |
| YDB authentication | Toggles and credential capture | FR-SECURITY-006, FR-SECURITY-007; secrets masked. |

#### 6.6.8 Step 8 — Artifacts & version (`artifacts`)

**Description.** YDB version, configuration generation, and artifact source (§11, FR-ARTIFACT-001–FR-ARTIFACT-005).

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| Artifact source mode | Radio | Download, local archive, local binaries (FR-ARTIFACT-001). |
| Version / component selectors | Text or select | Compatible with configuration V1 or V2 (FR-ARTIFACT-004). |
| Local path fields | Text | Paths on the control host for archives or binaries. |
| Offline / mirror URL | Text | When used instead of public download in restricted environments. |

#### 6.6.9 Step 9 — Database settings (`database`)

**Description.** Initial database creation parameters used before compute nodes start (§13.4, FR-EXECUTION-009).

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| Database name | Text | Initial database identifier. |
| Domain / root paths | Text | As required by YDB deployment model. |
| Additional DB options | Fields | Charset, pools, or other documented first-run settings exposed by the Installer. |

#### 6.6.10 Step 10 — Review & approval (`review`)

**Description.** Consolidated read-only summary of effective configuration, latest preflight-validation outcome captured before review, destructive-scope confirmation, and execution start (§12, §9.2).

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| Configuration summary | Read-only sections | Hosts, topology, disks, security, artifacts. |
| Validation results | Read-only panel | Shows latest preflight result summary with blocking vs warning classification (FR-VALIDATION-003). |
| Approve destructive actions | Checkbox or typed confirmation | Identifies affected hosts and disks (FR-STORAGE-012). |
| Start installation / Proceed | Primary button | Available only when blocking errors are cleared and required destructive confirmations are completed. |

#### 6.6.11 Step 11 — Run state & confirmations (`run_state`)

**Description.** Execution-time configuration-step screen that shows current session state, highlights pending confirmation requests that gate progress, and provides quick navigation to monitoring and logs views. For **Operator**, this step allows submission of confirmation responses where required. For **Observer**, this step is read-only.

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| Current run state summary | Read-only panel | Current phase/task, session status, elapsed time, and high-level warnings/errors (FR-MONITORING-002). |
| Pending confirmation requests | List | Shows active confirmation prompts that gate execution, including scope and consequence summary. |
| Confirmation response controls | Buttons or form actions (authorized roles) | Allow **Operator** to submit required responses; **Observer** sees state only (FR-ACCESS-002, FR-ACCESS-003, FR-UI-009). |
| Open Monitoring | Link or button | Navigates to `/monitoring` for detailed progress timeline and host/task status. |
| Open Logs | Link or button | Navigates to `/logs` for detailed installation logs. |

### 6.7 Batch-Mode Pre-Filled Configuration Steps (No Separate Batch Screen)

**Description.** In **batch** Installation Mode, the UI uses the same `/configuration` route and step structure as §6.5–§6.6 to present the effective batch-derived plan. There is no separate batch configuration screen or route.

**Interaction rules.**

| Rule | Semantics |
|------|-----------|
| Batch data source | Session configuration values come from the loaded batch specification and its validated effective form (FR-BATCH-001–FR-BATCH-004). |
| No configuration overrides | Configuration-step controls for targets, topology, storage, network, security, artifacts, and database settings are pre-filled and read-only in **batch** mode (FR-MODE-003, FR-ACCESS-005). |
| Allowed actions | Users with **Operator** privileges can provide required confirmation responses and run-control actions where this specification allows them (FR-ACCESS-002, FR-BATCH-008A, §15). |
| Visibility | The UI indicates that values are batch-sourced, pre-filled, and non-editable for the running session (FR-BATCH-001A). |

### 6.8 Execution Monitoring Screen

**Description.** Satisfies FR-MONITORING-001–FR-MONITORING-003 and FR-RUNCONTROL-001: current phase and task, per-host state, elapsed time, log tail, warnings and errors, cancellation, and bridge-vs-base distinction where applicable.

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| Phase and task display | Read-only text / timeline | FR-MONITORING-002. |
| Host list with status | Table or list | FR-MONITORING-002. |
| Log viewer | Scrollable text with severity | FR-MONITORING-002; secrets redacted. |
| Filter by host / phase / severity | Select or toggles | FR-UI-006. |
| Cancel run | Button (authorized roles) | FR-RUNCONTROL-001; cooperative cancel (FR-RUNCONTROL-002–FR-RUNCONTROL-005). |
| Export / download logs or report | Links | When FR-REPORTING applies post-run. |

### 6.9 Logs Screen

**Description.** Dedicated view for installation logs of the active session, including live tail during execution and historical log browsing after completion or failure.

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| Log stream viewer | Scrollable text/table | Shows timestamped log entries with severity; secrets redacted (FR-SECURITY-008, FR-USABILITY-005). |
| Filter by host / phase / severity / time range | Selectors and inputs | Narrows visible log entries for troubleshooting (FR-UI-006). |
| Auto-follow toggle | Toggle | Keeps view pinned to newest entries while enabled. |
| Download or export logs | Link or button | Exports logs for reporting and troubleshooting (FR-REPORTING-002, FR-REPORTING-006). |
| Back to run state or monitor | Link or button | Returns to `/configuration` step 11 or `/monitoring` without losing session context. |

## 7. Batch Installation Mode

### 7.1 Batch Specification

FR-BATCH-001. When the Installer runs in **batch** Installation Mode (FR-MODE-001, §2.5), the Installer SHALL execute from a declarative batch specification as the source of session configuration.

FR-BATCH-001A. In **batch** Installation Mode, the web UI SHALL present the effective configuration through the pre-filled configuration-step projection in §6.7 without permitting configuration edits for the running session.

FR-BATCH-002. The batch specification format SHALL be YAML or JSON.

FR-BATCH-003. The batch specification SHALL cover all configuration areas needed for an installation equivalent to interactive mode.

FR-BATCH-004. The Installer SHALL validate the batch specification after load and before any destructive action.

### 7.2 Batch Execution Management

FR-BATCH-005. A batch installation run SHALL be visible through the same web UI used for interactive runs.

FR-BATCH-005A. A batch installation run SHALL be controllable there by authorized users.

FR-BATCH-005B. Batch runs SHALL use the shared Home, Configuration steps (pre-filled read-only in batch mode), Monitoring, and Logs views.

FR-BATCH-006. The Installer SHALL display live phase progress, logs, warnings, and failures for batch runs.

FR-BATCH-007. The Installer SHALL support starting a batch run from a declarative specification supplied through documented startup or API mechanisms, including at minimum:

- a supplied batch specification artifact;
- a stored specification;
- a specification derived from a previous interactive session.

FR-BATCH-008. Batch configuration and execution described in §7 SHALL be used when the Installer process runs in **batch** Installation Mode.

FR-BATCH-008A. **Operator** SHALL provide confirmation responses through the web UI or REST API as required (FR-ACCESS-002), except where **Auto Proceed** applies (§1.4).

FR-BATCH-008B. Confirmation responses submitted during batch execution SHALL NOT modify batch-sourced configuration values.

## 8. Cluster Layout and Storage Topology

### 8.1 Supported Cluster Layouts

FR-LAYOUT-001. The Installer SHALL support at minimum the following base storage topologies:

- single-datacenter `block-4-2`;
- multi-datacenter `mirror-3-dc`;
- `reduced mirror-3-dc`.

FR-LAYOUT-002. The Installer SHALL support a cluster layout with bridge mode enabled on top of a supported base storage topology.

FR-LAYOUT-003. The Installer SHALL model bridge mode as a distinct cluster-layout option.

FR-LAYOUT-003A. The Installer SHALL NOT present bridge mode as equivalent to a base storage topology.

FR-LAYOUT-004. For bridge mode, the Installer SHALL support configuration of two or more piles participating in synchronous write.

FR-LAYOUT-005. For bridge mode, the Installer SHALL allow piles to be mapped to data centers, availability zones, or other operator-defined failure domains.

FR-LAYOUT-006. The Installer SHALL require the operator to assign node roles and physical placement attributes required for the selected cluster layout.

FR-LAYOUT-007. The Installer SHALL support per-host location attributes including rack, data center, availability zone, and, when bridge mode is enabled, pile membership.

### 8.2 Node Roles

FR-LAYOUT-008. The Installer SHALL support assignment of hosts to run Storage Nodes, Compute Nodes, or both where the configuration allows.

FR-LAYOUT-009. The Installer SHALL support more than one Compute Node per host where configured.

FR-LAYOUT-010. The Installer SHALL support explicit Broker Node selection.

FR-LAYOUT-010A. The Installer SHALL provide recommended defaults when the operator does not choose Broker Nodes manually.

### 8.3 Network Models

FR-LAYOUT-011. The Installer SHALL support a standard single-network deployment model.

FR-LAYOUT-012. The Installer SHALL support separated front-end and back-end network configuration.

FR-LAYOUT-013. When separated networks are used, the Installer SHALL allow independent configuration of:

- front-end FQDN for client access;
- back-end FQDN for intra-cluster communication.

### 8.4 Bridge-Mode-Specific Planning

FR-LAYOUT-014. When bridge mode is enabled, the Installer SHALL provide UI controls for defining piles and assigning hosts to piles.

FR-LAYOUT-015. When bridge mode is enabled, the Installer SHALL support a bridge layout spanning two or more availability zones or data centers that participate in synchronous write.

FR-LAYOUT-016. When bridge mode is enabled, the Installer SHALL present the relationship between:

- the overall cluster layout;
- the base storage topology used inside each pile;
- synchronous replication across piles.

FR-LAYOUT-017. The Installer SHALL label bridge mode clearly as a multi-datacenter cluster feature layered on the selected base storage topology.

## 9. Storage Configuration

### 9.1 Disk Selection

FR-STORAGE-001. The Installer SHALL allow the operator to assign selected discovered disks to YDB storage on a per-host basis.

FR-STORAGE-002. For selected unpartitioned disks, the Installer SHALL offer a partitioning scheme suitable for YDB before storage preparation begins.

FR-STORAGE-003. For selected unpartitioned disks, the Installer SHALL default to suggesting one YDB partition per disk unless the operator or preset chooses otherwise.

FR-STORAGE-004. If the selected base storage topology is `reduced mirror-3-dc` and fewer than three YDB disks are available on a host, the Installer SHALL suggest creating three YDB partitions per disk on that host.

FR-STORAGE-005. The Installer SHALL support per-disk or per-partition labeling required for YDB configuration generation.

FR-STORAGE-006. The Installer SHALL support specifying the effective disk type classification required by YDB configuration.

FR-STORAGE-007. The Installer SHALL group available disks for configuration purposes by media type (HDD, SSD, NVMe) and by size class.

FR-STORAGE-007A. Disks on the same host whose capacities differ by at most 10% MAY be placed in the same size class for grouping.

FR-STORAGE-007B. Each disk group SHALL receive consistent type and kind characteristics in the generated YDB configuration.

FR-STORAGE-008. The Installer SHALL group hosts that share a similar disk layout so that a single host-configuration block can describe disks for all hosts in the group.

FR-STORAGE-008A. The recommended partitioning scheme SHALL yield disk labels that reference analogous disks on different hosts in the group through the same label pattern.

### 9.2 Storage Safety

FR-STORAGE-009. The Installer SHALL detect and warn when selected disks appear to be:

- mounted;
- in use by the operating system;
- already partitioned;
- below recommended capacity;
- likely to contain existing data.

FR-STORAGE-010. The Installer SHALL distinguish clearly between:

- disks suitable for production use;
- disks suitable only for reduced-capacity or non-production use;
- disks that SHALL NOT be used without an explicit override.

FR-STORAGE-011. The Installer SHALL require explicit operator approval before any operation that can erase data.

FR-STORAGE-011A. In batch mode, explicit operator approval MAY be waived when **Auto Proceed** is enabled in the batch specification or Installer settings.

FR-STORAGE-011B. **Auto Proceed** SHALL NOT disable blocking validation errors unless this document explicitly allows that for a given check.

FR-STORAGE-012. The approval step SHALL identify exactly which hosts, disks, and planned partitions are affected.

## 10. Security and Secrets

### 10.1 TLS Support

FR-SECURITY-001. The Installer web UI and REST API SHALL be served over TLS using either operator-supplied key and certificate material or an automatically generated self-signed certificate when the operator does not supply a certificate.

FR-SECURITY-002. The Installer SHALL support operator-provided TLS materials.

FR-SECURITY-003. The Installer SHALL support certificate generation managed within the installation workflow when the automation supports it.

FR-SECURITY-003A. Certificate generation SHALL be a distinct step.

FR-SECURITY-003B. Certificate parameters SHALL be configurable through operator-managed settings.

FR-SECURITY-004. The Installer SHALL validate that supplied TLS assets are structurally complete for the selected cluster layout and network model.

### 10.2 Authentication

FR-SECURITY-005. The Installer SHALL protect its UI and REST API with HTTP Basic authentication (or a successor scheme documented alongside the REST API).

FR-SECURITY-005A. User identities SHALL map to the roles in §3.1.

FR-SECURITY-005B. Initial credentials SHALL be supplied through Installer startup configuration.

FR-SECURITY-005C. Installation Mode (interactive vs batch) SHALL be selected only at process startup (FR-MODE-001).

FR-SECURITY-005CA. Installation Mode SHALL be independent of authenticated role.

FR-SECURITY-005D. **Operator** and **Observer** identities SHALL be available in both Installation Modes, subject to §3.2.

FR-SECURITY-005E. Administrative actions SHALL be available only to identities with Administrator privileges.

FR-SECURITY-005F. Execution privileges SHALL follow FR-ACCESS-002.

FR-SECURITY-006. The Installer SHALL support installation with YDB user authentication enabled.

FR-SECURITY-007. The Installer SHALL support capturing or importing the initial administrator credentials required for installation.

FR-SECURITY-008. The Installer SHALL prevent secrets from appearing in clear text in routine logs and progress views.

### 10.3 Secret Storage

FR-SECURITY-009. The Installer SHALL store secrets securely and separately from general session metadata.

FR-SECURITY-010. The Installer SHALL restrict secret visibility to authorized users.

FR-SECURITY-011. Baseline secret storage SHALL operate locally on the Control Host.

FR-SECURITY-011A. Baseline secret storage SHALL NOT require an external secret-management service for normal operation.

## 11. Artifact and Version Management

FR-ARTIFACT-001. The Installer SHALL support the following artifact-source modes:

- download from the web by specifying component versions;
- local archive;
- local binaries.

FR-ARTIFACT-002. The Installer SHALL validate the chosen artifact source against the selected installation scenario.

FR-ARTIFACT-002A. The Installer SHALL reject inconsistent artifact-source combinations as blocking validation errors.

Validation for FR-ARTIFACT-002 includes at minimum:

- if the installation scenario is offline or isolated, the Installer SHALL reject artifact acquisition by direct web download unless an approved internal mirror or equivalent local source is configured;
- if the artifact source is `local archive`, the Installer SHALL verify that all required archive files are present and readable on the Control Host before execution starts;
- if the artifact source is `local binaries`, the Installer SHALL verify that all required binaries are present and readable on the Control Host before execution starts;
- if multiple installable components are selected, the Installer SHALL verify that the chosen artifact source supplies every required component for that scenario;
- if the chosen artifact source does not satisfy the scenario, the Installer SHALL present a corrective validation message that identifies missing or incompatible artifact inputs.

FR-ARTIFACT-003. The Installer SHALL allow offline or isolated installation when all required artifacts are supplied.

FR-ARTIFACT-004. The Installer SHALL support selecting YDB versions compatible with configuration V1 or configuration V2.

FR-ARTIFACT-005. The Installer SHALL detect or derive the effective configuration generation where possible.

FR-ARTIFACT-005A. The Installer SHALL show the effective configuration generation to the operator.

## 12. Validation and Preflight Checks

### 12.1 General Validation

FR-VALIDATION-001. The Installer SHALL run preflight validation after configuration input or import and before review and approval for execution.

FR-VALIDATION-002. Preflight validation SHALL verify that:

- the configuration is internally correct and complete;
- the configuration matches the Discovery Snapshot or explicitly accepted deviations.

FR-VALIDATION-003. The Installer SHALL classify validation results as:

- blocking error;
- warning;
- informational notice.

FR-VALIDATION-004. The Installer SHALL present validation results per host and for the overall cluster configuration.

### 12.2 Required Checks

FR-VALIDATION-005. Preflight validation SHALL include at minimum:

- SSH connectivity;
- privilege escalation viability;
- required OS characteristics;
- `systemd` availability;
- required automation prerequisites;
- host reachability;
- configuration completeness and correctness;
- consistency among configured hosts, roles, disks, locations, and endpoints;
- consistency between the entered or imported configuration and the Discovery Snapshot;
- cluster-layout consistency;
- base storage topology consistency;
- disk mapping consistency;
- certificate completeness when TLS is enabled.

FR-VALIDATION-006. The Installer SHALL validate that bridge mode, when selected, is configured with at least two piles and that each pile has the required host assignments.

FR-VALIDATION-007. The Installer SHALL warn when the planned cluster layout does not satisfy documented production recommendations for the selected base storage topology or bridge layout.

FR-VALIDATION-008. The Installer SHALL prevent execution while blocking errors remain.

## 13. Execution Engine Behavior

### 13.1 Host Preparation

FR-EXECUTION-001. The Installer SHALL prepare hosts according to the selected installation plan, including prerequisite packages, system settings, and YDB runtime user preparation.

FR-EXECUTION-002. The Installer SHALL copy required binaries, libraries, configuration files, and certificates to the appropriate target hosts.

### 13.2 Storage Nodes

FR-EXECUTION-003. The Installer SHALL install and start Storage Nodes before attempting storage initialization.

FR-EXECUTION-004. The Installer SHALL wait for Storage Nodes to reach the required readiness level before continuing.

### 13.3 Storage Initialization

FR-EXECUTION-005. The Installer SHALL initialize YDB storage only after Storage Node readiness checks succeed.

FR-EXECUTION-006. The Installer SHALL persist the result of storage initialization.

FR-EXECUTION-006A. The Installer SHALL show storage-initialization failure details in the UI.

FR-EXECUTION-007. When bridge mode is enabled, the Installer SHALL run bridge-specific configuration steps in an order consistent with the selected base storage topology and pile layout.

FR-EXECUTION-008. When bridge mode is enabled, the Installer SHALL show bridge-specific progress and failures separately from ordinary storage-initialization steps.

### 13.4 Database and Compute Nodes

FR-EXECUTION-009. The Installer SHALL create the configured initial database before starting Compute Nodes that serve it.

FR-EXECUTION-010. The Installer SHALL install and start Compute Nodes after successful database creation.

FR-EXECUTION-011. The Installer SHALL support creating and activating more than one Compute Node service per host where configured.

### 13.5 Verification

FR-EXECUTION-012. The Installer SHALL perform post-install verification at minimum by checking:

- endpoint availability;
- discovery and readiness behavior;
- cluster health indicators where available;
- execution of basic test queries.

FR-EXECUTION-013. When bridge mode is enabled, the Installer SHALL include verification of bridge-related configuration status and pile membership visibility when the backend supports such checks.

FR-EXECUTION-014. The Installer SHALL mark the installation session completed only when required verification checks succeed, or when the operator explicitly accepts a **Degraded Completion State** as defined in §1.4.

## 14. Progress Monitoring

FR-MONITORING-001. The Installer SHALL update execution progress in the web UI continuously during a run (for example via push notifications or polling at a short interval).

FR-MONITORING-001A. Continuous progress updates SHALL allow **Operator** and **Observer** to track phase and task advancement without manual refresh as the sole mechanism.

FR-MONITORING-002. The progress view SHALL show:

- current phase;
- current task;
- per-host state;
- elapsed time;
- recent log output;
- warnings and errors;
- overall completion estimate when available.

FR-MONITORING-003. For bridge-mode installations, the progress view SHALL distinguish base storage topology steps from bridge-specific steps.

FR-MONITORING-004. The Installer SHALL retain historical logs and status transitions for later review.

FR-MONITORING-005. The Installer SHALL provide a dedicated logs screen that shows installation logs for the active session, supports filtering by host, phase, severity, and time range, and remains available for historical review after run completion.

FR-MONITORING-006. The Installer SHALL provide a read-only run-state-and-confirmations view to **Observer** identities that corresponds to configuration step 11 (`run_state`) and exposes current run state and confirmation-request status without allowing submission of confirmation responses.

## 15. Cancellation, Failure Handling, and Resume

### 15.1 Cancellation

FR-RUNCONTROL-001. The Installer SHALL allow an authorized user with operator privileges to request cancellation of a running session from the web UI.

FR-RUNCONTROL-002. Cancellation SHALL be cooperative and phase-aware.

FR-RUNCONTROL-003. If cancellation is requested before a destructive step begins, the Installer SHALL stop before performing that step.

FR-RUNCONTROL-004. If cancellation is requested during an atomic remote action, the Installer SHALL complete that action before stopping unless the backend supports safe interruption.

FR-RUNCONTROL-005. The Installer SHALL mark the session state as `cancel requested` until execution reaches a safe stop point.

### 15.2 Failure Reporting

FR-RUNCONTROL-006. On failure, the Installer SHALL report:

- failed phase;
- failed task;
- affected host or hosts;
- relevant error output;
- last successful checkpoint.

FR-RUNCONTROL-007. For bridge-mode installations, failure reporting SHALL identify the affected pile or piles where applicable.

### 15.3 Resume

FR-RUNCONTROL-008. The Installer SHALL support rerunning or resuming from a safe checkpoint when the backend and session state allow.

FR-RUNCONTROL-009. The Installer SHALL NOT advertise rollback or resume for a phase unless that behavior is implemented.

## 16. Reporting and Output Artifacts

FR-REPORTING-001. The Installer SHALL persist the effective installation configuration used for execution.

FR-REPORTING-002. The Installer SHALL persist the discovery snapshot, validation results, execution log, and final status report for each session.

FR-REPORTING-003. On successful completion, the Installer SHALL produce a completion report containing at minimum:

- cluster endpoints;
- cluster layout summary;
- selected security mode;
- created domain and database names;
- verification result summary;
- next-step operational guidance.

FR-REPORTING-004. When bridge mode is enabled, the completion report SHALL include the selected base storage topology, pile definitions, and bridge-specific verification summary.

FR-REPORTING-005. The Installer SHALL allow export of the effective installation specification for reuse in batch mode.

FR-REPORTING-006. The Installer SHALL store session metadata, discovery snapshots, validation results, execution history, and reports using a persistence mechanism suitable for the Copy-and-Use Deployment Model, including operation from local embedded storage on the Control Host.

## 17. REST API Requirements

FR-API-001. The Installer SHALL expose a documented REST API for all externally usable functions.

FR-API-002. The REST API SHALL cover at minimum:

- installation-session lifecycle management;
- discovery execution and retrieval of discovery results;
- configuration creation, import, update, retrieval, and export;
- validation execution and retrieval of validation results;
- execution start, progress retrieval, cancellation request, and status retrieval;
- access to logs, reports, and persisted artifacts;
- data needed for presets, supported options, and reference metadata in the UI.

FR-API-003. The REST API SHALL be documented in a human-readable overview and in a machine-readable contract suitable for client generation (for example OpenAPI 3.x).

FR-API-004. The Installer UI SHALL use the documented REST API for data retrieval and operations.

FR-API-004A. The Installer UI SHALL NOT rely on private backend-only interfaces for normal application behavior.

## 18. User Interface Requirements

FR-UI-001. The Installer UI SHALL be web-based.

FR-UI-002. The Installer UI SHALL support execution control, configuration input, validation feedback, and monitoring in one consistent interface.

FR-UI-003. The UI SHALL present destructive actions with explicit warning language and confirmation controls.

FR-UI-004. The UI SHALL distinguish clearly among required settings, recommended settings, and advanced settings.

FR-UI-005. The UI SHALL expose the same primary screens (Home, Configuration steps, Monitoring, Logs) to **Observer** identities in **both** **interactive** and **batch** Installation Modes, with read-only behavior and without configuration, confirmation-submission, or execution-control capabilities.

FR-UI-006. The UI SHALL provide filtering or grouping by host, phase, and severity in progress and log views.

FR-UI-007. The UI SHALL use distinct terminology for:

- installation mode (interactive vs batch, §2.5);
- configuration generation;
- base storage topology;
- bridge mode;
- cluster layout.

FR-UI-008. When bridge mode is enabled, the UI SHALL present pile-related settings and status explicitly instead of folding them into generic multi-datacenter wording.

FR-UI-009. The UI SHALL make **Operator** and **Observer** capabilities distinguishable.

FR-UI-009A. **Operator** SHALL have access to configuration inputs where permitted by Installation Mode (§2.5) and to confirmation controls that gate execution.

FR-UI-009B. **Observer** SHALL NOT have access to configuration inputs or confirmation controls reserved for **Operator** (FR-ACCESS-002, FR-ACCESS-003, FR-ACCESS-005).

### 18.1 Globalization Support

FR-I18N-001. All operator-facing messages shown in the Installer UI SHALL be loaded from language-dependent resource sets selected according to the language chosen by the user or operator context.

FR-I18N-002. If the selected language is unsupported, or if a required UI resource is unavailable for that language, the Installer SHALL use the English resource value as the fallback.

FR-I18N-003. UI language resources SHALL be loaded from supplied resource files.

FR-I18N-003A. UI language resources SHALL NOT be compiled into the Installer backend binary as the only supported source of localized text.

FR-I18N-004. REST API messages and log messages SHALL be written in English.

## 19. Usability and Installer Best Practices

FR-USABILITY-001. The Installer SHALL default to safe values where YDB documentation gives clear recommended defaults.

FR-USABILITY-002. The Installer SHALL follow the principle: discover first, validate early, destroy late.

FR-USABILITY-003. The Installer SHALL support a validation-only or dry-run mode that runs discovery and preflight checks without changing target systems.

FR-USABILITY-004. In interactive mode, the Installer SHALL autosave configuration drafts at appropriate intervals and on significant edits, consistent with FR-INTERACTIVE-004.

FR-USABILITY-005. The Installer SHALL minimize secret exposure in the UI, logs, exports, and troubleshooting output.

FR-USABILITY-006. The Installer SHALL explain blocking conditions and destructive risks in operator-oriented language, not backend jargon alone.

FR-USABILITY-007. Baseline installation and first-run setup of the Installer itself SHALL require only copying or unpacking the Installer onto a supported Control Host and supplying startup configuration plus local writable storage.

FR-USABILITY-007A. Baseline installation and first-run setup of the Installer itself SHALL NOT require provisioning separate infrastructure services before the Installer can be used.

## 20. Acceptance Criteria Summary

This specification is satisfied when the product can:

1. discover and present host and disk inventory before installation;
2. guide an operator through interactive configuration steps with validation and review;
3. execute the same plan from a batch specification while presenting batch-derived configuration through a pre-filled read-only configuration-step projection;
4. select **interactive** or **batch** Installation Mode at server startup per §2.5 (command line, with optional config as allowed there) and enforce **Operator** vs **Observer** behavior in both modes (§3);
5. expose a documented REST API for all Installer functions and consume that API from the UI;
6. install a YDB cluster in phases with visible progress;
7. support `block-4-2`, `mirror-3-dc`, `reduced mirror-3-dc`, and bridge-enabled cluster layouts;
8. reduce accidental disk destruction through discovery-based confirmation and explicit approval for destructive steps;
9. support cancellation and clear failure reporting;
10. produce reusable artifacts and a final installation report;
11. localize UI messages from external resource files with English fallback, while keeping REST API and log messages in English;
12. run in a copy-and-use deployment model without mandatory external infrastructure services for baseline operation; and
13. avoid mandatory dependence on existing Ansible- or Python-based automation by preferring direct reuse or embedding of `ydbops` capabilities.
