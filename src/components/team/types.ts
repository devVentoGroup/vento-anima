export type EmployeeRow = {
  id: string;
  full_name: string;
  alias: string | null;
  role: string;
  site_id: string | null;
  is_active: boolean | null;
  sites?: { id: string; name: string } | null;
};

export type SiteRow = {
  id: string;
  name: string;
  site_type: string | null;
  type: string | null;
  is_active: boolean | null;
};

export type RoleRow = {
  code: string;
  name: string;
  is_active: boolean | null;
};

export type EditFormState = {
  fullName: string;
  alias: string;
  role: string;
  isActive: boolean;
  primarySiteId: string | null;
  siteIds: string[];
};

export type InviteFormState = {
  email: string;
  fullName: string;
  role: string;
  siteId: string | null;
};
