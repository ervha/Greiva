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
