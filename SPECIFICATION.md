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

This specification draws on the following sources. The project SHALL maintain a reference index (URLs, release identifiers, or pinned repository revisions) and update it when upstream materials change in ways that affect the Installer's behavior.

- YDB manual deployment documentation;
- YDB Ansible deployment documentation;
- the `ydb-platform/ydb-ansible` repository: README, playbooks, and role behavior;
- the [`ydb-platform/ydb-ui-components`](https://github.com/ydb-platform/ydb-ui-components) repository for the UI component library;
- the [`ydb-platform/ydb-embedded-ui`](https://github.com/ydb-platform/ydb-embedded-ui) repository as the reference source of `ydb-ui-components` usage examples and integration patterns.

The content of those sources is referenced as it existed on **2026-03-28**, unless a later revision of this document states otherwise.

### 1.4 Definitions

- `Installer`: the application described by this specification.
- `Installation Session`: one persisted installer workflow instance, whether interactive or batch.
- `Operating System`, or `OS`: the software that manages hardware and provides common services for programs. YDB runs on Linux; in this document, `OS` means a supported Linux distribution unless another meaning is stated explicitly.
- `Discovery Snapshot`: immutable system inventory collected from target hosts for a given session.
- `Installation Mode`: how the Installer is operated: interactive or batch.
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

## 2. Product Overview

### 2.1 Product Goal

The Installer SHALL enable an operator to deploy YDB clusters safely and repeatably using either a guided web interface or a declarative batch specification, while respecting the principal operational steps and constraints documented for YDB.

### 2.2 Supported Scenarios

The Installer SHALL support at minimum:

- initial deployment of a YDB cluster;
- interactive guided installation;
- non-interactive batch installation;
- single-datacenter and multi-datacenter cluster layouts;
- bridge-mode layouts with synchronous writes across two or more piles;
- TLS-enabled and authentication-enabled deployments;
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

## 3. Actors and User Roles

### 3.1 Primary Actors

- `Operator`: configures and runs installation.
- `Administrator`: manages access to the Installer, secrets, and system-level policies.
- `Observer`: monitors an installation session without changing configuration.

### 3.2 Permissions

FR-ACCESS-001. The Installer SHALL support role-based access to installation sessions.

FR-ACCESS-002. The Installer SHALL prevent users without execution privileges from starting runs, approving destructive actions, cancelling runs, or resuming installation runs.

FR-ACCESS-003. The Installer SHALL grant users with observer privileges read-only monitoring access.

FR-ACCESS-004. The Installer SHALL provide administrative functions for managing Installer access, credentials bound to roles, and policies consistent with the Administrator role in §3.1.

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

FR-DISCOVERY-002. The Installer SHALL support target access through direct SSH and bastion-based SSH. SSH authentication SHALL support password-based and key-based methods, configurable globally with optional per-host overrides.

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

FR-DISCOVERY-007. The Installer SHALL present discovery results in human-readable form and SHALL expose the same information through the REST API or export in structured form suitable for automation.

### 5.3 Disk Discovery Requirements

FR-DISCOVERY-008. The Installer SHALL list discovered disks per host.

FR-DISCOVERY-009. The Installer SHALL distinguish, where possible, between:

- system disks;
- mounted data disks;
- empty or unpartitioned disks;
- disks with existing partition tables, including partition sizes and mount points when present;
- disks that appear to contain prior YDB-related data or labels.

FR-DISCOVERY-010. The Installer SHALL restrict disk selection for YDB use to devices present in the Discovery Snapshot unless Expert Override is enabled. When Expert Override is enabled, the Installer SHALL allow the operator to enter device identifiers manually, superseding discovery-derived choices, and SHALL surface the associated risk warnings.

## 6. Interactive Installation Mode

### 6.1 Guided Workflow

FR-INTERACTIVE-001. The Installer SHALL provide an interactive web-based wizard for installation setup.

FR-INTERACTIVE-002. The wizard SHALL present configuration steps in a logical order that follows the installation phases.

FR-INTERACTIVE-003. The wizard SHALL prefill fields from the Discovery Snapshot wherever possible.

FR-INTERACTIVE-004. The wizard SHALL persist unfinished configuration drafts and SHALL allow the operator to resume later; draft persistence SHALL meet the autosave requirements in FR-USABILITY-004.

### 6.2 Configuration Screens

FR-INTERACTIVE-005. The interactive workflow SHALL provide screens or equivalent UI sections for:

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

FR-INTERACTIVE-006. The interactive workflow SHALL validate user input before advancing to the next step.

### 6.3 Presets

FR-INTERACTIVE-007. The Installer SHALL provide predefined setup presets at minimum for:

- single-datacenter `block-4-2` production cluster;
- multi-datacenter `mirror-3-dc` production cluster;
- `reduced mirror-3-dc` cluster;
- bridge-mode cluster.

FR-INTERACTIVE-008. Presets SHALL populate recommended defaults without preventing the operator from editing them.

## 7. Batch Installation Mode

### 7.1 Batch Specification

FR-BATCH-001. The Installer SHALL support non-interactive execution from a declarative batch specification.

FR-BATCH-002. The batch specification format SHALL be YAML or JSON.

FR-BATCH-003. The batch specification SHALL cover all configuration areas needed for an installation equivalent to interactive mode.

FR-BATCH-004. The Installer SHALL validate the batch specification after load and before any destructive action.

### 7.2 Batch Execution Management

FR-BATCH-005. A batch installation run SHALL be visible and controllable through the same web UI used for interactive runs.

FR-BATCH-006. The Installer SHALL display live phase progress, logs, warnings, and failures for batch runs.

FR-BATCH-007. The Installer SHALL support starting a batch run from:

- an uploaded specification;
- a stored specification;
- a specification derived from a previous interactive session.

## 8. Cluster Layout and Storage Topology

### 8.1 Supported Cluster Layouts

FR-LAYOUT-001. The Installer SHALL support at minimum the following base storage topologies:

- single-datacenter `block-4-2`;
- multi-datacenter `mirror-3-dc`;
- `reduced mirror-3-dc`.

FR-LAYOUT-002. The Installer SHALL support a cluster layout with bridge mode enabled on top of a supported base storage topology.

FR-LAYOUT-003. The Installer SHALL model bridge mode as a distinct cluster-layout option and SHALL NOT present it as equivalent to a base storage topology.

FR-LAYOUT-004. For bridge mode, the Installer SHALL support configuration of two or more piles participating in synchronous write.

FR-LAYOUT-005. For bridge mode, the Installer SHALL allow piles to be mapped to data centers, availability zones, or other operator-defined failure domains.

FR-LAYOUT-006. The Installer SHALL require the operator to assign node roles and physical placement attributes required for the selected cluster layout.

FR-LAYOUT-007. The Installer SHALL support per-host location attributes including rack, data center, availability zone, and, when bridge mode is enabled, pile membership.

### 8.2 Node Roles

FR-LAYOUT-008. The Installer SHALL support assignment of hosts to run Storage Nodes, Compute Nodes, or both where the configuration allows.

FR-LAYOUT-009. The Installer SHALL support more than one Compute Node per host where configured.

FR-LAYOUT-010. The Installer SHALL support explicit Broker Node selection and SHALL provide recommended defaults when the operator does not choose Broker Nodes manually.

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

FR-LAYOUT-017. The Installer SHALL label bridge mode clearly as a multi-data-center cluster feature layered on the selected base storage topology.

## 9. Storage Configuration

### 9.1 Disk Selection

FR-STORAGE-001. The Installer SHALL allow the operator to assign selected discovered disks to YDB storage on a per-host basis.

FR-STORAGE-002. For selected unpartitioned disks, the Installer SHALL offer a partitioning scheme suitable for YDB before storage preparation begins.

FR-STORAGE-003. For selected unpartitioned disks, the Installer SHALL default to suggesting one YDB partition per disk unless the operator or preset chooses otherwise.

FR-STORAGE-004. If the selected base storage topology is `reduced mirror-3-dc` and fewer than three YDB disks are available on a host, the Installer SHALL suggest creating three YDB partitions per disk on that host.

FR-STORAGE-005. The Installer SHALL support per-disk or per-partition labeling required for YDB configuration generation.

FR-STORAGE-006. The Installer SHALL support specifying the effective disk type classification required by YDB configuration.

FR-STORAGE-007. The Installer SHALL group available disks for configuration purposes by media type (HDD, SSD, NVMe) and by size class: disks on the same host whose capacities differ by at most 10% MAY be placed in the same size class for grouping. Each group SHALL receive consistent type and kind characteristics in the generated YDB configuration.

FR-STORAGE-008. The Installer SHALL group hosts that share a similar disk layout so that a single host-configuration block can describe disks for all hosts in the group. The recommended partitioning scheme SHALL yield disk labels that reference analogous disks on different hosts in the group through the same label pattern.

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

FR-STORAGE-011. The Installer SHALL require explicit operator approval before any operation that can erase data, except in batch mode when **Auto Proceed** is enabled in the batch specification or Installer settings. Auto Proceed SHALL NOT disable blocking validation errors unless this document explicitly allows that for a given check.

FR-STORAGE-012. The approval step SHALL identify exactly which hosts, disks, and planned partitions are affected.

## 10. Security and Secrets

### 10.1 TLS Support

FR-SECURITY-001. The Installer web UI and REST API SHALL be served over TLS using either operator-supplied key and certificate material or an automatically generated self-signed certificate when the operator does not supply a certificate.

FR-SECURITY-002. The Installer SHALL support operator-provided TLS materials.

FR-SECURITY-003. The Installer SHALL support certificate generation managed within the installation workflow when the automation supports it. Certificate generation SHALL be a distinct step. Certificate parameters SHALL be configurable through operator-managed settings.

FR-SECURITY-004. The Installer SHALL validate that supplied TLS assets are structurally complete for the selected cluster layout and network model.

### 10.2 Authentication

FR-SECURITY-005. The Installer SHALL protect its UI and REST API with HTTP Basic authentication (or a successor scheme documented alongside the REST API). User identities SHALL map to the roles in §3.1. Initial credentials SHALL be supplied through Installer startup configuration. Administrative actions SHALL be available only to identities with Administrator privileges; execution privileges SHALL follow FR-ACCESS-002.

FR-SECURITY-006. The Installer SHALL support installation with YDB user authentication enabled.

FR-SECURITY-007. The Installer SHALL support capturing or importing the initial administrator credentials required for installation.

FR-SECURITY-008. The Installer SHALL prevent secrets from appearing in clear text in routine logs and progress views.

### 10.3 Secret Storage

FR-SECURITY-009. The Installer SHALL store secrets securely and separately from general session metadata.

FR-SECURITY-010. The Installer SHALL restrict secret visibility to authorized users.

## 11. Artifact and Version Management

FR-ARTIFACT-001. The Installer SHALL support the following artifact-source modes:

- download from the web by specifying component versions;
- local archive;
- local binaries.

FR-ARTIFACT-002. The Installer SHALL validate the chosen artifact source against the selected installation scenario and SHALL reject inconsistent combinations as blocking validation errors.

For FR-ARTIFACT-002, validation SHALL include at minimum:

- if the installation scenario is offline or isolated, the Installer SHALL reject artifact acquisition by direct web download unless an approved internal mirror or equivalent local source is configured;
- if the artifact source is `local archive`, the Installer SHALL verify that all required archive files are present and readable on the Control Host before execution starts;
- if the artifact source is `local binaries`, the Installer SHALL verify that all required binaries are present and readable on the Control Host before execution starts;
- if multiple installable components are selected, the Installer SHALL verify that the chosen artifact source supplies every required component for that scenario;
- if the chosen artifact source does not satisfy the scenario, the Installer SHALL present a corrective validation message that identifies missing or incompatible artifact inputs.

FR-ARTIFACT-003. The Installer SHALL allow offline or isolated installation when all required artifacts are supplied.

FR-ARTIFACT-004. The Installer SHALL support selecting YDB versions compatible with configuration V1 or configuration V2.

FR-ARTIFACT-005. The Installer SHALL detect or derive the effective configuration generation where possible and SHALL show it to the operator.

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

FR-EXECUTION-006. The Installer SHALL persist the result of storage initialization and SHALL show failure details in the UI.

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

FR-MONITORING-001. The Installer SHALL update execution progress in the web UI continuously during a run (for example via push notifications or polling at a short interval) so that the operator can track phase and task advancement without manual refresh as the sole mechanism.

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

FR-API-004. The Installer UI SHALL use the documented REST API for data retrieval and operations and SHALL NOT rely on private backend-only interfaces for normal application behavior.

## 18. User Interface Requirements

FR-UI-001. The Installer UI SHALL be web-based.

FR-UI-002. The Installer UI SHALL support execution control, configuration input, validation feedback, and monitoring in one consistent interface.

FR-UI-003. The UI SHALL present destructive actions with explicit warning language and confirmation controls.

FR-UI-004. The UI SHALL distinguish clearly among required settings, recommended settings, and advanced settings.

FR-UI-005. The UI SHALL support read-only monitoring views for observers.

FR-UI-006. The UI SHALL provide filtering or grouping by host, phase, and severity in progress and log views.

FR-UI-007. The UI SHALL use distinct terminology for:

- installation mode;
- configuration generation;
- base storage topology;
- bridge mode;
- cluster layout.

FR-UI-008. When bridge mode is enabled, the UI SHALL present pile-related settings and status explicitly instead of folding them into generic multi-data-center wording.

### 18.1 Globalization Support

FR-I18N-001. All operator-facing messages shown in the Installer UI SHALL be loaded from language-dependent resource sets selected according to the language chosen by the user or operator context.

FR-I18N-002. If the selected language is unsupported, or if a required UI resource is unavailable for that language, the Installer SHALL use the English resource value as the fallback.

FR-I18N-003. UI language resources SHALL be loaded from supplied resource files and SHALL NOT be compiled into the Installer backend binary as the only supported source of localized text.

FR-I18N-004. REST API messages and log messages SHALL be written in English.

## 19. Usability and Installer Best Practices

FR-USABILITY-001. The Installer SHALL default to safe values where YDB documentation gives clear recommended defaults.

FR-USABILITY-002. The Installer SHALL follow the principle: discover first, validate early, destroy late.

FR-USABILITY-003. The Installer SHALL support a validation-only or dry-run mode that runs discovery and preflight checks without changing target systems.

FR-USABILITY-004. In interactive mode, the Installer SHALL autosave configuration drafts at appropriate intervals and on significant edits, consistent with FR-INTERACTIVE-004.

FR-USABILITY-005. The Installer SHALL minimize secret exposure in the UI, logs, exports, and troubleshooting output.

FR-USABILITY-006. The Installer SHALL explain blocking conditions and destructive risks in operator-oriented language, not backend jargon alone.

## 20. Acceptance Criteria Summary

This specification is satisfied when the product can:

1. discover and present host and disk inventory before installation;
2. guide an operator through interactive installation with validation and review;
3. execute the same plan from a batch specification;
4. expose a documented REST API for all Installer functions and consume that API from the UI;
5. install a YDB cluster in phases with visible progress;
6. support `block-4-2`, `mirror-3-dc`, `reduced mirror-3-dc`, and bridge-enabled cluster layouts;
7. reduce accidental disk destruction through discovery-based confirmation and explicit approval for destructive steps;
8. support cancellation and clear failure reporting;
9. produce reusable artifacts and a final installation report;
10. localize UI messages from external resource files with English fallback, while keeping REST API and log messages in English.
