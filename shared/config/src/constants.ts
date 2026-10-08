export const APP_NAME = 'Ghassalny';

/** Egypt observes daylight saving time, so always use the IANA zone rather than a fixed offset. */
export const DEFAULT_TIME_ZONE = 'Africa/Cairo';

export const DEFAULT_CURRENCY = 'EGP';

export const SUPPORTED_LOCALES = ['en', 'ar'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export const RTL_LOCALES: readonly SupportedLocale[] = ['ar'];

/**
 * Map center used when the customer has not shared their location. Location permission is
 * optional on iOS, so discovery must always work without it.
 */
export const PILOT_MAP_CENTER = {
  label: 'Cairo',
  latitude: 30.0444,
  longitude: 31.2357,
} as const;
