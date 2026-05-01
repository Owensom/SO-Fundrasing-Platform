// src/app/admin/raffles/[id]/page.tsx

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { getRaffleById } from "@/lib/raffles";
import { query } from "@/lib/db";
import RaffleAdminActions from "./RaffleAdminActions";
import PrizeSettings from "./PrizeSettings";
import ImageUploadField from "@/components/ImageUploadField";
import DramaticRaffleDraw from "./DramaticRaffleDraw";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: {
    id: string;
  };
};

export default async function AdminRafflePage({ params }: PageProps) {
  const { id } = params;

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const raffle = await getRaffleById(id);
  if (!raffle) notFound();

  const config = (raffle.config_json as any) ?? {};

  const winners = await query(
    `select * from raffle_winners where raffle_id = $1 order by prize_position`,
    [raffle.id],
  );

  const soldTicketsRaw = await query(
    `select ticket_number, colour from raffle_ticket_sales where raffle_id = $1`,
    [raffle.id],
  );

  const soldTickets = soldTicketsRaw.map((t: any) => ({
    ticketNumber: Number(t.ticket_number),
    colour: t.colour,
  }));

  return (
    <main style={styles.page}>
      <Link href="/admin/raffles">← Back</Link>

      <h1>{raffle.title}</h1>

      {/* =========================
          EDIT FORM
      ========================== */}
      <form action={`/api/admin/raffles/${raffle.id}`} method="post" style={styles.form}>
        <Field label="Title">
          <input name="title" defaultValue={raffle.title} style={styles.input} />
        </Field>

        <Field label="Slug">
          <input name="slug" defaultValue={raffle.slug} style={styles.input} />
        </Field>

        <Field label="Description">
          <textarea
            name="description"
            defaultValue={raffle.description ?? ""}
            style={styles.textarea}
          />
        </Field>

        {/* =========================
            ✅ LEGAL QUESTION BLOCK
        ========================== */}
        <section style={styles.legalPanel}>
          <h3 style={styles.subTitle}>Entry question (legal)</h3>

          <Field label="Question">
            <input
              name="question_text"
              defaultValue={String(config.question?.text ?? "")}
              placeholder="e.g. What colour is a London taxi?"
              style={styles.input}
            />
          </Field>

          <Field label="Correct answer">
            <input
              name="question_answer"
              defaultValue={String(config.question?.answer ?? "")}
              placeholder="e.g. black"
              style={styles.input}
            />
          </Field>

          <p style={styles.helpText}>
            This makes your raffle a prize competition. Answer is validated at checkout.
          </p>
        </section>

        <Field label="Ticket price">
          <input
            name="ticket_price"
            type="number"
            step="0.01"
            defaultValue={(raffle.ticket_price_cents / 100).toFixed(2)}
            style={styles.input}
          />
        </Field>

        <button type="submit" style={styles.button}>
          Save raffle
        </button>
      </form>

      {/* =========================
          DRAW + WINNERS
      ========================== */}
      <h2>Winners</h2>

      {winners.length === 0 && <p>No winners yet</p>}

      {winners.map((w: any) => (
        <div key={w.id} style={styles.card}>
          <strong>{w.prize_title}</strong> — #{w.ticket_number} ({w.colour || "No colour"})
          <div>{w.buyer_name}</div>
          <div>{w.buyer_email}</div>
        </div>
      ))}

      <div style={{ marginTop: 20 }}>
        <DramaticRaffleDraw raffleId={raffle.id} soldTickets={soldTickets} />
      </div>

      <PrizeSettings raffleId={raffle.id} initialPrizes={config.prizes ?? []} />
      <RaffleAdminActions raffleId={raffle.id} status={raffle.status} />
    </main>
  );
}

/* =========================
   UI HELPERS
========================= */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

/* =========================
   STYLES
========================= */

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 800,
    margin: "40px auto",
    padding: 20,
  },
  form: {
    display: "grid",
    gap: 16,
    marginBottom: 30,
  },
  field: {
    display: "grid",
    gap: 6,
  },
  input: {
    padding: 10,
    borderRadius: 8,
    border: "1px solid #ccc",
  },
  textarea: {
    padding: 10,
    borderRadius: 8,
    border: "1px solid #ccc",
  },
  button: {
    padding: 12,
    background: "#111827",
    color: "#fff",
    borderRadius: 8,
    fontWeight: 700,
  },
  card: {
    padding: 10,
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    marginBottom: 8,
  },
  legalPanel: {
    padding: 14,
    borderRadius: 12,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    display: "grid",
    gap: 10,
  },
  subTitle: {
    fontWeight: 800,
  },
  helpText: {
    fontSize: 12,
    color: "#475569",
  },
};
