# Lunar Frontier — Copilot Instructions

## Project direction

- Build a student-facing lunar civilization builder with a Three.js 3D lunar overview and a 2D management view for the selected sector.
- Treat [GAME_SPEC.md](../GAME_SPEC.md) as the source of truth for gameplay requirements, sector names, persistence, and acceptance criteria. Update it when approved behavior changes.
- Use [DEVELOPMENT.md](../DEVELOPMENT.md) for verified setup, run, build, and test commands.
- Keep the 3D overview and 2D sector gameplay as distinct views of the same selected-sector and colony state.

## Engineering constraints

- Do not add a database or remote persistence. Persist player progress in browser local storage.
- Keep game state explicit and serializable. Validate and version persisted data; handle missing, malformed, or older saved data without silently presenting it as a valid save.
- Preserve the specified 15-sector roster and six resource names. Avoid inventing resource costs, production rates, failure rules, or progression gates where the spec marks them as undecided; surface those decisions for approval.
- Make pause behavior apply consistently to all gameplay time and simulation updates. UI navigation and saving may remain available while paused.
- Use semantic, accessible controls and provide non-hover ways to inspect and select sectors.
- Keep changes focused and follow established project conventions as the codebase grows.

## Documentation workflow

- For every task that changes the project, inspect the existing documentation before implementation and identify which docs are affected.
- Update the relevant documentation in the same change as the implementation. Document user-visible behavior, setup or workflow changes, and non-obvious technical decisions; keep instructions accurate and actionable.
- Use [GAME_SPEC.md](../GAME_SPEC.md) for approved gameplay requirements and behavior, [DEVELOPMENT.md](../DEVELOPMENT.md) for setup, project structure, and development checks, and [README.md](../README.md) for user-facing overview and getting-started information. Update other docs when they are the relevant source of truth.
- Do not add unrelated or repetitive documentation. If the task truly has no applicable documentation to change, state that in the completion summary rather than making a no-op edit.
- Before finishing, verify that documentation matches the implemented behavior and that any commands or examples you add have been checked.

## Verification

- Add or update tests for gameplay rules, sector selection and unlocking, pause behavior, and save/load behavior when implementing those systems.
- Run the narrowest relevant tests and checks after changes. Do not claim validation that was not run.
- If setup commands or scripts are added, document the verified commands in the project documentation.
