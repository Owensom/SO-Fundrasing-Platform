// src/app/r/[slug]/page.tsx

import Link from "next/link";
import { notFound } from "next/navigation";
import { getRaffleBySlug } from "@/lib/raffles";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

type Props = {
  params: { slug: string };
};

export default async function PublicRafflePage({ params }: Props) {
  const tenantSlug = getTenantSlugFromHeaders();
  const raffle = await getRaffleBySlug(tenantSlug, params.slug);

  if (!raffle) return notFound();

  const config = (raffle.config_json as any) || {};
  const imagePosition = config.image_position || "center";
  const entryQuestion = config.question?.text
    ? String(config.question.text).trim()
    : "";

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
            To enter, answer this question:
          </p>

          <p style={{ margin: "8px 0", color: "#0f172a", fontWeight: 700 }}>
            {entryQuestion}
          </p>

          <input
            id="raffle-answer"
            name="answer"
            placeholder="Enter your answer"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              boxSizing: "border-box",
            }}
          />

          <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 12 }}>
            Your answer must be correct before your entry can be processed.
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
