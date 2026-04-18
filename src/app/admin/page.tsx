import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

export default async function AdminHomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <h1>Admin</h1>

      <p>
        Signed in as <strong>{session.user.email}</strong>
      </p>

      <p>
        Tenants: <strong>{session.user.tenantSlugs.join(", ")}</strong>
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <Link href="/admin/raffles">Manage raffles</Link>
      </div>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/admin/login" });
        }}
        style={{ marginTop: 24 }}
      >
        <button type="submit">Sign out</button>
      </form>
    </div>
  );
}
