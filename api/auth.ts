import {
  clearAdminSession,
  getAuthenticatedAdmin,
  isValidAdminLogin,
  setAdminSession,
} from "./_lib/auth";
import {
  getJsonBody,
  getQueryValue,
  sendBadRequest,
  sendMethodNotAllowed,
  sendServerError,
  sendUnauthorized,
  type ApiRequest,
  type ApiResponse,
} from "./_lib/http";

type LoginBody = {
  email?: string;
  password?: string;
};

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  try {
    const action = getQueryValue(req, "action") ?? "me";

    if (req.method === "GET" && action === "me") {
      const admin = getAuthenticatedAdmin(req);

      if (!admin) {
        sendUnauthorized(res);
        return;
      }

      res.status(200).json({
        ok: true,
        admin,
      });
      return;
    }

    if (req.method === "POST" && action === "login") {
      const body = getJsonBody<LoginBody>(req);
      const email = String(body.email ?? "").trim();
      const password = String(body.password ?? "");

      if (!email || !password) {
        sendBadRequest(res, "Email and password are required");
        return;
      }

      if (!isValidAdminLogin(email, password)) {
        sendUnauthorized(res);
        return;
      }

      setAdminSession(res, email);

      res.status(200).json({
        ok: true,
        admin: { email },
      });
      return;
    }

    if (req.method === "POST" && action === "logout") {
      clearAdminSession(res);
      res.status(200).json({ ok: true });
      return;
    }

    sendMethodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    sendServerError(res, error);
  }
}
