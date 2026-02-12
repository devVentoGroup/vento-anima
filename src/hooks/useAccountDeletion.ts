import { useCallback, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type FullDeletionRequest = {
  id: string;
  status: string;
  execute_after: string | null;
  requested_at: string;
  canceled_at: string | null;
  completed_at: string | null;
};

type ActionResult = {
  success: boolean;
  error?: string;
};

export function useAccountDeletion(session: Session | null) {
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<FullDeletionRequest | null>(null);

  const userId = session?.user?.id ?? null;

  const refreshStatus = useCallback(async (): Promise<ActionResult> => {
    if (!userId) {
      setPendingRequest(null);
      return { success: false, error: "No hay sesión activa." };
    }

    setLoadingStatus(true);
    const { data, error } = await supabase
      .from("account_deletion_requests")
      .select("id, status, execute_after, requested_at, canceled_at, completed_at")
      .eq("user_id", userId)
      .eq("request_type", "full_account")
      .in("status", ["pending", "processing"])
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setLoadingStatus(false);

    if (error) {
      return { success: false, error: error.message };
    }

    setPendingRequest((data as FullDeletionRequest | null) ?? null);
    return { success: true };
  }, [userId]);

  const invokeAction = useCallback(async (body: Record<string, unknown>): Promise<ActionResult> => {
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("account-deletion", { body });
    setSubmitting(false);

    if (error) return { success: false, error: error.message };
    if (!data?.success) return { success: false, error: data?.error || "No se pudo completar la acción." };
    return { success: true };
  }, []);

  const requestFullDeletion = useCallback(async (): Promise<ActionResult> => {
    const result = await invokeAction({
      action: "request_full_deletion",
      confirmation: {
        otp_verified: true,
        phrase_verified: true,
      },
    });

    if (result.success) {
      await refreshStatus();
    }
    return result;
  }, [invokeAction, refreshStatus]);

  const requestDataCleanup = useCallback(async (): Promise<ActionResult> => {
    return invokeAction({ action: "request_data_cleanup" });
  }, [invokeAction]);

  const cancelFullDeletion = useCallback(async (): Promise<ActionResult> => {
    const result = await invokeAction({ action: "cancel_full_deletion" });
    if (result.success) {
      await refreshStatus();
    }
    return result;
  }, [invokeAction, refreshStatus]);

  return useMemo(
    () => ({
      loadingStatus,
      submitting,
      pendingRequest,
      refreshStatus,
      requestFullDeletion,
      requestDataCleanup,
      cancelFullDeletion,
    }),
    [
      loadingStatus,
      submitting,
      pendingRequest,
      refreshStatus,
      requestFullDeletion,
      requestDataCleanup,
      cancelFullDeletion,
    ],
  );
}

