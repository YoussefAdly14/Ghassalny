import { apiEnvSchema, parseEnv, type ApiEnv, type EnvSource } from '@ghassalny/config';

export type ApiConfig = ApiEnv;

/** Validates the API environment. Throws EnvValidationError listing every problem. */
export function loadConfig(source: EnvSource): ApiConfig {
  return parseEnv('api', apiEnvSchema, source);
}
