// Local development data for a Cairo and Giza pilot. Every name, brand, and phone number here is
// fictional demo data. Coordinates are approximate points in real neighbourhoods so distance
// search behaves realistically.
import type { BranchStatus, DayOfWeek } from '../../src/generated/prisma/enums';

export const DEMO_PASSWORD = 'Ghassalny123!';

export const demoOrganization = { name: 'Ghassalny Demo Wash Co.', slug: 'demo-wash' };

export const stationBrands = [
  { name: 'Nile Fuel', slug: 'nile-fuel' },
  { name: 'Horus Petroleum', slug: 'horus-petroleum' },
  { name: 'Lotus Energy', slug: 'lotus-energy' },
] as const;

type StationBrandSlug = (typeof stationBrands)[number]['slug'];

/** Hours per day as [opensAtMinute, closesAtMinute] intervals in Cairo time. */
type WeeklyHours = Partial<Record<DayOfWeek, ReadonlyArray<readonly [number, number]>>>;

const h = (hour: number, minute = 0) => hour * 60 + minute;

const ALL_DAYS: DayOfWeek[] = [
  'SATURDAY',
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
];

function everyDay(intervals: ReadonlyArray<readonly [number, number]>): WeeklyHours {
  return Object.fromEntries(ALL_DAYS.map((day) => [day, intervals]));
}

/** 08:00-23:00 daily, with a break for Friday prayer. */
const standardHours: WeeklyHours = {
  ...everyDay([[h(8), h(23)]]),
  FRIDAY: [
    [h(8), h(11, 30)],
    [h(13, 30), h(23)],
  ],
};

export type BranchSeed = {
  slug: string;
  name: string;
  nameAr: string;
  stationBrand: StationBrandSlug;
  status: BranchStatus;
  addressLine: string;
  addressLineAr: string;
  area: string;
  areaAr: string;
  city: string;
  latitude: number;
  longitude: number;
  phone: string;
  washBays: number;
  /** Multiplies the base service prices (premium areas cost more). */
  priceFactor: number;
  hours: WeeklyHours;
};

export const branches: BranchSeed[] = [
  {
    slug: 'nasr-city-abbas-el-akkad',
    name: 'Nile Fuel Nasr City',
    nameAr: 'نايل فيول مدينة نصر',
    stationBrand: 'nile-fuel',
    status: 'ACTIVE',
    addressLine: 'Abbas El Akkad St, Nasr City',
    addressLineAr: 'شارع عباس العقاد، مدينة نصر',
    area: 'Nasr City',
    areaAr: 'مدينة نصر',
    city: 'Cairo',
    latitude: 30.0596,
    longitude: 31.3389,
    phone: '+201000000101',
    washBays: 2,
    priceFactor: 1,
    hours: standardHours,
  },
  {
    slug: 'heliopolis-merghany',
    name: 'Horus Petroleum Heliopolis',
    nameAr: 'حورس للبترول مصر الجديدة',
    stationBrand: 'horus-petroleum',
    status: 'ACTIVE',
    addressLine: 'El Merghany St, Heliopolis',
    addressLineAr: 'شارع الميرغني، مصر الجديدة',
    area: 'Heliopolis',
    areaAr: 'مصر الجديدة',
    city: 'Cairo',
    latitude: 30.0911,
    longitude: 31.33,
    phone: '+201000000102',
    washBays: 1,
    priceFactor: 1.1,
    hours: standardHours,
  },
  {
    slug: 'maadi-road-9',
    name: 'Lotus Energy Maadi',
    nameAr: 'لوتس للطاقة المعادي',
    stationBrand: 'lotus-energy',
    status: 'ACTIVE',
    addressLine: 'Road 9, Maadi',
    addressLineAr: 'شارع ٩، المعادي',
    area: 'Maadi',
    areaAr: 'المعادي',
    city: 'Cairo',
    latitude: 29.9602,
    longitude: 31.2569,
    phone: '+201000000103',
    washBays: 2,
    priceFactor: 1.15,
    hours: { ...standardHours, FRIDAY: [] },
  },
  {
    slug: 'new-cairo-90th-street',
    name: 'Nile Fuel New Cairo',
    nameAr: 'نايل فيول القاهرة الجديدة',
    stationBrand: 'nile-fuel',
    status: 'ACTIVE',
    addressLine: 'South 90th St, Fifth Settlement',
    addressLineAr: 'شارع التسعين الجنوبي، التجمع الخامس',
    area: 'New Cairo',
    areaAr: 'القاهرة الجديدة',
    city: 'Cairo',
    latitude: 30.0254,
    longitude: 31.4705,
    phone: '+201000000104',
    washBays: 3,
    priceFactor: 1.3,
    hours: everyDay([[h(0), h(24)]]),
  },
  {
    slug: 'mohandessin-gameat-el-dowal',
    name: 'Horus Petroleum Mohandessin',
    nameAr: 'حورس للبترول المهندسين',
    stationBrand: 'horus-petroleum',
    status: 'ACTIVE',
    addressLine: 'Gameat El Dowal El Arabeya St, Mohandessin',
    addressLineAr: 'شارع جامعة الدول العربية، المهندسين',
    area: 'Mohandessin',
    areaAr: 'المهندسين',
    city: 'Giza',
    latitude: 30.0561,
    longitude: 31.2005,
    phone: '+201000000105',
    washBays: 1,
    priceFactor: 1.1,
    hours: standardHours,
  },
  {
    slug: 'sheikh-zayed-central-axis',
    name: 'Lotus Energy Sheikh Zayed',
    nameAr: 'لوتس للطاقة الشيخ زايد',
    stationBrand: 'lotus-energy',
    status: 'ACTIVE',
    addressLine: 'Central Axis, Sheikh Zayed City',
    addressLineAr: 'المحور المركزي، مدينة الشيخ زايد',
    area: 'Sheikh Zayed',
    areaAr: 'الشيخ زايد',
    city: 'Giza',
    latitude: 30.0441,
    longitude: 30.9807,
    phone: '+201000000106',
    washBays: 2,
    priceFactor: 1.25,
    hours: standardHours,
  },
  {
    slug: 'october-26-july-axis',
    name: 'Nile Fuel 6th of October',
    nameAr: 'نايل فيول السادس من أكتوبر',
    stationBrand: 'nile-fuel',
    status: 'DRAFT',
    addressLine: '26th of July Axis, 6th of October City',
    addressLineAr: 'محور ٢٦ يوليو، مدينة السادس من أكتوبر',
    area: '6th of October',
    areaAr: 'السادس من أكتوبر',
    city: 'Giza',
    latitude: 29.9668,
    longitude: 30.9447,
    phone: '+201000000107',
    washBays: 1,
    priceFactor: 1,
    hours: standardHours,
  },
];

export type ServiceSeed = {
  key: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  /** Base price in EGP before the branch price factor. */
  basePriceEgp: number;
  durationMinutes: number;
};

export const services: ServiceSeed[] = [
  {
    key: 'exterior',
    name: 'Exterior Wash',
    nameAr: 'غسيل خارجي',
    description: 'Hand wash, rinse, and dry of the car body, wheels, and windows.',
    descriptionAr: 'غسيل يدوي وشطف وتجفيف لجسم السيارة والجنوط والزجاج.',
    basePriceEgp: 150,
    durationMinutes: 30,
  },
  {
    key: 'interior-exterior',
    name: 'Interior & Exterior Wash',
    nameAr: 'غسيل داخلي وخارجي',
    description: 'Exterior wash plus vacuuming, dashboard wipe-down, and interior glass.',
    descriptionAr: 'غسيل خارجي مع شفط الأتربة وتنظيف التابلوه والزجاج من الداخل.',
    basePriceEgp: 250,
    durationMinutes: 60,
  },
  {
    key: 'engine',
    name: 'Engine Bay Cleaning',
    nameAr: 'تنظيف الموتور',
    description: 'Degreasing and careful cleaning of the engine bay.',
    descriptionAr: 'إزالة الشحوم وتنظيف دقيق لغرفة الموتور.',
    basePriceEgp: 200,
    durationMinutes: 30,
  },
  {
    key: 'full-detail',
    name: 'Full Detailing',
    nameAr: 'تلميع وتنظيف شامل',
    description: 'Deep interior cleaning, upholstery shampoo, polish, and wax.',
    descriptionAr: 'تنظيف داخلي عميق وغسيل الفرش وتلميع وتشميع.',
    basePriceEgp: 900,
    durationMinutes: 180,
  },
];

export const users = {
  platformAdmin: {
    email: 'platform@ghassalny.test',
    fullName: 'Platform Admin',
    phone: '+201000000001',
  },
  businessAdmin: {
    email: 'admin@ghassalny.test',
    fullName: 'Mona Business Admin',
    phone: '+201000000002',
  },
  worker: {
    email: 'worker@ghassalny.test',
    fullName: 'Karim Station Worker',
    phone: '+201000000003',
  },
  customer: { email: 'customer@ghassalny.test', fullName: 'Omar Customer', phone: '+201000000004' },
} as const;
