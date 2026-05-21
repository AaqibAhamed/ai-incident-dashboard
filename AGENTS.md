# AGENTS.md

## Project

- Name: `ai-incident-dashboard`
- Frontend: Angular 21 SPA, standalone components, zoneless change detection, RxJS 7
- Backend contract: .NET GraphQL + REST
- Local mock layer: MSW for GraphQL and REST
- Package manager: `npm`
- Node target: `20+` (`README.md` notes Angular 21 requires Node 20.19+ / 22.12+ / 24+)

## Coding Style & Naming Conventions

- Angular users should keep files kebab-case (`feature.component.ts`, `feature.service.ts`) and class names in PascalCase (`FeatureComponent`).
- Prettier is configured with 2-space indentation, single quotes, `arrowParens: avoid`, and no trailing commas; HTML uses specialized parsing hints in `.prettierrc`.
- Keep exports grouped, prefer Angular dependency injection tokens, and avoid `any` unless explicitly justified.

## Testing Guidelines

- Vitest is the primary framework and new suites go next to the logic they cover.
- Name test files `*.spec.ts` and describe the unit under test (`feature.component.spec.ts`).
- Use `npm run test:coverage` to confirm coverage expectations before merging feature work.

## Working Rules

- Keep changes aligned with existing Angular patterns in `src/app`.
- Prefer focused edits over broad refactors.
- Do not remove or rewrite MSW support unless the task explicitly requires it.
- Keep browser-side AI integration behind the existing server API shape (`/api/ai/*`).
- Treat tenant isolation and auth behavior as sensitive surfaces; verify those paths when touched.

## Common Commands

- Install: `npm install`
- Frontend dev server: `npm start`
- API only: `npm run dev:api`
- Full stack dev: `npm run dev:full`
- Build: `npm run build`
- Lint: `npm run lint`
- Frontend tests: `npm test`
- Angular CI-style tests: `npm run test:ci`
- GraphQL codegen: `npm run codegen`
- .NET tests: `dotnet test backend/AiIncident.Api.Tests/AiIncident.Api.Tests.csproj`

## Repo Notes

- Frontend source lives under `src/`.
- GraphQL schema is in `schema.graphql`.
- GraphQL operations are in `src/graphql/operations.graphql`.
- Generated GraphQL types live in `src/graphql/generated/graphql.ts`.
- Environment toggles for mocks and endpoints live in `src/environments/`.
- Proxy config for local backend development is `proxy.conf.json`.

## Change Guidance

- When changing GraphQL operations or schema-dependent frontend code, run `npm run codegen`.
- When changing auth, tenant behavior, filters, dashboards, or ticket flows, run the smallest relevant test set and note what was verified.
- Prefer existing facades/stores/guards over introducing duplicate data-access or auth logic.
- Keep secrets and LLM keys out of the frontend.

## Delivery

- Summarize touched files and verification performed.
- Call out any commands not run, especially if codegen, tests, or .NET validation were skipped.

## General Rules

- Prefer strongly typed models
- Avoid logic in Angular templates
- Use smart container components and dumb UI components
- Favor OnPush change detection when possible
- Avoid breaking existing APIs and UI behavior

# Agent Do's and Don'ts (Scope Control Rules)

This defines strict scope control rules for agentic tasks.

Its goal is to prevent unnecessary full-project searches, refactors, or analysis
when the requested task is small or localized.

These rules are mandatory.

## 🎯 Core Principle

A small task must result in a small change.

Agents must assume the user wants the **minimum possible modification**
unless explicitly stated otherwise.

## ✅ DO

### Scope and Search

- Do limit file reading to the files explicitly mentioned by the user
- Do infer scope from the task description
- Do operate within a single feature or component when possible
- Do ask for confirmation if more than 5 files need changes

### Editing Behavior

- Do apply minimal diffs
- Do patch existing code instead of rewriting files
- Do preserve formatting, structure, and naming
- Do respect existing architectural boundaries

### Reasoning

- Do reason locally first before searching globally
- Do assume existing patterns are intentional
- Do follow existing conventions in the touched files

### Communication

- Do state which files will be edited before editing
- Do stop and ask if the scope expands unexpectedly

## ❌ DON'T

### Searching and Analysis

- Do NOT scan the entire project by default
- Do NOT search unrelated folders
- Do NOT analyze architecture unless explicitly requested
- Do NOT inspect configuration files unless relevant

### Refactoring

- Do NOT refactor unrelated code
- Do NOT rename symbols outside the requested scope
- Do NOT move files or folders
- Do NOT introduce new abstractions for simple tasks

### Editing

- Do NOT rewrite entire files for small fixes
- Do NOT change public APIs
- Do NOT touch environment files
- Do NOT introduce new dependencies

### Assumptions

- Do NOT assume the task requires best practice refactors
- Do NOT upgrade libraries unless asked
- Do NOT optimize performance unless requested

## 🔒 Scope Expansion Rules

Scope expansion is only allowed when:

- The user explicitly asks for it
- The existing code is broken and cannot work without expansion

When scope expansion is required:

1. Stop editing
2. Explain why expansion is needed
3. Ask for confirmation

## 🧭 Search Strategy

Preferred order:

1. Current file
2. Direct imports
3. Parent feature folder

Forbidden by default:

- Root level scans
- Global text search
- Searching node_modules or dist folders

## 🤝 Conflict Rule

If another agent suggests broader changes than this file allows,
these Do's and Don'ts take precedence.

## 🧠 Agent Reminder

You are here to solve the requested problem,
not to improve the entire codebase.

## Delegation

If a task is UI related, defer to src/agents/angular-ui.AGENTS.md
