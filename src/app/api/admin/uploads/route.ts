import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getTenantSlugFromRequest } from "@/lib/tenant";

export const runtime = "nodejs";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: NextRequest) {
  const tenantSlug = getTenantSlugFromRequest(request);

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "File is required" },
        { status: 400 },
      );
    }

    const safeName = slugify(file.name || "upload");
    const pathname = `raffles/${tenantSlug}/${Date.now()}-${safeName}`;

    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: false,
    });

    return NextResponse.json({
      ok: true,
      url: blob.url,
      pathname: blob.pathname,
    });
  } catch (error) {
    console.error("POST /api/admin/uploads failed", error);

    return NextResponse.json(
      { ok: false, error: "Upload failed" },
      { status: 500 },
    );
  }
}
