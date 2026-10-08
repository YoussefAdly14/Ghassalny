# @ghassalny/config

Shared constants, typed environment parsing, and the TypeScript base configs.

## Environment parsing

```ts
import { apiEnvSchema, parseEnv } from '@ghassalny/config';

const env = parseEnv('api', apiEnvSchema, process.env); // throws EnvValidationError listing every problem
```

| Schema              | Used by               |
| ------------------- | --------------------- |
| `apiEnvSchema`      | `backend/api`         |
| `adminWebEnvSchema` | `frontend/admin-web`  |
| `mobileEnvSchema`   | `frontend/mobile`     |
| `databaseEnvSchema` | `@ghassalny/database` |

## Constants

`APP_NAME`, `DEFAULT_TIME_ZONE` (`Africa/Cairo`), `DEFAULT_CURRENCY` (`EGP`), `SUPPORTED_LOCALES`, `RTL_LOCALES`, and `PILOT_MAP_CENTER`.

## TypeScript configs

| Config                                         | For                                         |
| ---------------------------------------------- | ------------------------------------------- |
| `@ghassalny/config/tsconfig/base.json`         | Shared strict defaults                      |
| `@ghassalny/config/tsconfig/library.json`      | Platform-neutral packages                   |
| `@ghassalny/config/tsconfig/node.json`         | API and database tooling                    |
| `@ghassalny/config/tsconfig/nextjs.json`       | Admin web                                   |
| `@ghassalny/config/tsconfig/react-native.json` | iOS app (combine with `expo/tsconfig.base`) |

See [workspace conventions](../../docs/development/workspace-conventions.md).
