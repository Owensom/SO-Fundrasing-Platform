import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createEvent,
  type EventPrize,
  type EventStatus,
  type EventType,
} from "../../../../../api/_lib/events-repo";

function positiveInteger(value: FormDataEntryValue | null, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.floor(number));
}

function cleanEventType(value: FormDataEntryValue | null): EventType {
  const eventType = String(value || "general_admission").trim();

  if (
    eventType === "general_admission" ||
    eventType === "reserved_seating" ||
    eventType === "tables"
  ) {
    return eventType;
  }

  return "general_admission";
}

function cleanStatus(value: FormDataEntryValue | null): EventStatus {
  const status = String(value || "draft").trim();

  if (status === "draft" || status === "published" || status === "closed") {
    return status;
  }

  return "draft";
}

function parsePrizes(value: FormDataEntryValue | null): EventPrize[] {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function optionalDate(value: FormDataEntryValue | null) {
  const clean = String(value || "").trim();

  if (!clean) return null;

  const date = new Date(clean);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const formData = await request.formData();

  const tenantSlug = String(formData.get("tenantSlug") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const slug = String(formData.get("slug") || "").trim();

  if (!tenantSlug || !title || !slug) {
    return NextResponse.redirect(
      new URL("/admin/events/new?error=missing-required", request.url),
    );
  }

  const event = await createEvent({
    tenantSlug,
    title,
    slug,
    description: String(formData.get("description") || "").trim() || null,
    imageUrl: String(formData.get("image_url") || "").trim() || null,
    location: String(formData.get("location") || "").trim() || null,
    startsAt: optionalDate(formData.get("starts_at")),
    endsAt: optionalDate(formData.get("ends_at")),
    capacity: positiveInteger(formData.get("capacity"), 0) || null,
    currency: String(formData.get("currency") || "GBP").trim() || "GBP",
    eventType: cleanEventType(formData.get("event_type")),
    status: cleanStatus(formData.get("status")),
    prizesJson: parsePrizes(formData.get("prizes")),
  });

  return NextResponse.redirect(
    new URL(`/admin/events/${event.id}?saved=created`, request.url),
  );
}
