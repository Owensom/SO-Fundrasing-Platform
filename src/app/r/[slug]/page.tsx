import Link from "next/link";
import { notFound } from "next/navigation";
import { getRaffleBySlug } from "@/lib/raffles";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import RaffleClient from "./RaffleClient";

type Props = {
  params: { slug: string };
};

function colourToText(colour: any) {
  if (typeof colour === "string") return colour;
  if (colour?.name) return colour.name;
  if (colour?.hex) return colour.hex;
  return "";
}

export default async function PublicRafflePage({ params }: Props) {
  const tenantSlug = getTenantSlugFromHeaders();
  const raffle = await getRaffleBySlug(tenantSlug, params.slug);

  if (!raffle) return notFound();

  const config = (raffle.config_json as any) || {};
  const imagePosition = config.image_position || "center";
  const entryQuestion = config.question?.text
    ? String(config.question.text).trim()
    : "";

  const colours = Array.isArray(config.colours)
    ? config.colours
        .map(colourToText)
        .filter(Boolean)
        .map((colour: string, index: number) => ({
          id: `${colour}-${index}`,
          name: colour,
          sortOrder: index,
        }))
    : [];

  const fallbackColours =
    colours.length > 0
      ? colours
      : [{ id: "default", name: "Default", sortOrder: 0 }];

  const raffleForClient = {
    id: raffle.id,
    slug: raffle.slug,
    title: raffle.title,
    description: raffle.description ?? "",
    startNumber: Number(config.startNumber || 1),
    endNumber: Number(config.endNumber || raffle.total_tickets || 100),
    colours: fallbackColours,
    soldTickets: Array.isArray(config.sold)
      ? config.sold.map((ticket: any) => ({
          colour: String(ticket.colour || fallbackColours[0].name),
          number: Number(ticket.number),
        }))
      : [],
    reservedTickets: Array.isArray(config.reserved)
      ? config.reserved.map((ticket: any) => ({
          colour: String(ticket.colour || fallbackColours[0].name),
          number: Number(ticket.number),
        }))
      : [],
    config_json: config,
  };

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: 16,
        color: "#0f172a",
      }}
    >
      {raffle.image_url ? (
        <div
          style={{
            width: "100%",
            height: 260,
            overflow: "hidden",
            borderRadius: 16,
            marginBottom: 20,
            background: "#f1f5f9",
          }}
        >
          <img
            src={raffle.image_url}
            alt={raffle.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: imagePosition,
            }}
          />
        </div>
      ) : null}

      <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
        {raffle.title}
      </h1>

      {raffle.description ? (
        <p style={{ marginTop: 10, color: "#475569", lineHeight: 1.6 }}>
          {raffle.description}
        </p>
      ) : null}

      <div
        style={{
          marginTop: 18,
          padding: 12,
          borderRadius: 12,
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          fontSize: 13,
          color: "#7c2d12",
          fontWeight: 700,
          lineHeight: 1.5,
        }}
      >
        This campaign is run by the organiser. The platform provides software
        only and is not responsible for the operation of this draw. The organiser
        is responsible for ensuring compliance with all applicable laws.
      </div>

      {entryQuestion ? (
        <div
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 14,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
          }}
        >
          <p style={{ margin: 0, fontWeight: 800, color: "#1e3a8a" }}>
            Entry question required
          </p>

          <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 13 }}>
            You will need to answer the question correctly before checkout.
          </p>
        </div>
      ) : null}

      {config.prizes?.length ? (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Prizes</h2>

          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            {config.prizes
              .filter((prize: any) => prize.isPublic !== false)
              .map((prize: any, index: number) => (
                <div
                  key={index}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {index + 1}. {prize.title || prize.name}
                  </div>

                  {prize.description ? (
                    <div style={{ color: "#64748b", marginTop: 4 }}>
                      {prize.description}
                    </div>
                  ) : null}
                </div>
              ))}
          </div>
        </div>
      ) : null}

      <section style={{ marginTop: 28 }}>
        <RaffleClient raffle={raffleForClient as any} />
      </section>

      <div
        style={{
          marginTop: 28,
          paddingTop: 16,
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          fontSize: 13,
        }}
      >
        <Link href="/terms" style={{ color: "#2563eb", fontWeight: 700 }}>
          Terms & Conditions
        </Link>

        <Link href="/privacy" style={{ color: "#2563eb", fontWeight: 700 }}>
          Privacy Policy
        </Link>
      </div>
    </main>
  );
}
