// ONLY showing the changed parts to keep this readable
// Replace BOTH fetch blocks with this logic

// =======================
// LOAD RAFFLE (useEffect)
// =======================

const res = await fetch(
  `/api/admin/raffle-details?id=${encodeURIComponent(
    routeId
  )}&tenantSlug=demo-a`
);

const raw = await res.text();
const contentType = res.headers.get("content-type") || "";

let json: any = null;

if (contentType.includes("application/json")) {
  try {
    json = JSON.parse(raw);
  } catch {
    json = null;
  }
}

if (!res.ok) {
  throw new Error(json?.error || raw || "Failed to load raffle");
}

if (!json) {
  throw new Error(
    raw || "API returned HTML instead of JSON (check route)"
  );
}

const raffle = json?.raffle;


// =======================
// SAVE RAFFLE (handleSubmit)
// =======================

const res = await fetch("/api/admin/raffles", {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

const raw = await res.text();
const contentType = res.headers.get("content-type") || "";

let json: any = null;

if (contentType.includes("application/json")) {
  try {
    json = JSON.parse(raw);
  } catch {
    json = null;
  }
}

if (!res.ok) {
  throw new Error(json?.error || raw || "Failed to update raffle");
}

if (!json) {
  throw new Error(
    raw || "API returned HTML instead of JSON"
  );
}
