# YDB Installer Specification

## 1. Document Control

### 1.1 Purpose

This document defines the specification for a web-based YDB installer application supporting interactive and batch installation of YDB clusters on bare-metal or virtual-machine infrastructure.

### 1.2 Scope

The application covers:

- collection of reference information about target systems before installation;
- configuration of YDB cluster layout, storage, security, and deployment parameters;
- orchestration of installation phases on remote hosts;
- progress monitoring, validation, cancellation, and reporting through a web UI.

The application does not define low-level implementation details of the automation backend beyond functional behavior.

### 1.3 Source Basis

This specification is based on:

- YDB manual deployment documentation;
- YDB Ansible deployment documentation;
- `ydb-platform/ydb-ansible` README, playbooks, and role behavior.

All the materials listed above were used as they were at 2025-03-28.

### 1.4 Definitions

- `Installer`: the application described by this specification.
- `Installation Session`: one persisted installer workflow instance, interactive or batch.
- `Operating System`, or `OS`: the foundational software that manages computer hardware, software resources, and provides common services for computer programs. YDB runs on Linux, so OS in the context of this document typically means some supported flavor of Linux, unless stated otherwise explicitly.
- `Discovery Snapshot`: immutable system inventory collected from target hosts for a given session.
- `Installation Mode`: the way the Installer is operated, either interactive or batch.
- `Configuration Generation`: the YDB configuration-management generation used for deployment, such as configuration V1 or configuration V2.
- `Base Storage Topology`: the YDB distributed-storage topology used within a cluster or within a bridge pile, such as `block-4-2`, `mirror-3-dc`, or `reduced mirror-3-dc`.
- `Bridge Mode`: a cluster layout in which synchronous replication is configured between two or more piles, each pile using a supported base storage topology.
- `Pile`: a bridge-mode subdivision of a cluster, typically aligned with a data center or availability-zone group.
- `Cluster Layout`: the overall cluster arrangement, consisting of host placement, node roles, the selected base storage topology, and optionally bridge mode.
- `Storage Node`: a YDB cluster process responsible for storage-layer functions. In YDB documentation this process is often referenced as a `Static Node`. A Storage Node is not a host, server, or virtual machine; it is an OS process running on a host as part of a YDB cluster.
- `Compute Node`: a YDB cluster process responsible for database-serving and compute functions. In YDB documentation this process is often referenced as a `Dynamic Node`. A Compute Node is not a host, server, or virtual machine; it is an OS process running on a host as part of a YDB cluster.
- `Control Host`: the environment from which automation is executed.
- `Target Host`: a host on which YDB is to be installed or configured.

## 2. Product Overview

### 2.1 Product Goal

The Installer shall enable an operator to deploy YDB clusters safely and repeatably using a guided web interface or a declarative batch specification, while preserving the major operational steps and constraints documented by YDB.

### 2.2 Supported Scenarios

The Installer shall support at minimum:

- initial deployment of a YDB cluster;
- interactive guided installation;
- non-interactive batch installation;
- single-datacenter and multi-datacenter cluster layouts;
- bridge-mode cluster layouts with synchronous write across two or more piles;
- TLS-enabled and authentication-enabled deployments;
- offline or restricted-network deployment scenarios, subject to provided artifacts.

### 2.3 Out of Scope

The following are outside the mandatory scope of this document unless explicitly added in a future revision:

- automated cluster scaling after initial deployment;
- migration between YDB configuration V1 and V2;
- automated rollback of partially completed installations;
- full lifecycle operations unrelated to installation, such as routine upgrades and reconfiguration.

## 3. Actors and User Roles

### 3.1 Primary Actors

- `Operator`: configures and executes installation.
- `Administrator`: manages installer access, secrets, and system-level policies.
- `Observer`: monitors an installation session without changing configuration.

### 3.2 Permissions

FR-ACCESS-001. The Installer shall support role-based access to installation sessions.

FR-ACCESS-002. The Installer shall prevent users without execution privileges from starting, approving destructive actions, cancelling, or resuming installation runs.

FR-ACCESS-003. The Installer shall allow read-only monitoring access for users with observer privileges.

## 4. High-Level Workflow

### 4.1 Installation Phases

FR-WORKFLOW-001. The Installer shall execute installation as an ordered sequence of named phases.

FR-WORKFLOW-002. The Installer shall implement at least the following phases:

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

FR-WORKFLOW-003. The Installer shall persist phase state for each installation session.

FR-WORKFLOW-004. The Installer shall expose current phase, phase result, and phase timestamps in the web UI.

### 4.2 Discovery-First Rule

FR-WORKFLOW-005. The Installer shall require a dedicated discovery phase before destructive installation steps are allowed.

FR-WORKFLOW-006. The Installer shall use the Discovery Snapshot as the default reference source for cluster-layout planning and disk-selection workflows.

FR-WORKFLOW-007. The Installer shall not permit disk formatting, repartitioning, or storage initialization until discovery, configuration input or import, and validation have completed successfully.

## 5. Discovery and Reference Information Collection

### 5.1 Discovery Inputs

FR-DISCOVERY-001. The Installer shall allow the operator to define target hosts using hostnames or IP addresses and associated access parameters.

FR-DISCOVERY-002. The Installer shall support target access through direct SSH and bastion-based SSH. SSH authentication should support both password-based and key-based access, which should be configurable for all hosts overall (global settings) and allow per-host overrides (per-host optional settings).

### 5.2 Discovery Outputs

FR-DISCOVERY-003. The Installer shall collect the following information from each target host:

- hostname;
- FQDN if resolvable;
- operating system and version;
- CPU count;
- memory size;
- network addresses and interfaces;
- time synchronization indicators;
- tcp ports state relevant to installation;
- block device inventory, including disk size and type information;
- existing partitions, labels, filesystems, and mount points;
- likely system disk indicators.

FR-DISCOVERY-004. The Installer shall record discovery failures per host without discarding successful data collected from other hosts.

FR-DISCOVERY-005. The Installer shall persist the discovery results as a Discovery Snapshot tied to the installation session.

FR-DISCOVERY-006. The Installer shall allow the operator to refresh discovery data before execution.

FR-DISCOVERY-007. The Installer shall display discovery results in a human-readable and machine-consumable form.

### 5.3 Disk Discovery Requirements

FR-DISCOVERY-008. The Installer shall present discovered disks individually per host.

FR-DISCOVERY-009. The Installer shall distinguish, where possible, between:

- system disks;
- mounted data disks;
- empty or unpartitioned disks;
- disks with existing partition tables, including the partition sizes and mount points, if present;
- disks that appear to contain prior YDB-related data or labels.

FR-DISCOVERY-010. The Installer shall allow the operator to select discovered disks for YDB use from the discovery results ONLY unless an explicit expert override is enabled. With the expert override the installer should allow to manually enter the actual device names to be used, overriding those identified by the discovery.

## 6. Interactive Installation Mode

### 6.1 Guided Workflow

FR-INTERACTIVE-001. The Installer shall provide an interactive web-based wizard for installation setup.

FR-INTERACTIVE-002. The wizard shall present configuration steps in a logical order following the installation phases.

FR-INTERACTIVE-003. The wizard shall prefill fields from the Discovery Snapshot wherever possible.

FR-INTERACTIVE-004. The wizard shall support saving an unfinished configuration draft and resuming it later.

### 6.2 Configuration Screens

FR-INTERACTIVE-005. The interactive workflow shall provide screens or equivalent UI sections for:

- target host selection;
- authentication settings and overrides;
- discovery results review;
- cluster-layout and role assignment;
- disk selection and storage mapping;
- network and endpoint settings;
- security and TLS settings;
- YDB version and artifact source;
- database settings;
- review and approval.

FR-INTERACTIVE-006. The interactive workflow shall provide inline validation of user input before allowing progression to the next step.

### 6.3 Presets

FR-INTERACTIVE-007. The Installer shall provide predefined setup presets at minimum for:

- single-datacenter `block-4-2` production cluster;
- multi-datacenter `mirror-3-dc` production cluster;
- `reduced mirror-3-dc` cluster;
- bridge-mode cluster.

FR-INTERACTIVE-008. Presets shall populate recommended defaults without preventing the operator from editing them.

## 7. Batch Installation Mode

### 7.1 Batch Specification

FR-BATCH-001. The Installer shall support non-interactive execution from a declarative batch specification.

FR-BATCH-002. The batch specification format shall be YAML or JSON.

FR-BATCH-003. The batch specification shall support all configuration areas necessary to perform an installation equivalent to interactive mode.

FR-BATCH-004. The Installer shall validate the batch specification after it has been loaded and before starting any destructive action.

### 7.2 Batch Execution Management

FR-BATCH-005. A batch installation run shall be visible and controllable through the same web UI used for interactive runs.

FR-BATCH-006. The Installer shall display live phase progress, logs, warnings, and failures for batch runs.

FR-BATCH-007. The Installer shall support starting a batch run from:

- an uploaded specification;
- a stored specification;
- a specification derived from a previous interactive session.

## 8. Cluster Layout and Storage Topology

### 8.1 Supported Cluster Layouts

FR-LAYOUT-001. The Installer shall support at minimum the following base storage topologies:

- single-datacenter `block-4-2`;
- multi-datacenter `mirror-3-dc`;
- `reduced mirror-3-dc`.

FR-LAYOUT-002. The Installer shall support a cluster layout with bridge mode enabled on top of a supported base storage topology.

FR-LAYOUT-003. The Installer shall model bridge mode as a distinct cluster-layout option and shall not present it as equivalent to a base storage topology.

FR-LAYOUT-004. For bridge mode, the Installer shall support configuration of two or more piles participating in synchronous write.

FR-LAYOUT-005. For bridge mode, the Installer shall allow piles to be mapped to data centers, availability zones, or other operator-defined failure domains.

FR-LAYOUT-006. The Installer shall require the operator to assign node roles and physical placement attributes necessary for the selected cluster layout.

FR-LAYOUT-007. The Installer shall support configuration of per-host location attributes including rack, data center, availability zone, and, when bridge mode is enabled, pile membership.

### 8.2 Node Roles

FR-LAYOUT-008. The Installer shall support assignment of hosts to run Storage Nodes, Compute Nodes, or both where allowed by the configuration.

FR-LAYOUT-009. The Installer shall support configuration of one or more Compute Nodes per host.

FR-LAYOUT-010. The Installer shall support explicit broker selection and also support recommended defaults when broker nodes are not manually chosen.

### 8.3 Network Models

FR-LAYOUT-011. The Installer shall support a standard single-network deployment model.

FR-LAYOUT-012. The Installer shall support separated front-end and back-end network configuration.

FR-LAYOUT-013. When separated networks are used, the Installer shall allow independent configuration of:

- front-end FQDN for client access;
- back-end FQDN for intra-cluster communication.

### 8.4 Bridge-Mode-Specific Planning

FR-LAYOUT-014. When bridge mode is enabled, the Installer shall provide UI controls for defining piles and assigning hosts to piles.

FR-LAYOUT-015. When bridge mode is enabled, the Installer shall support a bridge layout spanning two or more availability zones or data centers participating in synchronous write.

FR-LAYOUT-016. When bridge mode is enabled, the Installer shall present the relationship between:

- the overall cluster layout;
- the selected base storage topology used inside each pile;
- synchronous replication across piles.

FR-LAYOUT-017. The Installer shall clearly label bridge mode as a multi-data-center cluster layout feature layered above the selected base storage topology.

## 9. Storage Configuration

### 9.1 Disk Selection

FR-STORAGE-001. The Installer shall allow the operator to assign selected discovered disks to YDB storage use on a per-host basis.

FR-STORAGE-002. For selected unpartitioned disks, the Installer shall offer a partitioning scheme suitable for YDB use before storage preparation begins.

FR-STORAGE-003. For selected unpartitioned disks, the Installer shall normally suggest creating one YDB partition per disk.

FR-STORAGE-004. If the selected base storage topology is `reduced mirror-3-dc` and fewer than three YDB disks are available on a host, the Installer shall suggest creating three YDB partitions per disk on that host.

FR-STORAGE-005. The Installer shall support per-disk or per-partition labeling required for YDB configuration generation.

FR-STORAGE-006. The Installer shall support specifying the effective disk type classification required by YDB configuration.

FR-STORAGE-007. The Installer shall group the available disks by type (HDD, SSD, NVMe) and size (assuming that disk sizes are the same if they differ no more than `10%`). Those disk groups should be assigned same characteristics (type, kind) in the YDB configuration.

FR-STORAGE-008. The Installer shall group the hosts with similar disk layout, to allow the use of a single "host configuration" block to define all the disks for such hosts. The recommended partitioning scheme shall ensure that disk labels are built in a way allowing to reference similar disks on different hosts in a group through the same disk label.

### 9.2 Storage Safety

FR-STORAGE-009. The Installer shall detect and warn about selected disks that appear to be:

- mounted;
- in use by the operating system;
- already partitioned;
- below recommended capacity;
- likely to contain existing data.

FR-STORAGE-010. The Installer shall clearly distinguish between:

- disks suitable for production use;
- disks suitable for reduced-capacity or non-production use only;
- disks that should not be used without override.

FR-STORAGE-011. The Installer shall require explicit operator approval before any operation that can erase data, except when running in the batch mode with the "auto proceed" switch activated in the settings.

FR-STORAGE-012. The approval step shall identify exactly which hosts, disks, and planned partitions will be affected.

## 10. Security and Secrets

### 10.1 TLS Support

FR-SECURITY-001. The Installer shall support operator-provided TLS materials.

FR-SECURITY-002. The Installer shall support installer-managed certificate generation where that behavior is supported by the chosen backend workflow.

FR-SECURITY-003. The Installer shall validate that provided TLS assets are structurally complete for the selected cluster layout and network model.

### 10.2 Authentication

FR-SECURITY-004. The Installer shall support installation with YDB user authentication enabled.

FR-SECURITY-005. The Installer shall support capturing or importing the initial administrator credentials required for installation.

FR-SECURITY-006. The Installer shall prevent secrets from being displayed in clear text in routine logs and progress views.

### 10.3 Secret Storage

FR-SECURITY-007. The Installer shall store secrets securely and separately from general session metadata.

FR-SECURITY-008. The Installer shall restrict secret visibility to authorized users only.

## 11. Artifact and Version Management

FR-ARTIFACT-001. The Installer shall support the following artifact-source modes:

- download by YDB version;
- local archive;
- local binaries.

FR-ARTIFACT-002. The Installer shall validate that the chosen artifact source is consistent with the selected installation scenario.

FR-ARTIFACT-003. The Installer shall allow offline or isolated installation if all required artifacts are supplied.

FR-ARTIFACT-004. The Installer shall support selection of YDB versions compatible with either configuration V1 or configuration V2.

FR-ARTIFACT-005. The Installer shall detect or derive the effective configuration generation where possible and surface it to the operator.

FR-ARTIFACT-006. The Installer shall validate whether the selected YDB edition and version support the requested cluster layout, including bridge mode where applicable.

## 12. Validation and Preflight Checks

### 12.1 General Validation

FR-VALIDATION-001. The Installer shall perform preflight validation after configuration input or import and before review and approval for execution.

FR-VALIDATION-002. The preflight validation shall validate both:

- that the configuration is internally correct and complete;
- that the configuration matches the Discovery Snapshot or any explicitly accepted deviations.

FR-VALIDATION-003. The Installer shall classify validation results as:

- blocking error;
- warning;
- informational notice.

FR-VALIDATION-004. The Installer shall present validation results per host and for the overall cluster configuration.

### 12.2 Required Checks

FR-VALIDATION-005. The preflight validation shall include at minimum checks for:

- SSH connectivity;
- privilege escalation viability;
- required OS characteristics;
- `systemd` availability;
- required automation prerequisites;
- host reachability;
- configuration completeness and correctness;
- consistency between configured hosts, roles, disks, locations, and endpoints;
- consistency between the entered or imported configuration and the Discovery Snapshot;
- cluster-layout consistency;
- base storage topology consistency;
- disk mapping consistency;
- certificate completeness when TLS is enabled;
- compatibility between selected YDB version, selected YDB edition, selected cluster layout, and selected configuration generation.

FR-VALIDATION-006. The Installer shall validate that bridge mode, when selected, is configured with at least two piles and that each pile has the required host assignments.

FR-VALIDATION-007. The Installer shall warn if the planned cluster layout does not satisfy documented production recommendations for the selected base storage topology or bridge layout.

FR-VALIDATION-008. The Installer shall prevent execution from proceeding while blocking errors remain unresolved.

## 13. Execution Engine Behavior

### 13.1 Host Preparation

FR-EXECUTION-001. The Installer shall prepare hosts according to the selected installation plan, including prerequisite packages, system settings, and YDB runtime user preparation.

FR-EXECUTION-002. The Installer shall copy required binaries, libraries, configuration files, and certificates to the appropriate target hosts.

### 13.2 Storage Nodes

FR-EXECUTION-003. The Installer shall install and start Storage Nodes before attempting storage initialization.

FR-EXECUTION-004. The Installer shall wait for Storage Nodes to reach the required readiness level before continuing.

### 13.3 Storage Initialization

FR-EXECUTION-005. The Installer shall initialize YDB storage only after Storage Node readiness checks have passed.

FR-EXECUTION-006. The Installer shall persist the result of storage initialization and expose any failure details in the UI.

FR-EXECUTION-007. When bridge mode is enabled, the Installer shall execute bridge-specific configuration steps in an order consistent with the selected base storage topology and pile layout.

FR-EXECUTION-008. When bridge mode is enabled, the Installer shall expose bridge-specific progress and failure details separately from ordinary storage-initialization steps.

### 13.4 Database and Compute Nodes

FR-EXECUTION-009. The Installer shall create the configured initial database before starting Compute Nodes that serve it.

FR-EXECUTION-010. The Installer shall install and start Compute Nodes after successful database creation.

FR-EXECUTION-011. The Installer shall support creation and activation of more than one Compute Node service per host where configured.

### 13.5 Verification

FR-EXECUTION-012. The Installer shall perform post-install verification at minimum by checking:

- endpoint availability;
- discovery/readiness behavior;
- cluster health indicators where available;
- execution of basic test queries.

FR-EXECUTION-013. When bridge mode is enabled, the Installer shall include verification of bridge-related configuration status and pile membership visibility where such checks are supported by the backend.

FR-EXECUTION-014. The Installer shall mark the installation session as completed only if required verification checks succeed or if the operator explicitly accepts a degraded completion state.

## 14. Progress Monitoring

FR-MONITORING-001. The Installer shall expose real-time or near-real-time execution progress in the web UI.

FR-MONITORING-002. The progress view shall show:

- current phase;
- current task;
- per-host state;
- elapsed time;
- recent log output;
- warnings and errors;
- overall completion estimate when available.

FR-MONITORING-003. For bridge-mode installations, the progress view shall distinguish between base storage topology steps and bridge-specific steps.

FR-MONITORING-004. The Installer shall preserve historical logs and status transitions for later review.

## 15. Cancellation, Failure Handling, and Resume

### 15.1 Cancellation

FR-RUNCONTROL-001. The Installer shall allow an authorized operator to request cancellation of a running session from the web UI.

FR-RUNCONTROL-002. Cancellation shall be cooperative and phase-aware.

FR-RUNCONTROL-003. If cancellation is requested before a destructive step begins, the Installer shall stop before performing that step.

FR-RUNCONTROL-004. If cancellation is requested during an atomic remote action, the Installer shall complete that atomic action before stopping, unless the backend explicitly supports safe interruption.

FR-RUNCONTROL-005. The Installer shall mark the session state as `cancel requested` until execution reaches a safe stop point.

### 15.2 Failure Reporting

FR-RUNCONTROL-006. On failure, the Installer shall report:

- failed phase;
- failed task;
- affected host or hosts;
- relevant error output;
- last successful checkpoint.

FR-RUNCONTROL-007. For bridge-mode installations, failure reporting shall identify the affected pile or piles where applicable.

### 15.3 Resume

FR-RUNCONTROL-008. The Installer shall support rerunning or resuming from a safe checkpoint where the backend and session state make this possible.

FR-RUNCONTROL-009. The Installer shall not claim rollback or resume capability for a phase unless that behavior is actually supported.

## 16. Reporting and Output Artifacts

FR-REPORTING-001. The Installer shall persist the effective installation configuration used for execution.

FR-REPORTING-002. The Installer shall persist the discovery snapshot, validation results, execution log, and final status report for each session.

FR-REPORTING-003. On successful completion, the Installer shall produce a completion report containing at minimum:

- cluster endpoints;
- cluster layout summary;
- selected security mode;
- created domain and database names;
- verification result summary;
- next-step operational guidance.

FR-REPORTING-004. When bridge mode is enabled, the completion report shall include the selected base storage topology, pile definitions, and bridge-specific verification summary.

FR-REPORTING-005. The Installer shall allow export of the effective installation specification for reuse in batch mode.

## 17. REST API Requirements

FR-API-001. The Installer shall expose a documented REST API for all its externally usable functions.

FR-API-002. The REST API shall cover at minimum:

- installation-session lifecycle management;
- discovery execution and retrieval of discovery results;
- configuration creation, import, update, retrieval, and export;
- validation execution and retrieval of validation results;
- execution start, progress retrieval, cancellation request, and status retrieval;
- access to logs, reports, and persisted artifacts;
- user-interface data needed for presets, supported options, and reference metadata.

FR-API-003. The REST API shall be documented in a form suitable for client generation and external integration.

FR-API-004. The Installer UI shall use the documented REST API to retrieve data and execute all required operations, and shall not rely on separate private backend-only interfaces for normal application behavior.

## 18. User Interface Requirements

FR-UI-001. The Installer UI shall be web-based.

FR-UI-002. The Installer UI shall support execution control, configuration input, validation feedback, and monitoring from a single consistent interface.

FR-UI-003. The UI shall present destructive actions with explicit warning language and confirmation controls.

FR-UI-004. The UI shall distinguish clearly between required settings, recommended settings, and advanced settings.

FR-UI-005. The UI shall support read-only monitoring views for observers.

FR-UI-006. The UI shall provide filtering or grouping by host, phase, and severity in progress and log views.

FR-UI-007. The UI shall use distinct terminology for:

- installation mode;
- configuration generation;
- base storage topology;
- bridge mode;
- cluster layout.

FR-UI-008. When bridge mode is enabled, the UI shall present pile-related settings and statuses explicitly rather than folding them into generic multi-data-center wording.

## 19. Usability and Installer Best Practices

FR-USABILITY-001. The Installer shall default to safe values where YDB documentation provides clear recommended defaults.

FR-USABILITY-002. The Installer shall follow the principle `discover first, validate early, destroy late`.

FR-USABILITY-003. The Installer shall support a validation-only or dry-run mode that performs discovery and preflight checks without changing target systems.

FR-USABILITY-004. The Installer shall autosave configuration drafts in interactive mode.

FR-USABILITY-005. The Installer shall minimize secret exposure in UI, logs, exports, and troubleshooting output.

FR-USABILITY-006. The Installer shall explain blocking conditions and destructive risks in operator-oriented language rather than backend-specific jargon alone.

## 20. Acceptance Criteria Summary

The specification shall be considered functionally satisfied when the resulting product can:

1. discover and present host and disk inventory before installation;
2. guide an operator through interactive installation with validation and review;
3. execute the same plan from a batch specification;
4. expose a documented REST API for all installer functions and use that API from the UI;
5. install a YDB cluster in phased form with progress visibility;
6. support `block-4-2`, `mirror-3-dc`, `reduced mirror-3-dc`, and bridge-enabled cluster layouts;
7. protect against accidental disk destruction through explicit discovery-based confirmation;
8. support cancellation and clear failure reporting;
9. produce reusable artifacts and a final installation report.
