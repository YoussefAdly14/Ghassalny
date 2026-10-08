// Local development seed: `pnpm db:seed`.
// Wipes every Ghassalny table, then inserts a demo operator with Cairo and Giza branches,
// services, hours, staff, a customer with vehicles, and sample bookings.
import 'dotenv/config';
import { createDatabaseClient } from '../src/client';
import type { BookingStatus, DayOfWeek } from '../src/generated/prisma/enums';
import {
  DEMO_PASSWORD,
  branches,
  demoOrganization,
  services,
  stationBrands,
  users,
} from './seed/data';
import { hashPassword } from './seed/password';
import { addMinutes, cairoTime } from './seed/time';

const TABLES = [
  'booking_status_history',
  'bookings',
  'availability_blocks',
  'branch_working_hours',
  'branch_services',
  'branch_staff_assignments',
  'services',
  'branches',
  'station_brands',
  'vehicles',
  'user_role_assignments',
  'users',
  'organizations',
];

function assertSafeTarget() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed: NODE_ENV is production.');
  }
  const host = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost').hostname;
  const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
  if (!isLocal && process.env.SEED_ALLOW_REMOTE !== 'true') {
    throw new Error(
      `Refusing to seed non-local database host "${host}". Set SEED_ALLOW_REMOTE=true to override.`,
    );
  }
}

/** EGP price in piasters, rounded to the nearest 5 EGP. */
function priceMinorUnits(baseEgp: number, factor: number): number {
  return Math.round((baseEgp * factor) / 5) * 5 * 100;
}

async function main() {
  assertSafeTarget();
  const db = createDatabaseClient();

  try {
    await db.$executeRawUnsafe(
      `TRUNCATE TABLE ${TABLES.map((table) => `"${table}"`).join(', ')} CASCADE`,
    );

    const organization = await db.organization.create({ data: demoOrganization });
    const orgId = organization.id;

    const brandIds = new Map<string, string>();
    for (const brand of stationBrands) {
      const created = await db.stationBrand.create({ data: brand });
      brandIds.set(brand.slug, created.id);
    }

    // Users and roles -----------------------------------------------------------------------
    const passwordHash = hashPassword(DEMO_PASSWORD);
    const createUser = (user: { email: string; fullName: string; phone: string }) =>
      db.user.create({ data: { ...user, passwordHash } });

    const platformAdmin = await createUser(users.platformAdmin);
    const businessAdmin = await createUser(users.businessAdmin);
    const worker = await createUser(users.worker);
    const customer = await createUser(users.customer);

    await db.userRoleAssignment.createMany({
      data: [
        { userId: platformAdmin.id, role: 'PLATFORM_ADMIN' },
        { userId: businessAdmin.id, role: 'BUSINESS_ADMIN', organizationId: orgId },
        { userId: worker.id, role: 'WORKER', organizationId: orgId },
        { userId: customer.id, role: 'CUSTOMER' },
      ],
    });

    // Service catalog ----------------------------------------------------------------------
    const serviceIds = new Map<string, string>();
    for (const [index, service] of services.entries()) {
      const created = await db.service.create({
        data: {
          organizationId: orgId,
          name: service.name,
          nameAr: service.nameAr,
          description: service.description,
          descriptionAr: service.descriptionAr,
          sortOrder: index,
        },
      });
      serviceIds.set(service.key, created.id);
    }

    // Branches, hours, and pricing ---------------------------------------------------------
    const branchIds = new Map<string, string>();
    for (const branch of branches) {
      const { stationBrand, priceFactor, hours, ...fields } = branch;
      const created = await db.branch.create({
        data: { ...fields, organizationId: orgId, stationBrandId: brandIds.get(stationBrand) },
      });
      branchIds.set(branch.slug, created.id);

      await db.branchWorkingHours.createMany({
        data: Object.entries(hours).flatMap(([day, intervals]) =>
          (intervals ?? []).map(([opensAtMinute, closesAtMinute]) => ({
            organizationId: orgId,
            branchId: created.id,
            dayOfWeek: day as DayOfWeek,
            opensAtMinute,
            closesAtMinute,
          })),
        ),
      });

      await db.branchService.createMany({
        data: services.map((service) => ({
          organizationId: orgId,
          branchId: created.id,
          serviceId: serviceIds.get(service.key)!,
          priceMinorUnits: priceMinorUnits(service.basePriceEgp, priceFactor),
          durationMinutes: service.durationMinutes,
          // Full detailing needs equipment only the larger branches have.
          isActive: service.key !== 'full-detail' || branch.washBays >= 2,
        })),
      });
    }

    const pilotBranchId = branchIds.get('nasr-city-abbas-el-akkad')!;
    await db.branchStaffAssignment.create({
      data: { organizationId: orgId, branchId: pilotBranchId, userId: worker.id },
    });

    // Customer vehicles --------------------------------------------------------------------
    const sedan = await db.vehicle.create({
      data: {
        ownerId: customer.id,
        nickname: 'Daily car',
        plateNumber: 'أ ب ج 1234',
        vehicleType: 'SEDAN',
        make: 'Toyota',
        model: 'Corolla',
        color: 'White',
      },
    });
    await db.vehicle.create({
      data: {
        ownerId: customer.id,
        nickname: 'Family SUV',
        plateNumber: 'س ص ع 5678',
        vehicleType: 'SUV',
        make: 'Hyundai',
        model: 'Tucson',
        color: 'Grey',
      },
    });

    // Availability block: maintenance tomorrow afternoon at the pilot branch ----------------
    await db.availabilityBlock.create({
      data: {
        organizationId: orgId,
        branchId: pilotBranchId,
        startsAt: cairoTime(1, 14),
        endsAt: cairoTime(1, 16),
        reason: 'MAINTENANCE',
        note: 'Pressure washer service',
        createdByUserId: worker.id,
      },
    });

    // Sample bookings at the pilot branch --------------------------------------------------
    const pilotPricing = await db.branchService.findMany({
      where: { branchId: pilotBranchId },
      include: { service: true },
    });
    const pricingFor = (key: string) => {
      const pricing = pilotPricing.find((entry) => entry.serviceId === serviceIds.get(key));
      if (!pricing) throw new Error(`Missing pilot pricing for ${key}`);
      return pricing;
    };

    type BookingSeed = {
      reference: string;
      serviceKey: string;
      startsAt: Date;
      bayNumber: number;
      walkIn?: { name: string; phone: string };
      statuses: BookingStatus[];
    };

    const bookingSeeds: BookingSeed[] = [
      {
        reference: 'GHDEMO01',
        serviceKey: 'interior-exterior',
        startsAt: cairoTime(-1, 12),
        bayNumber: 1,
        statuses: ['CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'],
      },
      {
        reference: 'GHDEMO02',
        serviceKey: 'exterior',
        startsAt: cairoTime(0, 18),
        bayNumber: 1,
        statuses: ['CONFIRMED'],
      },
      {
        reference: 'GHDEMO03',
        serviceKey: 'engine',
        startsAt: cairoTime(0, 18),
        bayNumber: 2,
        walkIn: { name: 'Ahmed (walk-in)', phone: '+201000000201' },
        statuses: ['CONFIRMED'],
      },
      {
        reference: 'GHDEMO04',
        serviceKey: 'exterior',
        startsAt: cairoTime(1, 10),
        bayNumber: 1,
        statuses: ['CONFIRMED'],
      },
      {
        // Cancelled bookings release their bay, so this may overlap GHDEMO04.
        reference: 'GHDEMO05',
        serviceKey: 'interior-exterior',
        startsAt: cairoTime(1, 10),
        bayNumber: 1,
        statuses: ['CONFIRMED', 'CANCELLED'],
      },
    ];

    for (const seed of bookingSeeds) {
      const pricing = pricingFor(seed.serviceKey);
      const isWalkIn = Boolean(seed.walkIn);
      const actor = isWalkIn ? worker : customer;
      const finalStatus = seed.statuses.at(-1)!;

      await db.booking.create({
        data: {
          reference: seed.reference,
          organizationId: orgId,
          branchId: pilotBranchId,
          serviceId: pricing.serviceId,
          customerId: isWalkIn ? null : customer.id,
          vehicleId: isWalkIn ? null : sedan.id,
          source: isWalkIn ? 'WALK_IN' : 'CUSTOMER_APP',
          status: finalStatus,
          startsAt: seed.startsAt,
          endsAt: addMinutes(seed.startsAt, pricing.durationMinutes),
          bayNumber: seed.bayNumber,
          serviceName: pricing.service.name,
          durationMinutes: pricing.durationMinutes,
          priceMinorUnits: pricing.priceMinorUnits,
          currency: pricing.currency,
          contactName: seed.walkIn?.name ?? customer.fullName,
          contactPhone: seed.walkIn?.phone ?? customer.phone,
          vehicleType: isWalkIn ? 'HATCHBACK' : sedan.vehicleType,
          vehiclePlate: isWalkIn ? null : sedan.plateNumber,
          createdByUserId: actor.id,
          cancelledAt: finalStatus === 'CANCELLED' ? new Date() : null,
          cancellationReason: finalStatus === 'CANCELLED' ? 'Plans changed' : null,
          statusHistory: {
            create: seed.statuses.map((toStatus, index) => ({
              fromStatus: index === 0 ? null : seed.statuses[index - 1],
              toStatus,
              changedByUserId: index === 0 || toStatus === 'CANCELLED' ? actor.id : worker.id,
            })),
          },
        },
      });
    }

    const counts = {
      branches: await db.branch.count(),
      services: await db.service.count(),
      branchServices: await db.branchService.count(),
      workingHours: await db.branchWorkingHours.count(),
      users: await db.user.count(),
      bookings: await db.booking.count(),
    };
    console.warn('Seeded Ghassalny demo data:', counts);
    console.warn(`Demo accounts use the password "${DEMO_PASSWORD}":`);
    for (const user of Object.values(users)) console.warn(`  ${user.email}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
