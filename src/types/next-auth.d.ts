import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      tenantSlugs: string[];
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    tenantSlugs: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    tenantSlugs?: string[];
  }
}
