import React, { useMemo, useState } from "react";

type EntryRecord = {
  id: string;
  colour?: string;
  number?: number | null;
};

function formatDateTime(value: Date) {
  return value.toLocaleString();
}

async function generateTicketPdf({
  raffleTitle,
  purchaserName,
  purchaserEmail,
  totalEntries,
  entries,
}: {
  raffleTitle: string;
  purchaserName: string;
  purchaserEmail: string;
  totalEntries: number;
  entries: EntryRecord[];
}) {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF();

  let y = 20;

  doc.setFontSize(18);
  doc.text("Raffle Entry Confirmation", 20, y);
  y += 10;

  doc.setFontSize(12);
  doc.text(`Raffle: ${raffleTitle}`, 20, y);
  y += 8;
  doc.text(`Name: ${purchaserName}`, 20, y);
  y += 8;
  doc.text(`Email: ${purchaserEmail}`, 20, y);
  y += 8;
  doc.text(`Entries: ${totalEntries}`, 20, y);
  y += 8;
  doc.text(`Generated: ${formatDateTime(new Date())}`, 20, y);
  y += 14;

  doc.setFontSize(13);
  doc.text("Assigned entries", 20, y);
  y += 8;

  doc.setFontSize(11);

  if (entries.length === 0) {
    doc.text("No entry details available.", 20, y);
    y += 8;
  } else {
    entries.forEach((entry, index) => {
      const parts = [
        `#${index + 1}`,
        entry.id ? `ID: ${entry.id}` : "",
        entry.colour ? `Colour: ${entry.colour}` : "",
        entry.number != null ? `Number: ${entry.number}` : "",
      ].filter(Boolean);

      doc.text(parts.join("  |  "), 20, y);
      y += 7;

      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });
  }

  y += 8;
  doc.setFontSize(10);
  doc.text("Thank you for supporting the fundraiser.", 20, y);

  doc.save("raffle-ticket.pdf");
}

export default function RaffleSection() {
  const [raffleTitle, setRaffleTitle] = useState("Spring Cash Raffle");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [entriesCount, setEntriesCount] = useState(1);
  const [colour, setColour] = useState("");
  const [numberValue, setNumberValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createdEntries, setCreatedEntries] = useState<EntryRecord[]>([]);

  const totalEntries = useMemo(() => {
    return Math.max(1, Number(entriesCount) || 1);
  }, [entriesCount]);

  async function handleCreateAndDownload(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    setSubmitting(true);

    try {
      const simulatedEntries: EntryRecord[] = Array.from(
        { length: totalEntries },
        (_, index) => ({
          id: `entry_${Date.now()}_${index + 1}`,
          colour: colour.trim() || undefined,
          number: numberValue ? Number(numberValue) + index : null,
        })
      );

      setCreatedEntries(simulatedEntries);

      await generateTicketPdf({
        raffleTitle: raffleTitle.trim() || "Raffle",
        purchaserName: name.trim(),
        purchaserEmail: email.trim(),
        totalEntries,
        entries: simulatedEntries,
      });

      setSuccess("PDF generated successfully.");
    } catch (err: any) {
      setError(err?.message || "Failed to generate PDF.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.heading}>Raffle PDF Export</h1>
          <p style={styles.subtext}>
            This is a compile-safe raffle section with PDF generation enabled.
          </p>

          <form onSubmit={handleCreateAndDownload} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Raffle title</label>
              <input
                value={raffleTitle}
                onChange={(e) => setRaffleTitle(e.target.value)}
                style={styles.input}
                placeholder="Spring Cash Raffle"
              />
            </div>

            <div style={styles.grid2}>
              <div style={styles.field}>
                <label style={styles.label}>Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={styles.input}
                  placeholder="Jane Smith"
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={styles.input}
                  placeholder="jane@example.com"
                />
              </div>
            </div>

            <div style={styles.grid3}>
              <div style={styles.field}>
                <label style={styles.label}>Entries</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={entriesCount}
                  onChange={(e) => setEntriesCount(Number(e.target.value || 1))}
                  style={styles.input}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Colour (optional)</label>
                <input
                  value={colour}
                  onChange={(e) => setColour(e.target.value)}
                  style={styles.input}
                  placeholder="Blue"
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Number start (optional)</label>
                <input
                  type="number"
                  value={numberValue}
                  onChange={(e) => setNumberValue(e.target.value)}
                  style={styles.input}
                  placeholder="1"
                />
              </div>
            </div>

            <div style={styles.actions}>
              <button type="submit" disabled={submitting} style={styles.button}>
                {submitting ? "Generating..." : "Generate PDF"}
              </button>
            </div>
          </form>

          {error ? <div style={styles.error}>{error}</div> : null}
          {success ? <div style={styles.success}>{success}</div> : null}

          {createdEntries.length > 0 ? (
            <div style={styles.preview}>
              <h2 style={styles.previewHeading}>Preview</h2>
              <div style={styles.entryList}>
                {createdEntries.map((entry, index) => (
                  <div key={entry.id} style={styles.entryCard}>
                    <div style={styles.entryTitle}>Entry {index + 1}</div>
                    <div style={styles.entryMeta}>ID: {entry.id}</div>
                    {entry.colour ? (
                      <div style={styles.entryMeta}>Colour: {entry.colour}</div>
                    ) : null}
                    {entry.number != null ? (
                      <div style={styles.entryMeta}>Number: {entry.number}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f3f4f6",
    padding: 24,
  },
  container: {
    maxWidth: 900,
    margin: "0 auto",
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 24,
  },
  heading: {
    margin: 0,
    fontSize: 28,
  },
  subtext: {
    marginTop: 8,
    color: "#6b7280",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    marginTop: 20,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: "#374151",
  },
  input: {
    height: 42,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    padding: "0 12px",
    fontSize: 14,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 16,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
  },
  button: {
    height: 44,
    padding: "0 16px",
    borderRadius: 10,
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  error: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#b91c1c",
  },
  success: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    border: "1px solid #a7f3d0",
    background: "#ecfdf5",
    color: "#065f46",
  },
  preview: {
    marginTop: 24,
  },
  previewHeading: {
    margin: "0 0 12px",
    fontSize: 20,
  },
  entryList: {
    display: "grid",
    gap: 12,
  },
  entryCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    background: "#f9fafb",
  },
  entryTitle: {
    fontWeight: 700,
    marginBottom: 6,
  },
  entryMeta: {
    color: "#4b5563",
    fontSize: 14,
  },
};
