# Local Developer Setup

Related Linear issue: GHA-30

Everything here is free and runs on your machine. No cloud accounts are needed for local development.

## Prerequisites

| Tool                    | Version                              | Notes                                                          |
| ----------------------- | ------------------------------------ | -------------------------------------------------------------- |
| Node.js                 | 24 LTS (see `.nvmrc`), minimum 22.12 | Includes Corepack                                              |
| pnpm                    | Pinned in `package.json`             | Installed through Corepack, see below                          |
| Docker Desktop          | Any recent version                   | Runs local PostgreSQL. Must be **running** before `pnpm db:up` |
| Git                     | Any recent version                   |                                                                |
| iPhone with **Expo Go** | Latest from the App Store            | For running the customer app on Windows (see iOS development)  |
| Xcode (macOS only)      | Latest                               | Optional, for the iOS Simulator                                |

### Enable pnpm

```sh
corepack enable pnpm
```

On Windows without administrator rights this fails with `EPERM` because Node is installed under `C:\Program Files`. Install the shim into your user npm folder instead, which is already on `PATH`:

```sh
corepack enable pnpm --install-directory "%APPDATA%\npm"
```

Check it with `pnpm --version`. It should print the version from the root `package.json`.

## First-time setup

```sh
pnpm install                 # installs every workspace
cp backend/database/.env.example backend/database/.env
cp backend/api/.env.example backend/api/.env
pnpm db:up                   # starts PostgreSQL 17 in Docker and waits until healthy
pnpm db:migrate              # applies migrations to the local database
pnpm typecheck               # generates the Prisma client and type-checks everything
```

On Windows PowerShell, use `Copy-Item` in place of `cp`.

## Database

| Command            | What it does                                                  |
| ------------------ | ------------------------------------------------------------- |
| `pnpm db:up`       | Start PostgreSQL (`localhost:5432`, database `ghassalny`)     |
| `pnpm db:down`     | Stop it. Data is kept in the `ghassalny_postgres-data` volume |
| `pnpm db:logs`     | Follow database logs                                          |
| `pnpm db:migrate`  | Create and apply a migration after editing `schema.prisma`    |
| `pnpm db:generate` | Regenerate the Prisma client                                  |
| `pnpm db:studio`   | Browse data in Prisma Studio                                  |

Default development credentials: user `ghassalny`, password `ghassalny_dev_password`, database `ghassalny`. They are for local development only.

**Port 5432 already in use?** Copy the root `.env.example` to `.env`, set `POSTGRES_PORT=5433`, and update the port in both `DATABASE_URL` values.

**Start from an empty database:** `docker compose down -v` deletes the volume, then run `pnpm db:up` and `pnpm db:migrate`.

## Apps

The apps are scaffolded by later Linear issues. These are the planned commands:

| App              | Command                                  | URL                     | Scaffolded by  |
| ---------------- | ---------------------------------------- | ----------------------- | -------------- |
| API              | `pnpm --filter @ghassalny/api dev`       | `http://localhost:4000` | GHA-107 (done) |
| Admin web        | `pnpm --filter @ghassalny/admin-web dev` | `http://localhost:3000` | GHA-76         |
| Customer iOS app | `pnpm --filter @ghassalny/mobile dev`    | Expo dev server         | GHA-58         |
| Everything       | `pnpm dev`                               |                         |                |

## iOS development

The customer app targets iOS first.

### On Windows (no iOS Simulator)

1. Install **Expo Go** on your iPhone.
2. Put the phone and the computer on the same Wi-Fi network.
3. In `frontend/mobile/.env`, set `EXPO_PUBLIC_API_URL` to your computer's **LAN IP** (find it with `ipconfig`), for example `http://192.168.1.20:4000`. `localhost` on the phone means the phone itself.
4. Allow Node.js through Windows Firewall on private networks when prompted.
5. Run the mobile dev command and scan the QR code with the iPhone Camera app.

Expo Go only runs libraries bundled with the Expo SDK. Once the app needs custom native code, switch to a development build made with **EAS Build** (free tier available) and install it on the phone.

### On macOS

Install Xcode, then press `i` in the Expo dev server to open the iOS Simulator. `localhost` works from the Simulator.

### App Store builds

App Store binaries are built with EAS Build, or with Xcode on a Mac, and uploaded with EAS Submit or Transporter. You need an Apple Developer Program membership, which is a paid yearly fee. See [iOS App Store readiness](../product/ios-app-store-readiness.md).

## Verification

Run these before opening a pull request:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

See [workspace conventions](workspace-conventions.md) for package rules, TypeScript configs, and environment variables.
