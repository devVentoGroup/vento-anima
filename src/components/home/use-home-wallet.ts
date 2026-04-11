import { useCallback, useState } from "react";

import { useFocusEffect } from "@react-navigation/native";
import { Alert, Linking, Platform } from "react-native";

import type { WalletEligibility } from "@/components/home/types";
import { supabase } from "@/lib/supabase";

type UseHomeWalletArgs = {
  userId: string | null | undefined;
  sessionAccessToken: string | null | undefined;
};

export function useHomeWallet({
  userId,
  sessionAccessToken,
}: UseHomeWalletArgs) {
  const [walletEligibility, setWalletEligibility] =
    useState<WalletEligibility | null>(null);
  const [isLoadingWalletEligibility, setIsLoadingWalletEligibility] =
    useState(false);
  const [isAddingCarnetToWallet, setIsAddingCarnetToWallet] = useState(false);

  const loadWalletEligibility = useCallback(async () => {
    if (!userId) {
      setWalletEligibility(null);
      return;
    }

    setIsLoadingWalletEligibility(true);
    try {
      const { data, error } = await supabase.rpc("employee_wallet_eligibility", {
        p_employee_id: userId,
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setWalletEligibility({
          wallet_eligible: Boolean(row.wallet_eligible),
          contract_active: Boolean(row.contract_active),
          documents_complete: Boolean(row.documents_complete),
          wallet_status: String(row.wallet_status ?? ""),
        });
      } else {
        setWalletEligibility(null);
      }
    } catch (e) {
      console.warn("[HOME] loadWalletEligibility error:", e);
      setWalletEligibility(null);
    } finally {
      setIsLoadingWalletEligibility(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (userId) void loadWalletEligibility();
    }, [userId, loadWalletEligibility]),
  );

  const walletBaseUrl =
    (typeof process !== "undefined" &&
      process.env?.EXPO_PUBLIC_EMPLOYEE_APPLE_PASS_BASE) ||
    process.env.EXPO_PUBLIC_SUPABASE_URL;

  const handleAddCarnetToWallet = useCallback(async () => {
    if (!sessionAccessToken || !userId || isAddingCarnetToWallet) return;

    const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!baseUrl) {
      Alert.alert("Error", "Configuración de la app incompleta.");
      return;
    }

    setIsAddingCarnetToWallet(true);
    try {
      if (Platform.OS === "android") {
        const url = new URL("/functions/v1/employee-wallet-pass", baseUrl);
        const res = await fetch(url.toString(), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sessionAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "No se pudo generar el pase");
        }
        const json = (await res.json()) as { saveUrl?: string };
        const saveUrl = json?.saveUrl;
        if (saveUrl) {
          await Linking.openURL(saveUrl);
        } else {
          throw new Error("No se recibió enlace para agregar a Wallet");
        }
      } else {
        const isCustomAppleBase = Boolean(
          typeof process !== "undefined" &&
            process.env?.EXPO_PUBLIC_EMPLOYEE_APPLE_PASS_BASE,
        );
        const passPath = isCustomAppleBase
          ? "/api/employee-apple-pass"
          : "/functions/v1/employee-apple-pass";
        const passUrl = walletBaseUrl
          ? `${walletBaseUrl.replace(/\/$/, "")}${passPath}?token=${encodeURIComponent(sessionAccessToken)}`
          : `${baseUrl}${passPath}?token=${encodeURIComponent(sessionAccessToken)}`;
        await Linking.openURL(passUrl);
        await supabase.rpc("employee_wallet_mark_issued", {
          p_employee_id: userId,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al agregar el carnet";
      Alert.alert("Error", msg);
    } finally {
      setIsAddingCarnetToWallet(false);
    }
  }, [isAddingCarnetToWallet, sessionAccessToken, userId, walletBaseUrl]);

  return {
    walletEligibility,
    isLoadingWalletEligibility,
    isAddingCarnetToWallet,
    handleAddCarnetToWallet,
  };
}
