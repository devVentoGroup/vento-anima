export type DocumentScope = "employee" | "site" | "group";
export type DocumentStatus = "pending_review" | "approved" | "rejected";

export type DocumentType = {
  id: string;
  name: string;
  scope: DocumentScope;
  requires_expiry: boolean;
  validity_months: number | null;
  reminder_days: number | null;
  is_active: boolean;
  display_order?: number | null;
};

export type SiteOption = {
  id: string;
  name: string;
};

export type DocumentRow = {
  id: string;
  title: string;
  description: string | null;
  status: DocumentStatus;
  scope: DocumentScope;
  site_id: string | null;
  target_employee_id: string | null;
  document_type_id: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  storage_path: string;
  file_name: string;
  updated_at: string;
  document_type: DocumentType | null;
};

export type DocumentRowDb = Omit<DocumentRow, "document_type"> & {
  document_type: DocumentType[] | DocumentType | null;
};

export type SelectedFile = {
  uri: string;
  name: string;
  size: number | null;
  mime: string;
};

export type AvailableEmployee = {
  id: string;
  full_name: string;
};

export type EmployeeSiteOption = {
  siteId: string;
  siteName: string;
};
