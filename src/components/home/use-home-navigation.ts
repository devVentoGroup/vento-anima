import { useCallback } from "react";

import type { Router } from "expo-router";

type UseHomeNavigationArgs = {
  router: Router;
  signOut: () => Promise<unknown> | unknown;
  setIsUserMenuOpen: (value: boolean) => void;
  setIsSitePickerOpen: (value: boolean) => void;
  setActionError: (value: string | null) => void;
  selectSiteForCheckIn: (siteId: string) => Promise<unknown> | unknown;
};

export function useHomeNavigation({
  router,
  signOut,
  setIsUserMenuOpen,
  setIsSitePickerOpen,
  setActionError,
  selectSiteForCheckIn,
}: UseHomeNavigationArgs) {
  const handleSignOut = useCallback(async () => {
    setIsUserMenuOpen(false);
    await signOut();
  }, [setIsUserMenuOpen, signOut]);

  const goToHistory = useCallback(() => {
    router.push("/history");
  }, [router]);

  const goToShifts = useCallback(() => {
    router.push("/shifts");
  }, [router]);

  const handleSelectSite = useCallback(
    async (siteId: string) => {
      setIsSitePickerOpen(false);
      setActionError(null);
      await selectSiteForCheckIn(siteId);
    },
    [selectSiteForCheckIn, setActionError, setIsSitePickerOpen],
  );

  return {
    handleSignOut,
    goToShifts,
    handleSelectSite,
  };
}
