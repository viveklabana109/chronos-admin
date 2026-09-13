/** Mirrors ADMIN_PERMISSION_CATALOG in app/core/constants.py. */
export const PERM = {
  usersView: 'users.view',
  usersManage: 'users.manage',
  identityReview: 'identity.review',
  listingsReview: 'listings.review',
  catalogManage: 'catalog.manage',
  bannersManage: 'banners.manage',
  marketsManage: 'markets.manage',
  settingsManage: 'settings.manage',
  reportsManage: 'reports.manage',
  payoutsManage: 'payouts.manage',
} as const;

export type Permission = (typeof PERM)[keyof typeof PERM];

/** Fallback labels. The live catalogue comes from `GET /admin/permissions`. */
export const PERMISSION_LABELS: Record<string, string> = {
  [PERM.usersView]: 'View users',
  [PERM.usersManage]: 'Suspend users',
  [PERM.identityReview]: 'Review identity',
  [PERM.listingsReview]: 'Review listings',
  [PERM.catalogManage]: 'Manage catalog',
  [PERM.bannersManage]: 'Manage banners',
  [PERM.marketsManage]: 'Manage markets',
  [PERM.settingsManage]: 'Manage settings',
  [PERM.reportsManage]: 'Handle reports',
  [PERM.payoutsManage]: 'Settle payouts',
};
