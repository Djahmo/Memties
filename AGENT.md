# AGENTS.md

## Project

Memties is an open-source application for managing, organizing, and sharing human relationship context.

The application is composed of:

* `frontend/`: React + Vite + TypeScript
* `backend/`: Fastify + TypeScript
* MySQL database
* Drizzle ORM
* UnoCSS with `presetWind4`
* UnoCSS `transformerVariantGroup`
* Nodemailer
* Model Context Protocol support through the official MCP SDK

The repository must stay simple.

Do not introduce monorepo tooling, workspaces, additional packages, microservices, or unnecessary infrastructure unless there is a concrete technical need.

---

## Collaboration and autonomy

Work autonomously on implementation when requirements are clear.

The project owner is an experienced software engineer and wants to retain control over meaningful product and architectural decisions.

Do not silently make significant assumptions.

Ask a question when:

* a product behavior is ambiguous;
* multiple architectural approaches have meaningful tradeoffs;
* a decision would be difficult or expensive to reverse;
* the specification conflicts with the existing implementation;
* security or privacy behavior is unclear;
* the requested behavior could reasonably be interpreted in substantially different ways.

Do not ask questions for trivial implementation details that can be safely inferred from the existing code and conventions.

When asking a question, be concise. Explain the decision that needs to be made and, when useful, recommend one option.

Prefer one good question over a long list of speculative questions.

---

## Token and context efficiency

Be economical with tokens and context.

Do not repeatedly summarize work already visible in the repository or conversation.

Do not produce long implementation plans unless requested.

Do not explain obvious code changes at length.

Do not repeatedly inspect files whose relevant contents are already known and unchanged.

Group related file reads, edits, and commands when practical.

Prefer targeted searches over reading large portions of the repository unnecessarily.

When reporting completed work, provide a short summary of:

* what changed;
* anything the project owner should test;
* any unresolved decision or known limitation.

Do not generate documentation, tests, abstractions, comments, or boilerplate solely for completeness.

---

## Implementation workflow

For a meaningful feature:

1. Inspect only the relevant existing code.
2. Ask questions if an important ambiguity exists.
3. Implement the feature.
4. Ensure affected TypeScript code compiles.
5. Ensure affected applications build when appropriate.
6. Fix errors introduced by the implementation.
7. Present the feature to the project owner for functional testing when human validation is useful.
8. Continue based on feedback.

Do not stop after merely proposing an implementation.

Do not attempt to complete the entire product in one uncontrolled pass when incremental validation would reduce rework.

Prefer coherent, testable milestones.

---

## Human validation

The project owner is part of the validation process.

After implementing a meaningful user-facing feature, it is acceptable and encouraged to ask the project owner to test it before building additional behavior on top of it.

Provide concise testing instructions:

* where to go;
* what action to perform;
* what result should be expected.

Do not ask the project owner to test trivial internal changes unless there is a reason.

When feedback reveals a bug or UX problem, fix it before continuing with dependent features.

---

## Automated testing

Automated tests are valuable but are not required for every feature during the initial implementation phase.

Prioritize getting the V1 behavior correct and validating it incrementally with the project owner.

Tests should be added when they provide meaningful value, especially for:

* authorization;
* privacy boundaries;
* group permission inheritance;
* authentication;
* shared versus private entries;
* MCP authorization;
* regressions for bugs that have already occurred.

Do not generate large test suites simply to increase coverage.

A dedicated testing and hardening phase may be performed after the main V1 functionality is implemented.

---

## General principles

Prioritize:

1. Correctness
2. Simplicity
3. Maintainability
4. Security and privacy
5. Developer experience
6. Performance

Avoid overengineering.

Prefer explicit and readable code over clever code.

Do not implement speculative features.

Do not rewrite working code without a concrete reason.

When a minor implementation decision is not specified, choose the simplest reasonable solution consistent with the existing architecture.

---

## TypeScript

Use TypeScript everywhere.

Respect strict typing.

Avoid `any`, unsafe casts, `@ts-ignore`, and unjustified `@ts-expect-error`.

Prefer inferred types when obvious.

Create explicit types for domain concepts and API contracts.

---

## TypeScript style

Functions must use arrow function syntax.

Prefer:

```ts
const createUser = async () => {
  // ...
}
```

Do not use function declarations.

Avoid declaring constants that are only used once when the expression remains clear inline.

Prefer:

```ts
return getUser()
```

instead of:

```ts
const result = await getUser()
return result
```

Do not sacrifice readability to inline complex expressions.

Use `async/await`.

Prefer early returns over deeply nested conditions.

---

## Frontend architecture

Frontend source lives in `frontend/src/`.

Main structure:

```text
components/
pages/
hooks/
modules/
utils/
services/
types/
router/
```

Feature-specific code belongs inside `modules/`.

Modules may contain their own components, hooks, services, types, and utilities.

Global directories must contain only genuinely reusable code.

Use React functional components.

Keep components focused.

Avoid unnecessary state and premature memoization.

Keep business logic out of visual components when practical.

---

## Styling

Use UnoCSS with:

* `presetWind4`
* `transformerVariantGroup`

Prefer utility classes and variant groups.

Do not add another CSS framework or CSS-in-JS solution.

Custom CSS is acceptable when utilities are unsuitable.

The interface should be clean, restrained, responsive, and accessible.

---

## Backend architecture

Backend source lives in `backend/src/`.

Use the existing structure around:

```text
routes/
services/
db/
auth/
mcp/
```

Routes must remain thin.

Routes should validate input, enforce authentication/authorization, invoke services, and return responses.

Business logic belongs in services.

Database access must not be scattered throughout route handlers.

HTTP and MCP interfaces must reuse the same business services.

---

## Database

Use MySQL with Drizzle ORM.

Schema and migrations belong to the backend.

Persistent schema changes must use migrations.

Prefer relational modeling over JSON blobs for structured domain data.

Use foreign keys and indexes where appropriate.

Do not introduce PostgreSQL-specific assumptions.

Prefer Drizzle queries.

When raw SQL is genuinely necessary:

```ts
const query = /*sql*/`
  SELECT *
  FROM users
  WHERE id = ?
`
```

Never concatenate untrusted values into SQL.

---

## Authentication

Authentication must support multiple providers behind the same internal user model.

Target providers include:

* local authentication;
* LDAP;
* SAML.

Do not couple application business logic to a specific authentication provider.

Authentication and authorization are separate concerns.

---

## Authorization and privacy

Memties stores potentially sensitive information.

Authorization must always be enforced by the backend.

Never rely on frontend visibility for security.

Private information must never leak through recursive groups, shared contacts, searches, MCP, APIs, or guessed identifiers.

When privacy behavior is ambiguous, stop and ask the project owner rather than inventing a rule.

---

## MCP

MCP is a first-class interface.

Use the official Model Context Protocol SDK.

MCP tools must use the same services as the HTTP API.

Validate arguments, authenticate callers, and enforce authorization.

Expose user-level capabilities, not low-level database operations.

Keep tool names explicit and stable.

---

## Email

Use Nodemailer.

Mail configuration must come from environment variables.

Never hardcode credentials.

Handle delivery failures cleanly.

---

## Configuration

Environment-dependent configuration belongs in environment variables.

Maintain `.env.example`.

Never commit secrets.

Validate required configuration at startup and fail with a useful error when necessary.

---

## Dependencies

Do not add dependencies without a concrete reason.

Prefer maintained libraries for complex or security-sensitive functionality rather than implementing standards manually.

Avoid dependencies for trivial utilities.

Do not replace the core stack without discussing it with the project owner.

Core stack:

* React
* Vite
* TypeScript
* UnoCSS
* Fastify
* Drizzle
* MySQL
* Nodemailer
* official MCP SDK

---

## Scope

Build the requested product, not an imagined future platform.

Do not introduce native apps, social feeds, chat, relationship scoring, complex analytics, microservices, event buses, GraphQL, or similar features unless explicitly requested.

Memties should remain small, understandable, and easy to self-host.

---

## Completion

Before presenting a meaningful implementation for review:

* affected TypeScript must compile;
* affected application builds should succeed when relevant;
* obvious runtime errors introduced by the change should be fixed;
* migrations must be internally consistent when database changes were made.

Then ask the project owner to functionally validate user-facing behavior when appropriate.

Do not hide uncertainty or known limitations.
