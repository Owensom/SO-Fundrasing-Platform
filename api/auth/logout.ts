export default function handler(_req: any, res: any) {
  try {
    res.setHeader(
      "Set-Cookie",
      "auth_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
    );

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({
      error: "Logout crashed",
      detail: error?.message || "Unknown error",
    });
  }
}
