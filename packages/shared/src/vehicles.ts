import { createEnumGuard, type EnumValue } from './enum';

/** Vehicle size classes. Egyptian car washes commonly price by size, so this drives service pricing. */
export const VehicleType = {
  SEDAN: 'SEDAN',
  HATCHBACK: 'HATCHBACK',
  SUV: 'SUV',
  PICKUP: 'PICKUP',
  VAN: 'VAN',
} as const;
export type VehicleType = EnumValue<typeof VehicleType>;

export const VEHICLE_TYPES = Object.values(VehicleType);
export const isVehicleType = createEnumGuard(VehicleType);
