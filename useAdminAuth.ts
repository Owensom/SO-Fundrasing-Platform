import { useEffect, useState } from "react";

type AdminUser = {
  email: string;
  role: "admin";
};

export function useAdminAuth() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshAdmin() {
    try {
      const res = await fetch("/api/admin/me", {
        credentials: "include",
      });

      if (!res.ok) {
        setAdmin(null);
        return;
      }

      const data = await res.json();
      setAdmin(data.admin);
    } catch {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAdmin();
  }, []);

  return {
    admin,
    isAdmin: !!admin,
    loading,
    refreshAdmin,
  };
}
