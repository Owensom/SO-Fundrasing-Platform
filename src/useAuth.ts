import { useEffect, useState } from "react";
import { apiFetch } from "./api";

type AuthUser = {
  id: string;
  email: string;
  role: string;
  tenantId: string;
};

type AuthTenant = {
  id: string;
  name: string;
  slug: string;
};

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<AuthTenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refreshAuth();
  }, []);

  async function refreshAuth() {
    try {
      setLoading(true);
      const data = await apiFetch("/api/auth/me");
      setUser((data as any).user);
      setTenant((data as any).tenant);
    } catch {
      setUser(null);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  }

  return {
    user,
    tenant,
    loading,
    isLoggedIn: !!user,
    canManage: !!user && (user.role === "owner" || user.role === "admin"),
    refreshAuth,
  };
}
