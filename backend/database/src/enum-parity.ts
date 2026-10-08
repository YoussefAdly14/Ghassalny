// Compile-time guard: Prisma enums must match the shared contracts used by the apps.
// If a value is added or renamed on one side only, `pnpm typecheck` fails here.
import type { SupportedLocale } from '@ghassalny/config';
import type * as Shared from '@ghassalny/contracts';
import type * as Db from './generated/prisma/enums';

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

export type EnumParity = [
  Assert<Equal<Db.UserRole, Shared.UserRole>>,
  Assert<Equal<Db.BookingStatus, Shared.BookingStatus>>,
  Assert<Equal<Db.BookingSource, Shared.BookingSource>>,
  Assert<Equal<Db.VehicleType, Shared.VehicleType>>,
  Assert<Equal<Db.Locale, SupportedLocale>>,
  Assert<Equal<Db.Locale, Shared.SupportedLocaleCode>>,
];
