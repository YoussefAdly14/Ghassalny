# ADR 0002: pnpm Workspaces with Turborepo

## Status

Accepted

## Context

ADR 0001 commits to a TypeScript monorepo containing a Node.js API, a Next.js admin app, an Expo iOS app, and shared packages. The repository needs a free package manager with workspace support and a way to run tasks such as typecheck and build across packages in the right order.

The Expo app constrains the choice: React Native's native module autolinking and the Metro bundler must resolve dependencies correctly inside a monorepo.

## Decision

- Use **pnpm** workspaces, pinned through the `packageManager` field and installed with Corepack.
- Use `nodeLinker: hoisted` so Expo and React Native see a flat `node_modules` tree.
- Use **Turborepo** to orchestrate per-package tasks, with remote caching left disabled.
- Internal packages export TypeScript source directly, with no build step. Each app's bundler compiles them.

## Options Considered

- **npm workspaces**: works, but slower installs and no strict lifecycle-script control.
- **Yarn (Berry)**: capable, but Plug'n'Play needs extra React Native configuration, and node-modules mode gives nothing over pnpm.
- **pnpm with isolated (symlinked) node_modules**: stricter, but some React Native libraries still assume hoisting. This can be revisited when the ecosystem catches up.
- **Nx**: more powerful, but heavier than this team needs at MVP stage.
- **pnpm with Turborepo, hoisted**: accepted.

## Consequences

Benefits:

- Fast, disk-efficient installs, and dependency install scripts are blocked unless approved in `allowBuilds`.
- One command runs a task across every package in dependency order (for example, the Prisma client is generated before typecheck).
- No build step for internal packages, so changes appear instantly in every app.

Tradeoffs:

- Hoisting allows phantom dependencies (importing a package you did not declare). Code review must check that `package.json` dependencies stay accurate.
- Contributors need Corepack enabled or pnpm installed. This is covered in the local setup guide.
- Each app's bundler must be configured to compile workspace TypeScript (`transpilePackages` in Next.js, Metro's monorepo support in Expo).

## Review Trigger

Revisit if hoisting causes dependency bugs, if CI builds become slow enough to justify remote caching, or if Expo officially recommends isolated installs for all supported libraries.
