import { Suspense } from "react";
import AdminLoginForm from "./AdminLoginForm";

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ maxWidth: 420, margin: "80px auto", padding: 24 }}>
          <h1>Admin login</h1>
          <p>Loading...</p>
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
