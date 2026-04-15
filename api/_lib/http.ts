export type ApiRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
  headers?: Record<string, string | undefined>;
  cookies?: Record<string, string>;
};

export type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  end: (body?: string) => void;
  setHeader: (name: string, value: string | string[]) => void;
};

export function getQueryValue(
  req: ApiRequest,
  key: string,
): string | undefined {
  const value = req.query?.[key];
  return Array.isArray(value) ? value[0] : value;
}

export function getJsonBody<T>(req: ApiRequest): T {
  if (!req.body) return {} as T;
  if (typeof req.body === "string") {
    return JSON.parse(req.body) as T;
  }
  return req.body as T;
}

export function sendMethodNotAllowed(
  res: ApiResponse,
  allowed: string[],
): void {
  res.setHeader("Allow", allowed);
  res.status(405).json({
    error: `Method not allowed. Allowed: ${allowed.join(", ")}`,
  });
}

export function sendBadRequest(res: ApiResponse, message: string): void {
  res.status(400).json({ error: message });
}

export function sendUnauthorized(res: ApiResponse): void {
  res.status(401).json({ error: "Unauthorized" });
}

export function sendNotFound(res: ApiResponse, message = "Not found"): void {
  res.status(404).json({ error: message });
}

export function sendServerError(
  res: ApiResponse,
  error: unknown,
  fallback = "Internal server error",
): void {
  const message =
    error instanceof Error && error.message ? error.message : fallback;

  res.status(500).json({
    error: message,
  });
}
