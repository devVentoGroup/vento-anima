import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import { supabase } from "@/lib/supabase";
import type { LaborCardEligibility } from "@/components/carnet/types";

type UseLaborCardEligibilityArgs = {
  userId: string | null | undefined;
};

export function useLaborCardEligibility({ userId }: UseLaborCardEligibilityArgs) {
  const [eligibility, setEligibility] = useState<LaborCardEligibility | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadEligibility = useCallback(async () => {
    if (!userId) {
      setEligibility(null);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("employee_wallet_eligibility", {
        p_employee_id: userId,
      });
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : null;
      if (row) {
        setEligibility({
          wallet_eligible: Boolean(row.wallet_eligible),
          contract_active: Boolean(row.contract_active),
          documents_complete: Boolean(row.documents_complete),
          wallet_status: String(row.wallet_status ?? ""),
        });
      } else {
        setEligibility(null);
      }
    } catch (error) {
      console.warn("[CARNET] eligibility error:", error);
      setEligibility(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void loadEligibility();
    }, [loadEligibility]),
  );

  return {
    eligibility,
    isLoading,
    refresh: loadEligibility,
  };
}
