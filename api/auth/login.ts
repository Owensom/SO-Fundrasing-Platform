export default function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body || {};
    const email = String(body.email || "").toLowerCase().trim();
    const password = String(body.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (email !== "ownera@example.com" || password !== "Password123!") {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const session = encodeURIComponent(
      JSON.stringify({
        userId: "user-demo-a-owner",
        tenantId: "tenant-demo-a",
        email: "ownera@example.com",
        role: "owner",
      })
    );

    res.setHeader(
      "Set-Cookie",
      `auth_session=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
    );

    return res.status(200).json({
      user: {
        id: "user-demo-a-owner",
        email: "ownera@example.com",
        role: "owner",
        tenantId: "tenant-demo-a",
      },
      tenant: {
        id: "tenant-demo-a",
        name: "SO Fundraising Demo A",
        slug: "demo-a",
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      error: "Login crashed",
      detail: error?.message || "Unknown error",
    });
  }
}
