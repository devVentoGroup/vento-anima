import { supabase } from "@/lib/supabase";

export async function startAttendanceBreakOnServer(args: {
  siteId: string;
  source: string;
  clientEventId: string;
}): Promise<void> {
  const { error } = await supabase.rpc("start_attendance_break", {
    p_site_id: args.siteId,
    p_source: args.source,
    p_notes: JSON.stringify({ clientEventId: args.clientEventId }),
  });

  if (error) throw error;
}

export async function endAttendanceBreakOnServer(args: {
  source: string;
  clientEventId: string;
}): Promise<void> {
  const { error } = await supabase.rpc("end_attendance_break", {
    p_source: args.source,
    p_notes: JSON.stringify({ clientEventId: args.clientEventId }),
  });

  if (error) throw error;
}
