export type AttendanceLog = {
  id: string;
  action: "check_in" | "check_out";
  occurred_at: string;
  site_id: string | null;
  sites: { name: string | null } | { name: string | null }[] | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  notes: string | null;
};

export type DerivedLog = AttendanceLog & {
  statusLabel: string;
  durationMinutes: number | null;
  dayKey: string;
};
