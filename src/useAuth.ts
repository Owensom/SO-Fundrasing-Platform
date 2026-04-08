import { useEffect, useState } from "react";

export type AuthUser = {
  id: string;
  email: string;
  role: "owner" | "admin" | "staff";
  tenantId: string;
};

export type Tenant = {
  id: string;
  name: string;
  slug: string;
};

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshAuth() {
    try {
      const res = await fetch("http://localhost:4000/api/auth/me", {
        credentials: "include",
      });

      if (!res.ok) {
        setUser(null);
        setTenant(null);
        return;
      }

      const data = await res.json();
      setUser(data.user);
      setTenant(data.tenant);
    } catch {
      setUser(null);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAuth();
  }, []);

  return {
    user,
    tenant,
    loading,
    isLoggedIn: !!user,
    canManage: user?.role === "owner" || user?.role === "admin",
    refreshAuth,
  };
}
