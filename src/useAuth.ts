import { useEffect, useState } from "react";

type Tenant = {
  id: string;
  name: string;
  slug: string;
};

type User = {
  id: string;
  email: string;
  role: "owner" | "admin" | "staff";
  tenantId: string;
};

type AuthState = {
  user: User | null;
  tenant: Tenant | null;
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchMe() {
    try {
      const res = await fetch("http://localhost:4000/api/auth/me", {
        credentials: "include",
      });

      if (!res.ok) {
        setUser(null);
        setTenant(null);
        return;
      }

      const data: AuthState = await res.json();

      setUser(data.user);
      setTenant(data.tenant);
    } catch {
      setUser(null);
      setTenant(null);
    }
  }

  useEffect(() => {
    fetchMe().finally(() => setLoading(false));
  }, []);

  async function refresh() {
    setLoading(true);
    await fetchMe();
    setLoading(false);
  }

  async function login(email: string, password: string) {
    const res = await fetch("http://localhost:4000/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Login failed");
    }

    await refresh();
  }

  async function register(
    email: string,
    password: string,
    tenantName: string
  ) {
    const res = await fetch("http://localhost:4000/api/auth/register", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, tenantName }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Registration failed");
    }

    await refresh();
  }

  async function logout() {
    await fetch("http://localhost:4000/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    setUser(null);
    setTenant(null);
  }

  return {
    user,
    tenant,
    loading,

    isLoggedIn: !!user,
    canManage: user?.role === "owner" || user?.role === "admin",

    login,
    register,
    logout,
    refresh,
  };
}
