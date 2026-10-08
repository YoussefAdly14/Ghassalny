-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'DELETED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'WORKER', 'BUSINESS_ADMIN', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('en', 'ar');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('SEDAN', 'HATCHBACK', 'SUV', 'PICKUP', 'VAN');

-- CreateEnum
CREATE TYPE "BranchStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY');

-- CreateEnum
CREATE TYPE "AvailabilityBlockReason" AS ENUM ('CLOSURE', 'MAINTENANCE', 'BREAK', 'OTHER');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('CUSTOMER_APP', 'WALK_IN');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "full_name" TEXT NOT NULL,
    "password_hash" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "preferred_locale" "Locale" NOT NULL DEFAULT 'en',
    "last_login_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role_assignments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "organization_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "nickname" TEXT,
    "plate_number" TEXT NOT NULL,
    "vehicle_type" "VehicleType" NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "color" TEXT,
    "notes" TEXT,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "station_brands" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "station_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "station_brand_id" UUID,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "slug" TEXT NOT NULL,
    "status" "BranchStatus" NOT NULL DEFAULT 'DRAFT',
    "phone" TEXT,
    "address_line" TEXT NOT NULL,
    "address_line_ar" TEXT,
    "area" TEXT NOT NULL,
    "area_ar" TEXT,
    "city" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "time_zone" TEXT NOT NULL DEFAULT 'Africa/Cairo',
    "wash_bays" INTEGER NOT NULL DEFAULT 1,
    "slot_interval_minutes" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_staff_assignments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_staff_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "description" TEXT,
    "description_ar" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_services" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "price_minor_units" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "duration_minutes" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "branch_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_working_hours" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "day_of_week" "DayOfWeek" NOT NULL,
    "opens_at_minute" INTEGER NOT NULL,
    "closes_at_minute" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "branch_working_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_blocks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "reason" "AvailabilityBlockReason" NOT NULL,
    "note" TEXT,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "availability_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "customer_id" UUID,
    "vehicle_id" UUID,
    "source" "BookingSource" NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "bay_number" INTEGER NOT NULL,
    "service_name" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "price_minor_units" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "contact_phone" TEXT,
    "vehicle_type" "VehicleType",
    "vehicle_plate" TEXT,
    "notes" TEXT,
    "created_by_user_id" UUID,
    "cancelled_at" TIMESTAMPTZ(3),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_history" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "from_status" "BookingStatus",
    "to_status" "BookingStatus" NOT NULL,
    "changed_by_user_id" UUID,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "user_role_assignments_organization_id_role_idx" ON "user_role_assignments"("organization_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "user_role_assignments_user_id_role_organization_id_key" ON "user_role_assignments"("user_id", "role", "organization_id");

-- CreateIndex
CREATE INDEX "vehicles_owner_id_idx" ON "vehicles"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "station_brands_slug_key" ON "station_brands"("slug");

-- CreateIndex
CREATE INDEX "branches_status_latitude_longitude_idx" ON "branches"("status", "latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "branches_id_organization_id_key" ON "branches"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "branches_organization_id_slug_key" ON "branches"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "branch_staff_assignments_user_id_idx" ON "branch_staff_assignments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "branch_staff_assignments_branch_id_user_id_key" ON "branch_staff_assignments"("branch_id", "user_id");

-- CreateIndex
CREATE INDEX "services_organization_id_idx" ON "services"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "services_id_organization_id_key" ON "services"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "branch_services_branch_id_service_id_key" ON "branch_services"("branch_id", "service_id");

-- CreateIndex
CREATE UNIQUE INDEX "branch_working_hours_branch_id_day_of_week_opens_at_minute_key" ON "branch_working_hours"("branch_id", "day_of_week", "opens_at_minute");

-- CreateIndex
CREATE INDEX "availability_blocks_branch_id_starts_at_idx" ON "availability_blocks"("branch_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_reference_key" ON "bookings"("reference");

-- CreateIndex
CREATE INDEX "bookings_branch_id_starts_at_idx" ON "bookings"("branch_id", "starts_at");

-- CreateIndex
CREATE INDEX "bookings_customer_id_starts_at_idx" ON "bookings"("customer_id", "starts_at");

-- CreateIndex
CREATE INDEX "bookings_organization_id_starts_at_idx" ON "bookings"("organization_id", "starts_at");

-- CreateIndex
CREATE INDEX "booking_status_history_booking_id_created_at_idx" ON "booking_status_history"("booking_id", "created_at");

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_station_brand_id_fkey" FOREIGN KEY ("station_brand_id") REFERENCES "station_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_staff_assignments" ADD CONSTRAINT "branch_staff_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_staff_assignments" ADD CONSTRAINT "branch_staff_assignments_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_staff_assignments" ADD CONSTRAINT "branch_staff_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_services" ADD CONSTRAINT "branch_services_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_services" ADD CONSTRAINT "branch_services_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_services" ADD CONSTRAINT "branch_services_service_id_organization_id_fkey" FOREIGN KEY ("service_id", "organization_id") REFERENCES "services"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_working_hours" ADD CONSTRAINT "branch_working_hours_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_working_hours" ADD CONSTRAINT "branch_working_hours_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_organization_id_fkey" FOREIGN KEY ("service_id", "organization_id") REFERENCES "services"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================================
-- Constraints Prisma cannot express in schema.prisma.
-- Keep in sync with docs/architecture/booking-engine-invariants.md.
-- =============================================================================================

-- GiST support for "=" on scalar columns inside exclusion constraints.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Users -----------------------------------------------------------------------------------------
ALTER TABLE "users"
  ADD CONSTRAINT "users_email_lowercase_check" CHECK ("email" = lower("email"));

-- Role assignments: tenant roles need an organization, global roles must not have one.
ALTER TABLE "user_role_assignments"
  ADD CONSTRAINT "user_role_assignments_scope_check"
  CHECK (("role" IN ('WORKER', 'BUSINESS_ADMIN')) = ("organization_id" IS NOT NULL));

-- The composite unique index treats NULL organization ids as distinct, so add one for global roles.
CREATE UNIQUE INDEX "user_role_assignments_global_role_key"
  ON "user_role_assignments" ("user_id", "role")
  WHERE "organization_id" IS NULL;

-- Branches --------------------------------------------------------------------------------------
ALTER TABLE "branches"
  ADD CONSTRAINT "branches_coordinates_check"
    CHECK ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180),
  ADD CONSTRAINT "branches_wash_bays_check" CHECK ("wash_bays" BETWEEN 1 AND 50),
  ADD CONSTRAINT "branches_slot_interval_check" CHECK ("slot_interval_minutes" BETWEEN 5 AND 240);

-- Branch services -------------------------------------------------------------------------------
ALTER TABLE "branch_services"
  ADD CONSTRAINT "branch_services_price_check" CHECK ("price_minor_units" >= 0),
  ADD CONSTRAINT "branch_services_duration_check" CHECK ("duration_minutes" BETWEEN 1 AND 1440);

-- Working hours: valid range, and no overlapping intervals on the same branch and day.
ALTER TABLE "branch_working_hours"
  ADD CONSTRAINT "branch_working_hours_range_check"
    CHECK ("opens_at_minute" >= 0 AND "opens_at_minute" < "closes_at_minute" AND "closes_at_minute" <= 1440),
  ADD CONSTRAINT "branch_working_hours_no_overlap"
    EXCLUDE USING gist (
      "branch_id" WITH =,
      "day_of_week" WITH =,
      int4range("opens_at_minute", "closes_at_minute") WITH &&
    );

-- Availability blocks ---------------------------------------------------------------------------
ALTER TABLE "availability_blocks"
  ADD CONSTRAINT "availability_blocks_range_check" CHECK ("ends_at" > "starts_at");

-- Bookings --------------------------------------------------------------------------------------
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_range_check" CHECK ("ends_at" > "starts_at"),
  ADD CONSTRAINT "bookings_bay_number_check" CHECK ("bay_number" >= 1),
  ADD CONSTRAINT "bookings_duration_check" CHECK ("duration_minutes" BETWEEN 1 AND 1440),
  ADD CONSTRAINT "bookings_price_check" CHECK ("price_minor_units" >= 0),
  -- Invariant 2.3: capacity-holding bookings never overlap on the same branch bay.
  -- Intervals are half-open, so back-to-back bookings are allowed.
  ADD CONSTRAINT "bookings_no_overlap_per_bay"
    EXCLUDE USING gist (
      "branch_id" WITH =,
      "bay_number" WITH =,
      tstzrange("starts_at", "ends_at", '[)') WITH &&
    ) WHERE ("status" IN ('CONFIRMED', 'ARRIVED', 'IN_PROGRESS'));
