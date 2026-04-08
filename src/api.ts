export async function apiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
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
      } catch {}
    }

    throw new Error(message);
  }

  if (isJson) {
    return res.json();
  }

  return null;
}

export async function publicApiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
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
      } catch {}
    }

    throw new Error(message);
  }

  if (isJson) {
    return res.json();
  }

  return null;
}
