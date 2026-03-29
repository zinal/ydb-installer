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

This specification draws on YDB deployment documentation, the `ydb-platform/ydb-ansible` repository as a behavioral reference, the `ydbops` tool and source repository as a reusable-deployment reference, and the [`ydb-platform/ydb-ui-components`](https://github.com/ydb-platform/ydb-ui-components) and [`ydb-platform/ydb-embedded-ui`](https://github.com/ydb-platform/ydb-embedded-ui) repositories as UI references.

FR-DOC-001. The project SHALL maintain a reference index (URLs, release identifiers, or pinned repository revisions) and update it when upstream materials change in ways that affect the Installer's behavior.

Those sources are referenced as they existed on **2026-03-28**, unless a later revision states otherwise. Their inclusion does not imply a requirement to reuse `Ansible`-based or `Python`-based automation in the Installer implementation.

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
- `Control Host Administrator`: a person with OS-level administrative privileges on the Control Host who installs and runs the Installer process, manages startup configuration, and controls local secrets and files. This actor is outside the Installer UI/REST role model.
- `Target Host`: a host on which YDB is to be installed or configured.
- `Expert Override` (disk selection): an explicit mode that allows the operator to specify block device identifiers manually instead of choosing only from the Discovery Snapshot, subject to warnings and session reporting requirements in §16.
- `Auto Proceed`: a batch-mode option (declared in the batch specification or equivalent settings) that skips interactive confirmation for destructive steps while preflight validation and other blocking checks still apply unless this document states otherwise for that option.
- `Degraded Completion State`: a session outcome in which the operator explicitly accepts completion despite failed or incomplete verification checks; the Installer records which checks did not pass and the fact of operator acceptance.
- `Copy-and-Use Deployment Model`: a distribution and operating model in which the Installer can be copied or unpacked onto a single Control Host and used without mandatory external infrastructure services such as a separate database, workflow engine, message broker, or secret manager for baseline operation.

### 1.5 Specification structure

**`SPECIFICATION.md` (this document)** is the single **normative** requirements baseline: workflows, discovery, cluster layout, storage, security, artifacts, validation, execution, monitoring, cancellation, reporting, REST API, installation modes, roles, **web UI obligations** (`FR-INTERACTIVE-*`, `FR-UI-*`, `FR-I18N-*`), usability, and acceptance criteria.

**`SPECIFICATION_UI.md`** is a **UI implementation companion**: routes, per-step control inventories, Monitoring/Logs affordances, and interaction notes that **realize** the requirements here. It cites `FR-*` identifiers but does not introduce parallel SHALL statements.

When this document references “§6” or “§18”, it means those sections **in this file** unless another document is named explicitly.

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

The Installer is a long-running service whose **Installation Mode** is fixed when the process starts. Operators choose **interactive** or **batch** by passing documented command-line flags or arguments to the server executable together with the mandatory application configuration file.

FR-MODE-001. The Installer SHALL determine **interactive** or **batch** Installation Mode at **process startup** through **command-line invocation** of the server (flags or equivalent).

FR-MODE-001A. Startup parameters SHALL be readable from the mandatory application configuration file referenced by the command line or by an equally explicit startup contract documented for the product.

FR-MODE-001B. The Installation Mode SHALL NOT be changed at runtime for a running Installer process.

FR-MODE-002. A running Installer instance SHALL expose exactly one Installation Mode to all clients.

FR-MODE-002A. The REST API and web UI SHALL behave consistently with the active Installation Mode (§6 for configuration-step interaction, §7 for batch specification sourcing and execution).

FR-MODE-003. In **interactive** Installation Mode, session configuration SHALL be performed through interactive configuration steps (§6).

FR-MODE-003A. In **batch** Installation Mode, session configuration SHALL be sourced from the declarative batch specification (§7).

FR-MODE-003B. In **batch** Installation Mode, the web UI SHALL present the effective plan through the same configuration-step structure in non-editable form.

FR-MODE-003C. The UI SHALL NOT offer batch-mode configuration overrides.

## 3. Actors and User Roles

### 3.1 Primary Actors

- `Control Host Administrator`: OS-level actor who installs and operates the Installer process on the Control Host, including startup credential provisioning and runtime policy management outside the application session UI.
- `Operator`: authenticated application identity with **execution** privileges (see §3.2). Operator behavior across Installation Modes is defined in §2.5, §6, and §7.
- `Observer`: authenticated application identity with **read-only** privileges in **both** **interactive** and **batch** Installation Modes. Observer permissions are defined in §3.2 and related UI requirements.

### 3.2 Permissions

FR-ACCESS-001. The Installer SHALL support role-based access to installation sessions using the application roles **Operator** and **Observer**.

FR-ACCESS-002. The Installer SHALL prevent users without **Operator** (execution) privileges from starting runs, approving destructive actions, **submitting responses to confirmation prompts that gate execution**, cancelling runs, or resuming installation runs.

FR-ACCESS-003. The Installer SHALL grant users with **Observer** privileges read-only access to the same primary session screens used by **Operator** (Home, Configuration steps, Monitoring, Logs) in both interactive and batch Installation Modes for viewing monitoring, session metadata, and progress.

FR-ACCESS-003A. **Observer** SHALL NOT modify configuration.

FR-ACCESS-003B. **Observer** SHALL NOT submit confirmation responses.

FR-ACCESS-003C. **Observer** SHALL NOT invoke execution-control actions reserved for **Operator**.

FR-ACCESS-004. The Installer SHALL support initialization and reset of **Operator** and **Observer** credentials through startup configuration controlled by the **Control Host Administrator**.

FR-ACCESS-004A. Credential initialization or reset MAY require editing startup configuration and restarting the Installer process; the baseline product SHALL NOT require an in-application Administrator role for this function.

FR-ACCESS-004B. The product documentation SHALL describe the operating procedure for the **Control Host Administrator** to provision or rotate **Operator** and **Observer** credentials.

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

The workflow-to-UI mapping for interactive and batch views appears in **SPECIFICATION_UI.md** §2.

## 5. Discovery and Reference Information Collection

### 5.1 Discovery Inputs

FR-DISCOVERY-001. The Installer SHALL allow the operator to define target hosts using hostnames or IP addresses and associated access parameters.

FR-DISCOVERY-002. The Installer SHALL support target access through direct SSH and bastion-based SSH.

FR-DISCOVERY-002A. SSH authentication SHALL support password-based and key-based methods.

FR-DISCOVERY-002B. SSH authentication settings SHALL be configurable globally with optional per-host overrides.

FR-DISCOVERY-002C. SSH TCP port SHALL be configurable in the global default profile and MAY be set per target when per-target SSH settings apply.

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

## 6. Web Application, Configuration Workflow, and Operator UI

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

The configuration-step sequence and transition rules appear in §6.5. Per-step controls appear in **SPECIFICATION_UI.md** §3. Monitoring and Logs presentation appears in **SPECIFICATION_UI.md** §4. In **batch** Installation Mode, the same structure presents a read-only projection of the effective batch configuration except for confirmation and run-control actions allowed elsewhere in this specification.

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

FR-INTERACTIVE-009B. The guided configuration-step flow SHALL provide the input controls identified in **SPECIFICATION_UI.md** §3 for each configuration step.

FR-INTERACTIVE-010. The Installer UI SHALL provide the application shell, Home session view, execution monitoring screen, and logs screen in all Installation Modes. Detailed layouts and controls for Monitoring and Logs appear in **SPECIFICATION_UI.md** §4.

FR-INTERACTIVE-010A. The Installer UI SHALL provide a configuration-step view described in §6.5–§6.7 that is editable in **interactive** mode and pre-filled/read-only in **batch** mode (FR-MODE-003, FR-BATCH-001, FR-ACCESS-005).

FR-INTERACTIVE-011. The web UI SHALL be organized as a single-page application with a persistent shell (header or sidebar) and routed views.

FR-INTERACTIVE-012. The screen set SHALL be the same for both **Operator** and **Observer**.

FR-INTERACTIVE-013. Role differences in the UI SHALL be implemented through control availability rather than through separate role-specific screens.

FR-INTERACTIVE-014. Home (`/`) SHALL be the authentication entry screen.

FR-INTERACTIVE-015. Home SHALL provide a role selector (`Operator` or `Observer`) and the credential entry required for that role, including password input when the authentication scheme uses passwords.

FR-INTERACTIVE-015A. Username input MAY be shown when the configured authentication scheme requires it. When the scheme does not require a username or equivalent identity field, the Home screen SHALL omit it.

FR-INTERACTIVE-016. Switching roles from an active session SHALL require re-authentication for the selected role, consistent with §10.2.

FR-INTERACTIVE-017. Navigation links for Home, Configuration, Monitoring, Logs, and Logout SHALL be available from every screen.

FR-INTERACTIVE-018. Opening Logs MAY use a dedicated browser window or tab.

FR-INTERACTIVE-018A. When Logs is opened in a dedicated browser window or tab, the current Configuration or Monitoring context SHALL remain intact in the originating window.

Detailed route, screen, and role-capability inventories appear in **SPECIFICATION_UI.md** §2. Draft retention in interactive mode follows FR-INTERACTIVE-004 and FR-INTERACTIVE-004A.

### 6.5 Interactive Configuration Steps: Expected Step Sequence and Transitions

FR-INTERACTIVE-019. The interactive configuration-step flow SHALL implement the following ordered steps.

FR-INTERACTIVE-020. Step identifiers SHALL be stable product labels.

FR-INTERACTIVE-021. The UI SHALL show configuration steps as tabs or breadcrumbs at the top of the screen, using readable labels.

FR-INTERACTIVE-021A. The step strip SHALL distinguish completed or satisfied steps from not-yet-reached steps using stable iconography, and selecting a completed step SHALL preserve its semantic completed state.

Stable step identifiers and English labels appear in **SPECIFICATION_UI.md** §3.

FR-INTERACTIVE-022. The default forward path SHALL advance in order as **1 → 2 → 3 → 4 → ... → 10 → 11**.

FR-INTERACTIVE-023. Back from any step SHALL return to the immediately previous step without discarding saved draft data unless the operator explicitly discards a session.

FR-INTERACTIVE-024. Transition from step 1 to step 2 SHALL be allowed only after the target list is saved and contains at least one valid target address.

FR-INTERACTIVE-024A. The UI SHOULD require an explicit commit of target edits before transition from step 1 to step 2 so that server state matches the form rather than relying on implicit autosave alone.

FR-INTERACTIVE-025. Running discovery SHALL require saved targets.

FR-INTERACTIVE-025A. Advancing from step 2 to step 3 after a successful discovery run SHOULD be automatic or one-click.

FR-INTERACTIVE-025B. The operator MAY open step 3 when a discovery snapshot already exists, for example after a refresh.

FR-INTERACTIVE-026. Transition from step 3 to step 4 SHALL be allowed once a discovery snapshot is available for review, even if some hosts failed discovery as allowed by FR-DISCOVERY-004.

FR-INTERACTIVE-026A. The operator SHALL acknowledge discovery results before proceeding from step 3 to step 4 through an explicit acknowledgment control or an equivalent explicit continue action that records the acknowledgment.

FR-INTERACTIVE-027. Forward navigation through steps 4 to 9 SHALL run step validation before leaving a step that has required fields (FR-INTERACTIVE-006).

FR-INTERACTIVE-028. Entering Review & approval at step 10 SHALL require completion of preflight validation with no blocking errors (FR-VALIDATION-001, FR-VALIDATION-008).

FR-INTERACTIVE-028A. The UI MAY trigger the required preflight validation automatically when leaving step 9 or through an equivalent explicit pre-review action.

FR-INTERACTIVE-029. Starting execution from step 10 SHALL require explicit approval for destructive scope (§9.2, FR-STORAGE-011).

FR-INTERACTIVE-029A. After execution starts, the UI SHALL transition to step 11 to show current run state and any confirmation requests that gate progress.

FR-INTERACTIVE-030. The operator MAY switch to Monitoring or Logs while on step 11 at any time.

FR-INTERACTIVE-030A. Returning to step 11 SHALL preserve the latest run-state and confirmation-request context.

FR-INTERACTIVE-031. The operator MAY open Monitoring or Home while configuration is incomplete.

FR-INTERACTIVE-031A. The step strip SHOULD reflect persisted progress when returning to `/configuration`, including furthest-step progress retained in browser session storage keyed to the installation session where needed so success markers survive reload or remount.

FR-INTERACTIVE-031B. The `/configuration` URL SHALL carry the active step index in a query parameter kept in sync with navigation so the address bar reflects the current step and deep links can be shared.

FR-INTERACTIVE-031C. When the web UI is served from the Installer’s embedded static files, HTTP GET requests for client-routed paths that are not static assets under the UI mount SHALL be served the SPA entry document so browser reload does not return `404 Not Found`.


### 6.6 Configuration step forms: control inventories

Per-step control inventories (field types, grouping, and semantics) appear in **SPECIFICATION_UI.md** §3 and satisfy FR-INTERACTIVE-009B.

### 6.7 Batch-mode configuration presentation

In **batch** Installation Mode, the UI uses the same `/configuration` route and step structure as §6.5 to present the effective batch configuration in read-only form, with only the confirmation and run-control actions allowed elsewhere in this specification. Detailed UI presentation appears in **SPECIFICATION_UI.md** §5.

### 6.8 Monitoring and Logs views

Detailed **presentation** for the execution monitoring screen and the dedicated logs screen—including control inventories, filtering affordances, and navigation patterns—is specified in **SPECIFICATION_UI.md** §4, implementing FR-MONITORING-001–FR-MONITORING-005, FR-MONITORING-006, FR-RUNCONTROL-001, FR-RUNCONTROL-008, FR-SECURITY-008, FR-USABILITY-005, and FR-UI-006 as applicable.


## 7. Batch Installation Mode

### 7.1 Batch Specification

FR-BATCH-001. When the Installer runs in **batch** Installation Mode (FR-MODE-001, §2.5), the Installer SHALL execute from a declarative batch specification as the source of session configuration.

FR-BATCH-001A. In **batch** Installation Mode, the web UI SHALL present the effective configuration through the pre-filled configuration-step projection in §6.7 without permitting configuration edits for the running session.

FR-BATCH-002. The batch specification format SHALL be YAML or JSON.

FR-BATCH-003. The batch specification SHALL cover all configuration areas needed for an installation equivalent to interactive mode.

FR-BATCH-004. The Installer SHALL validate the batch specification after load and before any destructive action.

### 7.2 Batch Execution Management

FR-BATCH-005. A batch installation run SHALL be visible through the shared UI defined in §6.

FR-BATCH-005A. Authorized users SHALL be able to monitor and control a batch run through those shared views where this specification allows.

FR-BATCH-005B. Batch runs SHALL use the shared Home, Configuration, Monitoring, and Logs views, with Configuration read-only except where this specification explicitly allows otherwise.

FR-BATCH-006. Those shared views SHALL display live phase progress, logs, warnings, and failures for batch runs.

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

FR-SECURITY-005A. Authenticated application identities SHALL map only to the **Operator** and **Observer** roles in §3.1.

FR-SECURITY-005B. Operator and Observer credentials for UI and REST API access SHALL be supplied through the mandatory application configuration file used at startup.

FR-SECURITY-005C. Installation Mode (interactive vs batch) SHALL be selected only at process startup (FR-MODE-001).

FR-SECURITY-005CA. Installation Mode SHALL be independent of authenticated role.

FR-SECURITY-005D. **Operator** and **Observer** identities SHALL be available in both Installation Modes, subject to §3.2.

FR-SECURITY-005E. The Installer SHALL NOT require a separate authenticated Administrator application identity for UI or REST API authorization.

FR-SECURITY-005F. Execution privileges SHALL follow FR-ACCESS-002.

FR-SECURITY-006. The Installer SHALL support installation with YDB user authentication enabled.

FR-SECURITY-007. When YDB user authentication is enabled, the Installer SHALL support capturing or importing the initial YDB administrator credentials required for cluster installation.

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

FR-EXECUTION-014A. Accepting a **Degraded Completion State** SHALL require an explicit action by an authorized **Operator** after the Installer presents the failed or incomplete verification checks that would otherwise prevent ordinary completion.

FR-EXECUTION-014B. The Installer SHALL record the accepting identity, timestamp, and accepted verification exceptions for a **Degraded Completion State** and include them in the final session report.

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

FR-RUNCONTROL-001. The Installer SHALL allow an authorized user with operator privileges to request cancellation of a running session from the web UI and the documented REST API.

FR-RUNCONTROL-001A. Cancellation requests issued through the web UI and REST API SHALL apply the same authorization rules, state transitions, and safety semantics.

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

FR-RUNCONTROL-008. The Installer SHALL support rerunning or resuming from a safe checkpoint through documented web UI controls and REST API operations when the backend and session state allow.

FR-RUNCONTROL-008A. Before rerun or resume is invoked, the Installer SHALL present whether the session is eligible, the checkpoint or rerun scope to be used, and any unavailable-state reason when rerun or resume is not currently allowed.

FR-RUNCONTROL-009. The Installer SHALL NOT advertise rollback or resume for a phase unless that behavior is implemented.

## 16. Reporting and Output Artifacts

FR-REPORTING-001. The Installer SHALL persist the effective installation configuration used for execution.

FR-REPORTING-002. The Installer SHALL persist the discovery snapshot, validation results, execution log, and final status report for each session.

FR-REPORTING-002A. When **Expert Override** is used for disk selection, the Installer SHALL persist the manually entered device identifiers, the associated warnings shown to the operator, the acting identity, and the timestamp as part of the session record.

FR-REPORTING-002B. When a session completes in **Degraded Completion State**, the final status report SHALL identify the accepted verification exceptions together with the accepting identity and timestamp.

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

FR-API-001. The Installer SHALL expose a documented REST API for all client-visible externally usable functions.

FR-API-002. The REST API SHALL cover at minimum:

- installation-session lifecycle management;
- discovery execution and retrieval of discovery results;
- configuration creation, import, update, retrieval, and export;
- validation execution and retrieval of validation results, including validation-only or dry-run invocation required by FR-USABILITY-003;
- execution start, progress retrieval, cancellation request, rerun or resume request, and status retrieval;
- authentication/session operations for **Operator** and **Observer** access, consistent with §10.2 and FR-ACCESS-004;
- access to logs, reports, and persisted artifacts;
- data needed for presets, supported options, and reference metadata in the UI.

FR-API-003. The REST API SHALL be documented in a human-readable overview and in a machine-readable contract suitable for client generation (for example OpenAPI 3.x).

FR-API-003A. The API contract SHALL identify the required authorization role for each operation and whether the operation is available in interactive mode, batch mode, or both where that distinction affects behavior.

FR-API-004. The Installer UI SHALL use the documented REST API for data retrieval and operations.

FR-API-004A. The Installer UI SHALL NOT rely on private backend-only interfaces for normal application behavior.

## 18. Global, Visual, and Localization Requirements for the Web UI

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

### 18.1 Visual Design and Layout

FR-UI-010. The Installer UI visual design SHALL align with the YDB UI ecosystem, using `ydb-platform/ydb-ui-components` and `ydb-platform/ydb-embedded-ui` as the primary references.

FR-UI-010A. The Installer UI SHALL use the same or compatible default color palette and font families as the referenced YDB UI patterns unless a documented product-specific exception requires otherwise.

FR-UI-010B. Installer-specific styling SHALL remain consistent with the referenced YDB UI visual language and SHALL NOT create a conflicting design system within the product.

FR-UI-011. The UI SHALL prefer theme variables, design tokens, and reusable component styles over ad hoc hard-coded styling where equivalent reusable styling exists.

FR-UI-012. The primary Installer workflows SHALL remain usable on typical laptop and smaller supported viewports without relying on large-screen-only compositions.

FR-UI-012A. Compact layouts for Home, Configuration, Monitoring, and Logs SHALL avoid unnecessary horizontal scrolling, overlapping controls, and clipped primary actions.

FR-UI-012B. Compact presentation SHALL reduce unnecessary whitespace and oversized chrome while preserving clear separation of navigation, forms, status, and destructive actions.

FR-UI-013. The layout SHALL use additional width on larger screens for denser tables, side-by-side panels, broader summaries, or richer monitoring views when that improves operator efficiency.

FR-UI-013A. Larger-screen expansion SHALL preserve the same navigation model and information hierarchy used on smaller screens and SHALL NOT rely on stretched controls or empty filler space as the primary use of additional width.

FR-UI-014. The UI SHALL support responsive or adaptive layout behavior across supported screen sizes.

FR-UI-015. For step-based configuration and execution screens, the UI SHALL prioritize keeping the current step context, primary actions, and critical warnings easy to locate without excessive scrolling.

### 18.2 Globalization Support

FR-I18N-001. All operator-facing messages shown in the Installer UI SHALL be loaded from language-dependent resource sets selected according to the language chosen by the user or operator context.

FR-I18N-002. If the selected language is unsupported, or if a required UI resource is unavailable for that language, the Installer SHALL use the English resource value as the fallback.

FR-I18N-003. UI language resources SHALL be loaded from supplied resource files.

FR-I18N-003A. UI language resources SHALL NOT be compiled into the Installer backend binary as the only supported source of localized text.

FR-I18N-004. REST API messages and log messages SHALL be written in English.


## 19. Usability and Installer Best Practices

FR-USABILITY-001. The Installer SHALL default to safe values where YDB documentation gives clear recommended defaults.

FR-USABILITY-002. The Installer SHALL follow the principle: discover first, validate early, destroy late.

FR-USABILITY-003. The Installer SHALL support a validation-only or dry-run mode that runs discovery and preflight checks without changing target systems.

FR-USABILITY-003A. Validation-only or dry-run SHALL be invocable through documented startup or REST API mechanisms and SHALL create or update an installation session with persisted discovery and validation outputs.

FR-USABILITY-003B. Validation-only or dry-run MAY perform the read-only remote inspection needed for discovery and preflight checks, but SHALL NOT start host preparation, artifact deployment, disk modification, storage initialization, database creation, or Compute Node startup.

FR-USABILITY-003C. The resulting session status and report SHALL state that the run was validation-only or dry-run and that no target-system changes were requested by the Installer.

FR-USABILITY-004. In interactive mode, the Installer SHALL autosave configuration drafts at appropriate intervals and on significant edits, consistent with FR-INTERACTIVE-004.

FR-USABILITY-005. The Installer SHALL minimize secret exposure in the UI, logs, exports, and troubleshooting output.

FR-USABILITY-006. The Installer SHALL explain blocking conditions and destructive risks in operator-oriented language, not backend jargon alone.

FR-USABILITY-007. Baseline installation and first-run setup of the Installer itself SHALL require only copying or unpacking the Installer onto a supported Control Host, supplying startup configuration, and providing local writable storage.

FR-USABILITY-007A. Baseline installation and first-run setup SHALL NOT require provisioning separate infrastructure services before the Installer can be used.

## 20. Acceptance Criteria Summary

This specification is satisfied when the product can:

1. select **interactive** or **batch** Installation Mode at startup and enforce the role model defined in §2.5 and §3;
2. discover inventory, guide interactive configuration, and execute equivalent batch-defined plans (§5-§7);
3. validate before destructive execution and preserve the discovery-first, destroy-late safety model (§4, §9, §12, §19);
4. install supported layouts in ordered phases with visible progress, logs, failure reporting, and eligible rerun or resume behavior (§8, §13-§15);
5. expose a documented REST API for client-visible Installer functions and consume that API from the UI (§17);
6. produce persisted session records, reusable artifacts, and final reports (§16);
7. provide a web UI aligned with YDB UI patterns, role-aware controls, and externalized localization resources (§6, §18); and
8. operate in the Copy-and-Use baseline without mandatory external infrastructure or mandatory Ansible/Python execution paths (§2.4, §19).
