import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

type User = {
  id: string;
  email: string;
  role: string;
  tenantId: string;
};

type MeResponse = {
  user?: User | null;
};

type ProtectedRouteProps = {
  children: ReactNode;
};

export default function ProtectedRoute({
  children,
}: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadMe() {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Failed to load session");
        }

        const data: MeResponse = await res.json();

        if (mounted) {
          setUser(data.user ?? null);
        }
      } catch {
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadMe();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <div style={{ padding: 24 }}>Checking session...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
