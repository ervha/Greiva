# Greiva development

- Follow `docs/plan/POC_SPEC.md` and its implementation order. Production requirements and design guidance do not expand PoC scope by themselves.
- Run development services and automated tests in Docker. Run Tauri and Microsoft IME checks in the Windows VM. Keep Node/Rust/browser toolchains out of the host environment.
- The user requests regular commits: commit each cohesive implementation milestone after its relevant checks pass. Save a verified checkpoint before starting a separate change. Use descriptive commit messages; do not split a broken implementation into artificial time-based commits.
- Check the working tree before staging and keep unrelated user changes out of a commit. Exclude credentials, local tools, VM disks/ISOs, dependencies, caches and generated build output. Selected verification evidence belongs in `tests/evidence/`.
- Use `codex/` for new work branches. The configured GitHub remote is named `main`; verify its URL before remote operations. A request to commit does not by itself authorize pushing or publishing.
- UI changes should preserve selection and focus, support pointer and keyboard operation, and leave native IME composition uncancelled. Verify the actual interactions in Docker E2E and keep Windows IME evidence separate.
