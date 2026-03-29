# YDB Installer UI Specification

## 1. Purpose and relationship to the product specification

This document describes **how the web user interface implements** the normative requirements in **`SPECIFICATION.md`**. It focuses on routes, screen structure, per-step form controls, batch-mode presentation, and Monitoring/Logs view affordances. It does **not** replace **`SPECIFICATION.md`**: all `FR-*` **SHALL** statements that define product behavior—including `FR-INTERACTIVE-*`, `FR-UI-*`, and `FR-I18N-*`—live in **`SPECIFICATION.md`** (§6 and §18).

**Use this document to:**

- map screens to requirement IDs;
- implement consistent navigation, step transitions, and control inventories;
- align REST API usage with the public UI (FR-API-004).

**Traceability:** Subsections below cite the `FR-*` identifiers they realize. Where **`SPECIFICATION.md`** and this document differ in wording, **`SPECIFICATION.md`** prevails.

---

## 2. Primary screens and illustrative routes

The normative screen matrix (routes, purposes, **Operator** vs **Observer** capabilities) is **`SPECIFICATION.md` §6.4**, together with FR-INTERACTIVE-014–FR-INTERACTIVE-017, FR-ACCESS-003, and FR-UI-005.

**Implementation notes:** Path names in **`SPECIFICATION.md`** are illustrative; equivalent routing is permitted (FR-INTERACTIVE-011). Keep navigation affordances for Home, Configuration, Monitoring, Logs, and Logout consistent with FR-INTERACTIVE-017 and role rules in **`SPECIFICATION.md`** §3.2.

---

## 3. Per-step form controls

### 3.1 Form definitions (by configuration step)

Each subsection describes **one configuration-step form**: its role in the workflow, the **primary input controls** (type and purpose), and **dependencies** on other steps or data. Control labels are illustrative. Localization and secret-handling requirements are defined by FR-I18N-001, FR-SECURITY-008, and FR-USABILITY-005.

#### 3.1.1 Step 1 — Target definition (`targets`)

**Description.** Collect the set of target hosts and parameters needed to reach them over SSH for discovery and later execution (§5.1, FR-DISCOVERY-001, FR-DISCOVERY-002, FR-DISCOVERY-002C).

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| Target rows (repeatable) | List | One row per target host. |
| Address | Text | Hostname, IP, or composite `host:port` (FR-DISCOVERY-001). Required per row in the sense that a reachable address must be defined before advancing; placeholder and parsing behavior SHALL be consistent for the default block and per-row edit (no divergent “host-only” versus “host:port” copy for the same field). |
| SSH port | Number | TCP port for SSH when per-target settings apply; the default profile defines the port for rows that follow the default (FR-DISCOVERY-002C). |
| SSH auth mode | Selection | Per row: use default profile, password, secret key, or SSH agent. Required per row. |
| SSH user | Text | Login user for SSH. MAY be left empty; in read-only summaries the UI SHALL show a localized operator-facing phrase (English resource example: **Unconfigured (using SSH default)**) rather than a blank or placeholder dash, loaded from UI language resources (FR-I18N-001). |
| SSH password | Password text | Password for SSH. Required for the edited row when password mode is selected. |
| SSH key | Upload control | Private key for SSH. Required for the edited row when secret key mode is selected (prototype behavior as implemented). |
| Add / Remove / Edit | Buttons | **Add** appends a row; **Remove** deletes a row and updates persisted targets when committed per product rules; **Edit** opens per-row settings (address, port when applicable, user, auth mode, secrets). |
| Default SSH authentication | Block | Same SSH fields as a custom row except there is no “use default” auth option. Shown read-only with an **Edit** action for **Operator**; **Done** commits changes to the draft/session per implementation. |
| Persist targets | Commits | Target list persistence to the session SHALL occur on explicit commits (for example **Done** on the default SSH block, **Done** on the per-row edit dialog, and row removal that updates server state), satisfying FR-INTERACTIVE-024 and FR-INTERACTIVE-024A. There is no separate **Save targets** control in the current UI shape. |

**Presentation notes.**

- The form contains two blocks: **default SSH access settings** and a **targets** table. Both use read-only summary presentation with **Edit** (and table **Add** / **Remove** / **Edit**) for **Operator** in interactive mode.
- Per-target SSH access MAY follow the default profile or use custom settings entered in the row editor.
- Operator-assigned **host id** is not collected on this screen; stable host identifiers for discovery and later steps are assigned by the Installer/backend as needed. The `set targets` API payload from the UI need not include a host id field.
- Multi-line read-only summaries for default and per-row SSH settings SHOULD align field order and labels (authentication mode, port, user, password/key status when relevant).

#### 3.1.2 Step 2 — Discovery run (`discovery_run`)

**Description.** Trigger remote discovery against saved targets and show run status (phase 2 in §4.1).

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| Run discovery | Button | Starts discovery; disabled until targets are saved. |
| Refresh discovery | Button | Re-runs discovery to update the Discovery Snapshot (FR-DISCOVERY-006). |
| Progress / error display | Text, progress indicator | Shows running state and per-session errors without leaking secrets. |

#### 3.1.3 Step 3 — Discovery results (`discovery_results`)

**Description.** Read-only presentation of the Discovery Snapshot (§5.2) for operator review before cluster design.

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| Host inventory table or cards | Read-only grid | Hostname, FQDN, OS, hardware summary, disk inventory columns, per-host discovery errors (FR-DISCOVERY-003, FR-DISCOVERY-007). |
| Continue to configuration | Primary action | Moves to layout when the operator is ready; the UI can warn if critical hosts failed discovery. |

#### 3.1.4 Step 4 — Cluster layout (`layout`)

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

#### 3.1.5 Step 5 — Disk selection (`storage`)

**Description.** Map discovered disks to YDB storage, partitioning, labels, and media grouping (§9, FR-STORAGE-001–FR-STORAGE-008).

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| Disk pick lists per host | Multi-select from discovery | Restricted to Discovery Snapshot unless Expert Override is on (FR-DISCOVERY-010, FR-STORAGE-001). |
| Expert Override | Toggle + text fields | Manual device identifiers with risk warnings (FR-DISCOVERY-010). |
| Partitioning scheme | Select or guided form | For unpartitioned disks (FR-STORAGE-002, FR-STORAGE-003, FR-STORAGE-004). |
| Disk type / kind / label pattern | Fields per group | FR-STORAGE-005–FR-STORAGE-008. |
| Safety summaries | Read-only callouts | Warnings for mounted, system, or in-use disks (FR-STORAGE-009–FR-STORAGE-011). |

#### 3.1.6 Step 6 — Network & endpoints (`network`)

**Description.** Client-facing and intra-cluster network settings, including separated front-end and back-end models (§8.3, FR-LAYOUT-011–FR-LAYOUT-013).

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| Network model | Radio | Standard single-network vs separated front/back (FR-LAYOUT-011, FR-LAYOUT-012). |
| Front-end FQDN / endpoints | Text | Client access (FR-LAYOUT-013). |
| Back-end FQDN / internal addresses | Text | Intra-cluster communication (FR-LAYOUT-013). |
| Additional listeners / ports | Text or number | As required by selected layout and validation. |

#### 3.1.7 Step 7 — Security & TLS (`security`)

**Description.** TLS materials, Installer-facing HTTPS options where relevant, and YDB authentication settings (§10).

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| TLS mode | Select | Operator-provided certs, installer-managed generation, or equivalent (FR-SECURITY-002, FR-SECURITY-003). |
| Certificate and key material | File upload or path on control host | FR-SECURITY-002; masked display. |
| Certificate generation parameters | Form fields | Validity, SANs, CA settings as supported (FR-SECURITY-003). |
| YDB authentication | Toggles and credential capture | FR-SECURITY-006, FR-SECURITY-007; secrets masked. |

#### 3.1.8 Step 8 — Artifacts & version (`artifacts`)

**Description.** YDB version, configuration generation, and artifact source (§11, FR-ARTIFACT-001–FR-ARTIFACT-005).

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| Artifact source mode | Radio | Download, local archive, local binaries (FR-ARTIFACT-001). |
| Version / component selectors | Text or select | Compatible with configuration V1 or V2 (FR-ARTIFACT-004). |
| Local path fields | Text | Paths on the control host for archives or binaries. |
| Offline / mirror URL | Text | When used instead of public download in restricted environments. |

#### 3.1.9 Step 9 — Database settings (`database`)

**Description.** Initial database creation parameters used before compute nodes start (§13.4, FR-EXECUTION-009).

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| Database name | Text | Initial database identifier. |
| Domain / root paths | Text | As required by YDB deployment model. |
| Additional DB options | Fields | Charset, pools, or other documented first-run settings exposed by the Installer. |

#### 3.1.10 Step 10 — Review & approval (`review`)

**Description.** Consolidated read-only summary of effective configuration, latest preflight-validation outcome captured before review, destructive-scope confirmation, and execution start (§12, §9.2).

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| Configuration summary | Read-only sections | Hosts, topology, disks, security, artifacts. |
| Validation results | Read-only panel | Shows latest preflight result summary with blocking vs warning classification (FR-VALIDATION-003). |
| Approve destructive actions | Checkbox or typed confirmation | Identifies affected hosts and disks (FR-STORAGE-012). |
| Start installation / Proceed | Primary button | Available only when blocking errors are cleared and required destructive confirmations are completed. |

#### 3.1.11 Step 11 — Run state & confirmations (`run_state`)

**Description.** Execution-time configuration-step screen that shows current session state, highlights pending confirmation requests that gate progress, and provides quick navigation to monitoring and logs views. For **Operator**, this step allows submission of confirmation responses where required. For **Observer**, this step is read-only.

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| Current run state summary | Read-only panel | Current phase/task, session status, elapsed time, and high-level warnings/errors (FR-MONITORING-002). |
| Pending confirmation requests | List | Shows active confirmation prompts that gate execution, including scope and consequence summary. |
| Confirmation response controls | Buttons or form actions (authorized roles) | Allow **Operator** to submit required responses; **Observer** sees state only (FR-ACCESS-002, FR-ACCESS-003, FR-UI-009). |
| Open Monitoring | Link or button | Navigates to `/monitoring` for detailed progress timeline and host/task status. |
| Open Logs | Link or button | Navigates to `/logs` for detailed installation logs. |

Section references such as §6.5, §5, §8, §9, §10, §11, §12, or §13 in the subsections above refer to **`SPECIFICATION.md`**.

---

## 4. Monitoring and Logs views

### 4.1 Execution monitoring screen

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

### 4.2 Logs screen

**Description.** Dedicated view for installation logs of the active session, including live tail during execution and historical log browsing after completion or failure.

**Input controls.**

| Control | Type | Semantics |
|---------|------|-----------|
| Log stream viewer | Scrollable text/table | Shows timestamped log entries with severity; secrets redacted (FR-SECURITY-008, FR-USABILITY-005). |
| Filter by host / phase / severity / time range | Selectors and inputs | Narrows visible log entries for troubleshooting (FR-UI-006). |
| Auto-follow toggle | Toggle | Keeps view pinned to newest entries while enabled. |
| Download or export logs | Link or button | Exports logs for reporting and troubleshooting (FR-REPORTING-002, FR-REPORTING-006). |
| Back to run state or monitor | Link or button | Returns to `/configuration` step 11 or `/monitoring` without losing session context. |

These views implement FR-MONITORING-001–FR-MONITORING-003, FR-MONITORING-005, FR-RUNCONTROL-001, FR-SECURITY-008, FR-USABILITY-005, and FR-UI-006 as cited in the tables, together with **SPECIFICATION.md** §6.8.

---

## 5. Batch-mode UI presentation

This section elaborates **SPECIFICATION.md** §6.7 (normative interaction rules) for implementers.

**Description.** In **batch** Installation Mode, the UI uses the same `/configuration` route and step sequence as **SPECIFICATION.md** §6.5 and the read-only form content defined in §3 of *this* document. There is no separate batch configuration screen or route.

**Interaction rules.**

| Rule | Semantics |
|------|-----------|
| Batch data source | Session configuration values come from the loaded batch specification and its validated effective form (FR-BATCH-001–FR-BATCH-004). |
| No configuration overrides | Configuration-step controls for targets, topology, storage, network, security, artifacts, and database settings are pre-filled and read-only in **batch** mode (FR-MODE-003, FR-ACCESS-005). |
| Allowed actions | Users with **Operator** privileges can provide required confirmation responses and run-control actions where **SPECIFICATION.md** allows them (FR-ACCESS-002, FR-BATCH-008A, §15). |
| Visibility | The UI indicates that values are batch-sourced, pre-filled, and non-editable for the running session (FR-BATCH-001A). |

---

## 6. UI implementation notes (non-normative)

- **Step strip and deep linking:** FR-INTERACTIVE-021, FR-INTERACTIVE-021A, FR-INTERACTIVE-031B, and FR-INTERACTIVE-031C constrain step presentation, URL query parameters, and SPA fallback routing; align component behavior with **`ydb-platform/ydb-ui-components`** (FR-TECH-002, **SPECIFICATION.md** §18).
- **Localization:** Load operator-visible strings from locale resources per FR-I18N-001–FR-I18N-003; never use the backend binary as the sole source of localized UI text (FR-I18N-003A).
- **Secrets:** Mask secrets in forms and logs per FR-SECURITY-008 and FR-USABILITY-005.

