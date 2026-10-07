# Workspace Conventions

Related Linear issues: GHA-23, GHA-24, GHA-25, GHA-26, GHA-27

## Layout

```
apps/
  api/          Backend modular monolith (Node.js)
  admin-web/    Next.js admin and worker web app
  mobile/       Expo customer app, iOS first
packages/
  config/       Constants, env parsing, TypeScript base configs
  database/     Prisma schema, migrations, client (server-only)
  shared/       Domain enums and contracts (dependency-free)
  ui/           Reserved for shared design tokens and components
docs/           Product, architecture, ADRs, development guides
```

A folder becomes a workspace member when it has a `package.json`. All packages use the `@ghassalny/` scope.

## Package manager

pnpm with workspaces, and Turborepo to run tasks across packages. Both are free and open source. See [ADR 0002](../adr/0002-pnpm-turborepo-workspace.md).

- The pinned version lives in the root `package.json` `packageManager` field. Corepack (bundled with Node) installs exactly that version.
- Always install from the root: `pnpm install`. Add a dependency to one package with `pnpm --filter @ghassalny/<name> add <dep>`.
- Reference internal packages as `"@ghassalny/<name>": "workspace:*"`.
- `nodeLinker: hoisted` gives a flat `node_modules` tree. React Native and Expo autolinking work most reliably this way.
- pnpm blocks dependency install scripts by default. Allowed ones are listed under `allowBuilds` in `pnpm-workspace.yaml`. Approve new ones with `pnpm approve-builds <pkg>` only after checking why they need a script.

## Root scripts

| Script                                                                | Purpose                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------ |
| `pnpm dev`                                                            | Run every app's `dev` task                                   |
| `pnpm build`                                                          | Build every app and package that has a `build` task          |
| `pnpm typecheck`                                                      | Type-check every package (generates the Prisma client first) |
| `pnpm test`                                                           | Run every package's tests                                    |
| `pnpm lint` / `pnpm lint:fix`                                         | ESLint across the repo                                       |
| `pnpm format` / `pnpm format:check`                                   | Prettier across the repo                                     |
| `pnpm db:up` / `db:down` / `db:logs`                                  | Local PostgreSQL in Docker                                   |
| `pnpm db:generate` / `db:migrate` / `db:migrate:deploy` / `db:studio` | Prisma                                                       |

Per-package scripts use the same names (`dev`, `build`, `typecheck`, `test`) so Turborepo picks them up automatically.

## TypeScript

Base configs live in `packages/config/tsconfig/`. Every package's `tsconfig.json` extends one of them:

| Extend                                         | When                                                                                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `@ghassalny/config/tsconfig/library.json`      | Platform-neutral packages (`shared`, `config`)                                                                                |
| `@ghassalny/config/tsconfig/node.json`         | `apps/api`, `packages/database`                                                                                               |
| `@ghassalny/config/tsconfig/nextjs.json`       | `apps/admin-web`                                                                                                              |
| `@ghassalny/config/tsconfig/react-native.json` | `apps/mobile`, combined with Expo's base: `"extends": ["expo/tsconfig.base", "@ghassalny/config/tsconfig/react-native.json"]` |

The base config is strict, including `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, and `isolatedModules`. Bundler-style module resolution is used everywhere. TypeScript is pinned to 6.0, the version Expo SDK 57 ships with and the newest that typescript-eslint supports.

TypeScript 6 no longer loads every `@types/*` package automatically. Add the ones a package needs to `compilerOptions.types` (the Node config already includes `node`).

### Import aliases

**Workspace package names are the alias system.** Import shared code as `@ghassalny/shared`, never as `../../packages/shared/src`.

- Internal packages export TypeScript source directly (`"exports": { ".": "./src/index.ts" }`). There is no build step, and edits show up immediately in every app.
- Metro (Expo), Next.js (`transpilePackages`), and the API bundler compile that source for each platform.
- Do not add `compilerOptions.paths` aliases across packages. Metro, Next.js, and Node each need separate configuration to honour them, and they drift.
- An app may add its own local alias (for example `@/` pointing at `apps/mobile/src`) as long as it is configured for both TypeScript and that app's bundler.

### Package boundaries

| Package               | May be imported by | Must not depend on               |
| --------------------- | ------------------ | -------------------------------- |
| `@ghassalny/shared`   | everything         | any runtime dependency           |
| `@ghassalny/config`   | everything         | app code; only `zod` at runtime  |
| `@ghassalny/database` | `apps/api` only    | client apps must never import it |

## Linting and formatting

- One ESLint flat config at the root (`eslint.config.mjs`) covers every app and package: `@eslint/js` recommended, `typescript-eslint` recommended, type-only imports enforced, and Prettier last to switch off formatting rules.
- When an app is scaffolded, add its framework rules (Next.js, React Native and React hooks) in the root config scoped to that app's files.
- Prettier settings: `.prettierrc.json` (single quotes, trailing commas, 100 columns, LF line endings).
- Generated and build output (Prisma client, migrations, `.next`, `.expo`, `ios`, `android`, `dist`) is ignored by both tools.
- `.editorconfig` and `.gitattributes` keep LF line endings on Windows too.

## Environment variables

Every app has a committed `.env.example`. Real `.env` files are gitignored.

| File                             | Read by                             | Copy to      |
| -------------------------------- | ----------------------------------- | ------------ |
| `.env.example`                   | Docker Compose (optional overrides) | `.env`       |
| `packages/database/.env.example` | Prisma CLI                          | `.env`       |
| `apps/api/.env.example`          | API                                 | `.env`       |
| `apps/admin-web/.env.example`    | Next.js                             | `.env.local` |
| `apps/mobile/.env.example`       | Expo                                | `.env`       |

Rules:

- Each app validates its variables at startup with its schema from `@ghassalny/config` and stops with a readable error if any are invalid.
- Secrets live only in the API's environment. `NEXT_PUBLIC_*` and `EXPO_PUBLIC_*` values are public: they are compiled into the browser bundle and the iOS binary.
- Development defaults are free and local-only. The development auth secret contains `dev-only`, and the API refuses to start in production while it does.
- Production iOS builds must use an `https://` API URL. The mobile schema enforces this.
