export async function publicApiFetch(url: string) {
  const res = await fetch(url);

  const data = await res.json();

  if (!res.ok) throw new Error(data.error || "Error");

  return data;
}
  return isJson ? res.json() : null;
}
