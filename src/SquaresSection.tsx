export async function apiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(`http://localhost:4000${url}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!res.ok) {
    let message = "Request failed";

    if (isJson) {
      try {
        const data = await res.json();
        message = data.error || message;
      } catch {
        // ignore
      }
    }

    throw new Error(message);
  }

  if (isJson) {
    return res.json();
  }

  return null;
}
