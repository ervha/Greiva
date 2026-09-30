# Implementation specification version

The adopted implementation specification is `docs/plan/POC_SPEC.md`. Its SHA-256 matches the reattached version selected on 2026-09-30. The user provided the three specifications under `docs/plan/`; REQUIREMENTS and DESIGN describe production scope rather than additional PoC work.

- Adopted SHA-256: `1227c3562632c170967534fcb2aaa3557d69e033fafbd3e959a25a84c20663c0`
- Superseded initial attachment SHA-256: `597adb8cb4fdc5499f4b33597cf677ef0421248e08ec0db2dacea59b4537db20`
- Changes: Section 9.2 now preserves same-field conflicts with base/local/remote/field and resolves them through an explicit selection operation; Section 14 criterion 7 follows this rule.
- Section 18 Step 1 is unchanged. This delivery does not implement conflict resolution or its UI.
- GREIVA_DESIGN_SPEC.md and GREIVA_REQUIREMENTS.md do not add requirements to this implementation.

## Product design revision: 2026-09-30

The user adds calendar display of timetables and general recurring schedules. Timetable entry uses weekdays plus configurable period slots, with direct time entry also available. The user explicitly requests regular weekday recurrence, cancellations, make-up/additional sessions, and applicability beyond university schedules.

- `GREIVA_REQUIREMENTS.md` and `GREIVA_DESIGN_SPEC.md` are revised to v0.2.
- `CALENDAR_TIMETABLE_SPEC.md` records the agreed feature requests and a proposed generic recurrence/exception model, UI, boundaries and future acceptance criteria. Detailed schema and initial release scope remain decisions for production implementation.
- `POC_SPEC.md` is unchanged; its adopted SHA-256 above remains valid. Calendar design does not authorize new PoC entities, APIs, UI, or skipping the Windows IME gate.

## Help design revision: 2026-09-30

The user adds a help page and related guidance to the product design. `HELP_SUPPORT_SPEC.md` proposes in-app help search, categories, FAQ, shortcuts, contextual guidance, skippable first-use guidance, offline articles and troubleshooting/diagnostic flows.

- `GREIVA_REQUIREMENTS.md` and `GREIVA_DESIGN_SPEC.md` are revised to v0.3. Help is product content, separate from user Pages and their search/CRDT storage.
- The document records proposed behavior and acceptance criteria; actual help screens, articles, support destination and initial release details are not implemented or finalized here.
- The adopted `POC_SPEC.md`, its hash, gate order, app code and schemas are unchanged.

## Calendar change scope decision: 2026-09-30

The user selects three scopes for recurring-schedule edits: this occurrence, this occurrence and following, or the whole series. Changes to following occurrences preserve prior occurrences; the impact on existing cancellations and reschedules is shown before confirmation.

- `CALENDAR_TIMETABLE_SPEC.md` is revised to v0.2; requirements and UI guidance record the selected behavior and proposed acceptance criteria.
- Scope across multiple patterns, the boundary of rescheduled occurrences and history handling for whole-series edits remain open. No schema or implementation is selected by this answer.
- PoC scope, gate order and app code are unchanged.

## Calendar exception carry-forward decision: 2026-09-30

The user selects option A: prepare carry-forward suggestions automatically and let the user review or adjust them in a list before confirming. Cancellations carry to corresponding occurrences; individually rescheduled destination times are retained. Exceptions without a clear counterpart require individual review.

- Calendar v0.2, requirements, UI guidance and help article guidance record this behavior. The prior change-scope decision and this answer form one documentation checkpoint.
- Matching algorithms, identity across recurrence segments, unresolved-case choices and concurrent-change revalidation remain open. No application behavior is implemented by this documentation change.

## Future AI actions design revision: 2026-09-30

The user plans native in-app AI support for creating Pages and registering Tasks and schedules from text or voice, with extensibility to the application's operations as features are added.

- Requirements and UI guidance are revised to v0.4. `AI_ACTION_SPEC.md` records the requested direction, a proposed shared application-command boundary, speech-to-text correction, validation, actual execution results and future acceptance criteria.
- Confirmation policy, data context and external transmission, AI/speech providers, on-device execution, cost, retention and initial release scope are not decided. In-app support does not imply on-device inference or general OS control.
- This is design-only: PoC scope and gate order, app code, schemas and service connections are unchanged.

## AI execution confirmation decision: 2026-09-30

The user selects option B: new creations execute directly; changes to or deletion of existing data require confirmation. Ambiguity resolution and validation still apply, and partially recognized speech is not an execution request.

- `AI_ACTION_SPEC.md` is revised to v0.2, with the selected policy, corresponding UI/requirements guidance and future acceptance criteria. README reflects the decision.
- Creation commands with effects on existing data must classify those effects as confirmed changes. Mixed-request execution units, ordering and recovery remain open; per-operation confirmation-bypass settings were not selected.
- PoC scope, adopted specification, app code and service connections are unchanged.

## AI context scope decision: 2026-09-30

The user selects option B: use the current Page or schedule and its related notes and Tasks, in addition to the submitted input. Automatic search across unrelated workspace data is not selected.

- `AI_ACTION_SPEC.md` is revised to v0.3; requirements, UI guidance and README reflect the context boundary. Related resources remain subject to normal read authorization.
- Context eligibility does not authorize external transmission. Provider/transmission policy, relationship traversal limits and context-list interactions remain to be specified.
- This is a documentation change only; no data is read by an AI service or sent externally, and PoC scope and app code are unchanged.

## AI external transmission settings decision: 2026-09-30

The user selects option B: authorize destinations and data types in initial settings, omit repeated transmission prompts within that scope, and allow later changes or revocation. This does not bypass the separate confirmation for changes to or deletion of existing data.

- `AI_ACTION_SPEC.md` is revised to v0.4; requirements, UI guidance and README reflect the selected policy. Expanding destinations/types requires additional authorization; revocation blocks new sends and retries.
- Providers, audio handling, retention, in-flight cancellation and settings storage/synchronization details remain open. Recording is a separate data type from input text/transcripts.
- This records a future product policy, not permission to connect services or transmit current development/user data. PoC, app code and service connections are unchanged.

## AI voice use scope decision: 2026-09-30

The user selects option B: support short spoken commands and creating Pages plus extracting Task/schedule candidates from long meeting or lecture recordings.

- `AI_ACTION_SPEC.md` is revised to v0.5; requirements, UI guidance and README record the future scope. Processing states, transcript correction, source references and retry behavior are proposed for later implementation.
- Candidate-registration policy, Page structure, recording retention, limits, file import and platform/background behavior remain open. Speech within a recording is source content, not a direct stream of execution requests.
- This remains product design only; PoC scope, app code and service connections are unchanged.

## AI extracted-candidate registration decision: 2026-09-30

The user selects option A: choose desired Tasks and schedules from the extracted-candidate list and register them in a batch. Short direct creation requests keep the previously selected direct-execution policy.

- `AI_ACTION_SPEC.md` is revised to v0.6; requirements, UI guidance and README reflect selection-based registration. Selecting candidates and invoking registration is the creation request, without an additional confirmation for resolved new creations.
- Candidate editing, per-item results and retry behavior are proposed. Initial selection, duplicate grouping, batch units with incomplete candidates and retention remain open. Changes to existing data still require confirmation.
- This is a documentation checkpoint only; PoC scope, app code and service connections are unchanged.

## AI recording Page structure decision: 2026-09-30

The user selects option B: a note organized around key points plus a folded full transcript in the same Page.

- `AI_ACTION_SPEC.md` is revised to v0.7; requirements, UI guidance and README reflect the selected structure. Transcript labels, source navigation and correction behavior are proposed for implementation.
- Recording retention/storage, transcript revisions and reference tracking, speaker/time labels, note templates and large-transcript rendering remain open. Candidate selection is unchanged; AI edits to an existing Page still require confirmation.
- The repository checkpoint increments PATCH to v0.1.1 because this changes documentation only. PoC, app code, manifests and existing execution artifacts are unchanged.

## AI original recording retention decision: 2026-09-30

The user selects option B: app-managed original recordings have a default retention of 30 days, configurable by the user. The Page and full transcript remain after the original audio expires.

- `AI_ACTION_SPEC.md` is revised to v0.8; requirements, UI guidance and README reflect the selected default. Expiry removes original audio, not created Pages, transcripts or registered Tasks/schedules.
- Storage/sharing, retention start time, settings changes affecting existing recordings, cleanup while offline, backups and unfinished processing remain to be specified. External-provider retention is a separate contract.
- This is documentation-only PATCH checkpoint v0.1.2. PoC, app code, manifests and existing execution artifacts are unchanged.

## AI original recording storage decision: 2026-09-30

The user selects option C: original recordings stay on the recording device by default; only recordings selected by the user are stored in the application's cloud.

- The storage decision was prepared in draft v0.9 and is published with the grouped decisions in `AI_ACTION_SPEC.md` v0.10 at checkpoint v0.1.3. Page/transcript sync, optional cloud audio storage and authorized processing transmission to AI providers remain distinct.
- App-managed copies follow the selected retention policy. Storage/provider choice, upload/cache/expiry synchronization, limits and early deletion or cloud-storage removal remain open.
- This is documentation-only PATCH checkpoint v0.1.3; no audio is uploaded, and PoC, app code, manifests and existing execution artifacts are unchanged.

## Grouped AI product decisions and public README: 2026-10-01

The user answers 1A, 2C, 3A, 4B in one batch:

- 1A: start the future AI offering with creation, registration and recording organization; existing-data editing/deletion and AI search follow later. Reads of current and related resources needed for creation remain available within the agreed context scope.
- 2C: provide a common AI panel plus context-aware entry points in individual screens, using the same operation and confirmation rules.
- 3A: support both in-app recording and importing existing audio files. Import an app-managed copy, preserve the original file and do not infer its recording date from its import date.
- 4B: retain app-managed AI conversations for 30 days by default, with configurable retention and manual deletion. Conversation deletion does not remove created entities or automatically replay operations; execution identifiers and provider retention are separate contracts.

`AI_ACTION_SPEC.md` v0.10 and requirements/design v0.5 record these decisions and future acceptance criteria. Provider, rollout date/platforms, detailed UI, formats/limits and retention storage/sync/expiry contracts remain open. AI is still unimplemented; these decisions do not expand PoC.

The user requests that the root README address GitHub readers and omit development status. The previous development details move to `docs/plan/DEVELOPMENT_STATUS.md`, with adjusted relative links and explicit historical verification status. README introduces the project, its intended experience and document entry points without current progress or checkpoint numbers.

The user also requests grouped questions first and batched specification updates afterward. AGENTS.md records that workflow. All changes above and the previously prepared storage decision share documentation-only PATCH checkpoint v0.1.3; app code, manifests and existing artifacts are unchanged.

## Native test target and VM cleanup: 2026-10-01

The user selects Docker plus the physical Windows host. This supersedes the earlier VM-only native-test constraint, while preserving Docker for development and automated tests. The user also authorizes later removal of unnecessary VM-related resources.

- Reuse the existing 0.0.0 debug native shell against the verified Docker frontend. A launcher scopes WebView2 user data to a project directory using a child-only environment variable. No new host language or native-build toolchains are installed.
- Native process/window creation, response and the actual WebView2 data directory are verified. Client/shared source files match the running Docker image. Rendering and actual Microsoft IME scenarios still need user observations; Step 3 and Gate A are not complete.
- The powered-off Greiva VM is unregistered and deleted, and its project-local ISO/preparation directory is removed. The software uninstall stops with MSI error 1730/exit 1603 requiring Windows administrator elevation; VirtualBox itself remains installed.
- Historical VM plans and old evidence remain available. The current execution method is documented in `windows-host-ime.md`; source versions and native binary versions are not conflated. This environment/evidence checkpoint is PATCH v0.1.4.

## VM software cleanup confirmation: 2026-10-01

After the user reports performing the requested action, the elevated VirtualBox uninstaller is confirmed terminal with return 0 at 08:03:23 JST. Its uninstall registry entry, VBoxManage executable and Greiva VM directory are absent. The prior failed attempt and prior cleanup state remain historical evidence; current documents record completed removal at PATCH checkpoint v0.1.5.

The message does not specify per-scenario IME results, so Step 3 and Gate A remain unverified. No native test is marked Pass from the uninstall outcome, and no app code or runtime version changes.

## Initial local IME result confirmation: 2026-10-01

The user explicitly selects A, defined as all four requested IME test groups completing without issues. Record a user-operated manual Pass for Japanese conversion/commit/reconversion, selection/deletion/Undo/Redo during and after composition, Japanese input with Slash/Mention candidates, and editing after Todo/Toggle/block movement.

The initial local Step 3 evidence is complete and indexed at PATCH checkpoint v0.1.6. `manual-results.json` preserves the exact option and its scope; `completion-audit.md` maps evidence to the initial PoC step. This is explicit user confirmation, not Codex GUI observation or an automated test. Exact keystrokes, before/after text, test timestamps and visual captures were not provided and are not invented. Other native block coverage is not inferred from the four-item answer.

Gate A's final verdict is still pending: composition under remote Yjs updates follows Step 4 integration, with remaining native Editor/visual evidence to be strengthened. PoC order, app code and runtime binary versions are unchanged.
