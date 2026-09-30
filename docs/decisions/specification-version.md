# Implementation specification version

The adopted implementation specification is `docs/plan/POC_SPEC.md`. Its SHA-256 matches the reattached version selected on 2026-09-30. The user provided the three specifications under `docs/plan/`; REQUIREMENTS and DESIGN describe production scope rather than additional PoC work.

- Adopted SHA-256: `1227c3562632c170967534fcb2aaa3557d69e033fafbd3e959a25a84c20663c0`
- Superseded initial attachment SHA-256: `597adb8cb4fdc5499f4b33597cf677ef0421248e08ec0db2dacea59b4537db20`
- Changes: Section 9.2 now preserves same-field conflicts with base/local/remote/field and resolves them through an explicit selection operation; Section 14 criterion 7 follows this rule.
- Section 18 Step 1 is unchanged. This delivery does not implement conflict resolution or its UI.
- GREIVA_DESIGN_SPEC.md and GREIVA_REQUIREMENTS.md do not add requirements to this implementation.
