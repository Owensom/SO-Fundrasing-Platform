"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

export type ShareKitCampaignType = "raffle" | "squares" | "event" | "auction";

export type ShareKitCampaign = {
  id: string;
  type: ShareKitCampaignType;
  title: string;
  slug: string;
  description: string;
  publicUrl: string;
  supportUrl: string;
};

export type ShareKitBranding = {
  tenantSlug: string;
  displayName: string;
  tagline: string;
  primaryColour: string;
  accentColour: string;
};

type CampaignShareKitClientProps = {
  campaigns: ShareKitCampaign[];
  branding: ShareKitBranding;
  appBaseUrl: string;
};

function cleanText(value: unknown, fallback = "") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function campaignTypeLabel(type: ShareKitCampaignType) {
  if (type === "raffle") return "Raffle";
  if (type === "squares") return "Squares";
  if (type === "event") return "Event";
  if (type === "auction") return "Auction";
  return "Campaign";
}

function campaignActionLabel(type: ShareKitCampaignType) {
  if (type === "raffle") return "Enter the raffle";
  if (type === "squares") return "Pick a square";
  if (type === "event") return "Book tickets";
  if (type === "auction") return "Place a bid";
  return "Support campaign";
}

function normaliseBaseUrl(value: string) {
  const clean = cleanText(value).replace(/\/+$/, "");

  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    return clean;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "";
}

function absoluteUrl(baseUrl: string, path: string) {
  const base = normaliseBaseUrl(baseUrl);
  const cleanPath = cleanText(path);

  if (!cleanPath) return base;

  if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
    return cleanPath;
  }

  return `${base}${cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`}`;
}

function buildCaption(params: {
  campaign: ShareKitCampaign;
  branding: ShareKitBranding;
  campaignUrl: string;
}) {
  const action = campaignActionLabel(params.campaign.type);
  const description = cleanText(params.campaign.description);

  return [
    `We’re supporting ${params.branding.displayName}.`,
    "",
    `${params.campaign.title}`,
    description ? description : campaignTypeLabel(params.campaign.type),
    "",
    `${action}: ${params.campaignUrl}`,
  ].join("\n");
}

async function copyToClipboard(value: string) {
  if (!navigator.clipboard) {
    throw new Error("Clipboard is not available in this browser.");
  }

  await navigator.clipboard.writeText(value);
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = context.measureText(testLine).width;

    if (width <= maxWidth || !currentLine) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height,
  );
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export default function CampaignShareKitClient({
  campaigns,
  branding,
  appBaseUrl,
}: CampaignShareKitClientProps) {
  const [selectedCampaignId, setSelectedCampaignId] = useState(
    campaigns[0]?.id || "",
  );
  const [copied, setCopied] = useState("");

  const selectedCampaign = useMemo(() => {
    return (
      campaigns.find((campaign) => campaign.id === selectedCampaignId) ||
      campaigns[0] ||
      null
    );
  }, [campaigns, selectedCampaignId]);

  const campaignUrl = selectedCampaign
    ? absoluteUrl(appBaseUrl, selectedCampaign.publicUrl)
    : "";

  const supportUrl = selectedCampaign
    ? absoluteUrl(appBaseUrl, selectedCampaign.supportUrl)
    : "";

  const caption = selectedCampaign
    ? buildCaption({
        campaign: selectedCampaign,
        branding,
        campaignUrl,
      })
    : "";

  async function handleCopy(label: string, value: string) {
    try {
      await copyToClipboard(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("copy-error");
      window.setTimeout(() => setCopied(""), 2200);
    }
  }

  async function handleNativeShare() {
    if (!selectedCampaign || !campaignUrl) return;

    if (!navigator.share) {
      await handleCopy("caption", caption);
      return;
    }

    try {
      await navigator.share({
        title: selectedCampaign.title,
        text: caption,
        url: campaignUrl,
      });
    } catch {
      // User cancelled native share; no action needed.
    }
  }

  function handleDownloadCard() {
    if (!selectedCampaign) return;

    const canvas = document.createElement("canvas");
    const width = 1200;
    const height = 630;
    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");

    if (!context) return;

    context.scale(pixelRatio, pixelRatio);

    const primary = branding.primaryColour || "#1683F8";
    const accent = branding.accentColour || "#FACC15";

    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#020617");
    gradient.addColorStop(0.58, "#0f172a");
    gradient.addColorStop(1, "#172554");

    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.globalAlpha = 0.2;
    context.fillStyle = primary;
    context.beginPath();
    context.arc(1030, 90, 250, 0, Math.PI * 2);
    context.fill();

    context.globalAlpha = 0.14;
    context.strokeStyle = accent;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(130, 580, 250, 0, Math.PI * 2);
    context.stroke();

    context.globalAlpha = 1;

    drawRoundedRect(context, 64, 62, 1072, 506, 42);
    context.fillStyle = "rgba(255,255,255,0.08)";
    context.fill();
    context.strokeStyle = "rgba(255,255,255,0.18)";
    context.lineWidth = 2;
    context.stroke();

    drawRoundedRect(context, 96, 96, 98, 98, 28);
    context.fillStyle = primary;
    context.fill();
    context.strokeStyle = accent;
    context.lineWidth = 3;
    context.stroke();

    context.fillStyle = "#ffffff";
    context.font =
      "900 34px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      branding.displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0])
        .join("")
        .toUpperCase() || "SO",
      145,
      145,
    );

    context.textAlign = "left";
    context.textBaseline = "alphabetic";

    context.fillStyle = accent;
    context.font =
      "900 25px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    context.fillText(campaignTypeLabel(selectedCampaign.type).toUpperCase(), 224, 126);

    context.fillStyle = "#dbeafe";
    context.font =
      "800 30px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    context.fillText(branding.displayName, 224, 168);

    context.fillStyle = "#ffffff";
    context.font =
      "950 58px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

    const titleLines = wrapCanvasText(context, selectedCampaign.title, 900).slice(
      0,
      3,
    );

    let titleY = 270;

    for (const line of titleLines) {
      context.fillText(line, 96, titleY);
      titleY += 66;
    }

    const description = cleanText(
      selectedCampaign.description,
      campaignActionLabel(selectedCampaign.type),
    );

    context.fillStyle = "#bfdbfe";
    context.font =
      "800 30px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

    const descriptionLines = wrapCanvasText(context, description, 790).slice(0, 2);
    let descriptionY = Math.min(titleY + 12, 430);

    for (const line of descriptionLines) {
      context.fillText(line, 96, descriptionY);
      descriptionY += 38;
    }

    drawRoundedRect(context, 96, 494, 330, 58, 29);
    context.fillStyle = primary;
    context.fill();

    context.fillStyle = "#ffffff";
    context.font =
      "900 24px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(campaignActionLabel(selectedCampaign.type), 261, 523);

    context.textAlign = "right";
    context.fillStyle = "#ffffff";
    context.font =
      "900 24px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    context.fillText(new URL(campaignUrl).host, 1102, 516);

    context.fillStyle = "#bfdbfe";
    context.font =
      "750 20px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    context.fillText("Click the campaign link to support securely", 1102, 548);

    const dataUrl = canvas.toDataURL("image/png");
    const filename = `${selectedCampaign.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "campaign"}-share-card.png`;

    downloadDataUrl(dataUrl, filename);
  }

  if (campaigns.length === 0) {
    return (
      <section style={styles.emptyState}>
        <h2 style={styles.emptyTitle}>No live campaigns available to share</h2>
        <p style={styles.emptyText}>
          Publish a campaign first, then return here to create a share kit for
          social posts, WhatsApp messages, emails and posters.
        </p>
      </section>
    );
  }

  return (
    <section className="share-kit-shell" style={styles.shell}>
      <div style={styles.selectorPanel}>
        <div>
          <p style={styles.kicker}>Campaign Share Kit</p>
          <h2 style={styles.title}>Create a social-ready campaign link</h2>
          <p style={styles.text}>
            Choose a live campaign, copy the public campaign link or donation
            link, then download a branded card for social posts.
          </p>
        </div>

        <label style={styles.field}>
          <span style={styles.label}>Campaign</span>
          <select
            value={selectedCampaign?.id || ""}
            onChange={(event) => setSelectedCampaignId(event.target.value)}
            style={styles.input}
          >
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.title} — {campaignTypeLabel(campaign.type)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedCampaign ? (
        <div className="share-kit-grid" style={styles.grid}>
          <article style={styles.previewCard}>
            <div style={styles.previewTop}>
              <span
                style={{
                  ...styles.typePill,
                  background: `${branding.accentColour}22`,
                  borderColor: `${branding.accentColour}88`,
                }}
              >
                {campaignTypeLabel(selectedCampaign.type)}
              </span>

              <span style={styles.livePill}>Live campaign</span>
            </div>

            <h3 style={styles.previewTitle}>{selectedCampaign.title}</h3>

            <p style={styles.previewText}>
              {selectedCampaign.description ||
                campaignActionLabel(selectedCampaign.type)}
            </p>

            <div style={styles.previewActions}>
              <button
                type="button"
                onClick={() => handleCopy("campaign", campaignUrl)}
                style={{
                  ...styles.primaryButton,
                  background: branding.primaryColour,
                  borderColor: branding.primaryColour,
                }}
              >
                Copy campaign link
              </button>

              <button
                type="button"
                onClick={() => handleCopy("support", supportUrl)}
                style={styles.secondaryButton}
              >
                Copy donation link
              </button>

              <button
                type="button"
                onClick={() => handleCopy("caption", caption)}
                style={styles.secondaryButton}
              >
                Copy caption
              </button>

              <button
                type="button"
                onClick={handleNativeShare}
                style={styles.secondaryButton}
              >
                Share
              </button>

              <button
                type="button"
                onClick={handleDownloadCard}
                style={styles.darkButton}
              >
                Download PNG card
              </button>
            </div>

            {copied ? (
              <div
                style={{
                  ...styles.copyNotice,
                  ...(copied === "copy-error" ? styles.copyError : {}),
                }}
              >
                {copied === "copy-error"
                  ? "Copy failed. Please copy the text manually."
                  : "Copied to clipboard."}
              </div>
            ) : null}
          </article>

          <aside style={styles.linkPanel}>
            <div style={styles.linkBlock}>
              <span style={styles.linkLabel}>Campaign link</span>
              <strong style={styles.linkValue}>{campaignUrl}</strong>
            </div>

            <div style={styles.linkBlock}>
              <span style={styles.linkLabel}>Donation/support link</span>
              <strong style={styles.linkValue}>{supportUrl}</strong>
            </div>

            <div style={styles.captionBox}>
              <span style={styles.linkLabel}>Suggested caption</span>
              <pre style={styles.captionText}>{caption}</pre>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    display: "grid",
    gap: 18,
    minWidth: 0,
  },

  selectorPanel: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 0.42fr)",
    gap: 16,
    alignItems: "end",
    padding: 22,
    borderRadius: 28,
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 58%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
    minWidth: 0,
  },

  kicker: {
    margin: "0 0 7px",
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: 32,
    lineHeight: 1.05,
    letterSpacing: "-0.055em",
    overflowWrap: "anywhere",
  },

  text: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.55,
    fontWeight: 750,
    maxWidth: 760,
    overflowWrap: "anywhere",
  },

  field: {
    display: "grid",
    gap: 7,
    minWidth: 0,
  },

  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 950,
  },

  input: {
    width: "100%",
    minHeight: 48,
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "11px 13px",
    fontSize: 15,
    fontWeight: 800,
    boxSizing: "border-box",
    minWidth: 0,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 0.72fr)",
    gap: 16,
    minWidth: 0,
  },

  previewCard: {
    display: "grid",
    gap: 14,
    padding: 22,
    borderRadius: 30,
    background:
      "radial-gradient(circle at top right, rgba(22,131,248,0.10), transparent 34%), linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)",
    border: "1px solid #bfdbfe",
    boxShadow: "0 16px 36px rgba(22,131,248,0.10)",
    minWidth: 0,
  },

  previewTop: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
  },

  typePill: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  livePill: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    padding: "7px 10px",
    borderRadius: 999,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontSize: 12,
    fontWeight: 950,
  },

  previewTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(32px, 5vw, 52px)",
    lineHeight: 0.98,
    letterSpacing: "-0.07em",
    overflowWrap: "anywhere",
  },

  previewText: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.55,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  previewActions: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))",
    gap: 10,
    marginTop: 4,
  },

  primaryButton: {
    minHeight: 46,
    padding: "11px 13px",
    borderRadius: 999,
    color: "#ffffff",
    border: "1px solid",
    fontWeight: 950,
    cursor: "pointer",
    textAlign: "center",
  },

  secondaryButton: {
    minHeight: 46,
    padding: "11px 13px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    fontWeight: 950,
    cursor: "pointer",
    textAlign: "center",
  },

  darkButton: {
    minHeight: 46,
    padding: "11px 13px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
    fontWeight: 950,
    cursor: "pointer",
    textAlign: "center",
  },

  copyNotice: {
    padding: 12,
    borderRadius: 16,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontWeight: 900,
    textAlign: "center",
  },

  copyError: {
    background: "#fef2f2",
    color: "#991b1b",
    borderColor: "#fecaca",
  },

  linkPanel: {
    display: "grid",
    gap: 12,
    alignContent: "start",
    padding: 18,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
  },

  linkBlock: {
    display: "grid",
    gap: 6,
    padding: 13,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },

  linkLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  linkValue: {
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },

  captionBox: {
    display: "grid",
    gap: 8,
    padding: 13,
    borderRadius: 18,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    minWidth: 0,
  },

  captionText: {
    margin: 0,
    whiteSpace: "pre-wrap",
    color: "#78350f",
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 750,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },

  emptyState: {
    display: "grid",
    gap: 8,
    padding: 24,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px dashed #cbd5e1",
    textAlign: "center",
  },

  emptyTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 28,
    letterSpacing: "-0.04em",
  },

  emptyText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.55,
    fontWeight: 750,
  },
};
