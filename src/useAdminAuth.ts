import { useCallback, useMemo, useState } from "react";

export type AdminUser = {
  email?: string;
  name?: string;
};

export function useAdminAuth() {
  const [admin] = useState<AdminUser | null>(null);
  const [loading] = useState(false);

  const refreshAdmin = useCallback(async () => {
    return null;
  }, []);

  const value = useMemo(
    () => ({
      admin,
      isAdmin: Boolean(admin),
      loading,
      refreshAdmin,
    }),
    [admin, loading, refreshAdmin]
  );

  return value;
}
