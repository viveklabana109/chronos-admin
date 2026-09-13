/** Shapes as the API actually returns them (captured from a live server). */

export type IdentityFile = {
  id: string;
  fileType: string;
  documentType: string | null;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  fileUrl: string;
  status: string;
  createdAt: string;
};

export type IdentitySubmission = {
  id: string;
  status: string;
  fullLegalName: string;
  addressLine1: string;
  city: string;
  country: string;
  reviewNotes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  governmentIdFile: IdentityFile | null;
  selfieFile: IdentityFile | null;
};

export type ProviderListing = {
  id: string;
  providerId: string;
  displayName: string;
  title: string;
  category: string;
  categories: string[];
  description: string;
  hourlyRate: number;
  rateCard: { durationHours: number; price: number; effectiveHourlyRate: number }[];
  currency: string;
  experienceTier: string;
  location: string;
  status: string;
  reviewNotes: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  pausedAt: string | null;
  portfolioImages: { id: string; fileUrl: string }[];
};

export type AdminUser = {
  id: string;
  loginId: string | null;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  role: string | null;
  isEmailVerified: boolean;
  isIdentityVerified: boolean;
  accountStatus: string;
  legalName: string | null;
  city: string | null;
  country: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
  identitySubmission: IdentitySubmission | null;
  providerListing: ProviderListing | null;
  documents: { identityFiles: IdentityFile[] } | null;
};

export type Category = {
  id: string;
  slug: string;
  value: string;
  label: string;
  icon: string;
  image: string;
  sortOrder: number;
  isActive: boolean;
};

export type Tier = {
  id: string;
  value: string;
  label: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
};

export type DocumentType = {
  docType: string;
  label: string;
  requiresFile: boolean;
  requiresValue: boolean;
  isActive: boolean;
};

export type Setting = {
  key: string;
  group: string;
  label: string;
  description: string;
  type: 'decimal' | 'int' | 'bool' | 'timezone';
  value: string;
  default: string;
  /** What the key is: 'super' means an auth or abuse limit, which only a super
   *  admin may write. Every tier is readable by anyone holding settings.manage. */
  tier: 'admin' | 'super';
  /** What *this* administrator may do with it — the server decides, the panel
   *  only renders it. Never infer this from `tier` alone. */
  canEdit: boolean;
  isOverridden: boolean;
  min: string | null;
  max: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type Currency = {
  code: string;
  symbol: string;
  locale: string;
  rate: string;
  decimalDigits: number;
  sortOrder: number;
  isActive: boolean;
  updatedAt: string | null;
};

export type MarketCity = {
  id: string;
  city: string;
  cityKey: string;
  aliasKeys: string[];
  status: string;
  timezone: string;
  note: string;
  sortOrder: number;
};

export type Market = {
  id: string;
  country: string;
  countryKey: string;
  aliasKeys: string[];
  countryCode: string;
  status: string;
  timezone: string;
  note: string;
  sortOrder: number;
  cities: MarketCity[];
};

/**
 * Banners are asymmetric: reads nest the targeting fields under `targeting`,
 * writes take them flat (`targetRoles`, `targetMinAge`, …). Both shapes are
 * spelled out so the page cannot quietly send the wrong one.
 */
export type Banner = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  ctaLabel: string;
  actionType: string;
  actionValue: string;
  backgroundColor: string;
  placement: string;
  sortOrder: number;
  isActive: boolean;
  isLive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  targeting: {
    isTargeted: boolean;
    roles: string[];
    minAge: number | null;
    maxAge: number | null;
    cities: string[];
    lat: number | null;
    lng: number | null;
    radiusKm: number | null;
  };
};

export type Report = {
  id: string;
  status: string;
  reason?: string;
  details?: string;
  reporterId?: string;
  targetType?: string;
  targetId?: string;
  createdAt?: string;
  [key: string]: unknown;
};

export type Payout = {
  id: string;
  userId?: string;
  amount?: number | string;
  currency?: string;
  status: string;
  method?: string;
  reason?: string | null;
  createdAt?: string;
  [key: string]: unknown;
};
