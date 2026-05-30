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
  logoUrl?: string;
  logoMarkUrl?: string;
  platformLogoUrl?: string;
};

type CampaignShareKitClientProps = {
  campaigns: ShareKitCampaign[];
  branding: ShareKitBranding;
  appBaseUrl: string;
};

type QrCardDetails = {
  label: string;
  title: string;
  eyebrow: string;
  action: string;
  url: string;
  filenameSeed: string;
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

function getBestLogoSrc(branding: ShareKitBranding) {
  return (
    cleanText(branding.logoMarkUrl) ||
    cleanText(branding.logoUrl) ||
    cleanText(branding.platformLogoUrl) ||
    "/brand/so-logo-mark.png"
  );
}

function getInitials(value: string) {
  return (
    cleanText(value)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "SO"
  );
}

function buildCaption(params: {
  campaign: ShareKitCampaign;
  branding: ShareKitBranding;
  campaignUrl: string;
}) {
  const action = campaignActionLabel(params.campaign.type);
  const description = cleanText(params.campaign.description);

  return [
    `${params.branding.displayName} is fundraising.`,
    "",
    `${params.campaign.title}`,
    description || campaignTypeLabel(params.campaign.type),
    "",
    `${action}: ${params.campaignUrl}`,
  ].join("\n");
}

function buildPublicHubCaption(params: {
  branding: ShareKitBranding;
  publicHubUrl: string;
}) {
  return [
    `${params.branding.displayName} has live fundraising campaigns ready to support.`,
    "",
    cleanText(
      params.branding.tagline,
      "Browse the latest campaigns and choose how you would like to help.",
    ),
    "",
    `View all live campaigns: ${params.publicHubUrl}`,
  ].join("\n");
}

function qrImageUrl(value: string, size = 700) {
  const cleanValue = cleanText(value);

  if (!cleanValue) return "";

  const params = new URLSearchParams({
    size: `${size}x${size}`,
    data: cleanValue,
    format: "png",
    margin: "22",
    color: "0f172a",
    bgcolor: "ffffff",
    ecc: "M",
  });

  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
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

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }

    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);

    image.src = src;
  });
}

function slugifyFilename(value: string, fallback: string) {
  return (
    cleanText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || fallback
  );
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

  const publicHubUrl = absoluteUrl(appBaseUrl, `/c/${branding.tenantSlug}`);
  const logoSrc = getBestLogoSrc(branding);

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

  const publicHubCaption = buildPublicHubCaption({
    branding,
    publicHubUrl,
  });

  const hubQrDetails: QrCardDetails = {
    label: "Public campaign hub QR",
    title: branding.displayName,
    eyebrow: "PUBLIC CAMPAIGN HUB",
    action: "Scan to view all live campaigns",
    url: publicHubUrl,
    filenameSeed: `${branding.displayName}-public-hub`,
  };

  const campaignQrDetails: QrCardDetails | null = selectedCampaign
    ? {
        label: "Selected campaign QR",
        title: selectedCampaign.title,
        eyebrow: campaignTypeLabel(selectedCampaign.type).toUpperCase(),
        action: `Scan to ${campaignActionLabel(
          selectedCampaign.type,
        ).toLowerCase()}`,
        url: campaignUrl,
        filenameSeed: `${selectedCampaign.title}-campaign`,
      }
    : null;

  const supportQrDetails: QrCardDetails | null = selectedCampaign
    ? {
        label: "Donation/support QR",
        title: selectedCampaign.title,
        eyebrow: "DONATION LINK",
        action: "Scan to support this campaign",
        url: supportUrl,
        filenameSeed: `${selectedCampaign.title}-support`,
      }
    : null;

  const hubQrPreviewUrl = qrImageUrl(publicHubUrl, 700);

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
      // User cancelled native share.
    }
  }

  async function handlePublicHubShare() {
    if (!navigator.share) {
      await handleCopy("hub-caption", publicHubCaption);
      return;
    }

    try {
      await navigator.share({
        title: branding.displayName,
        text: publicHubCaption,
        url: publicHubUrl,
      });
    } catch {
      // User cancelled native share.
    }
  }

  async function handleDownloadCard() {
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
    const loadedLogo = await loadImage(logoSrc);

    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#020617");
    gradient.addColorStop(0.58, "#0f172a");
    gradient.addColorStop(1, "#172554");

    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.globalAlpha = 0.22;
    context.fillStyle = primary;
    context.beginPath();
    context.arc(1050, 90, 260, 0, Math.PI * 2);
    context.fill();

    context.globalAlpha = 0.16;
    context.strokeStyle = accent;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(110, 570, 245, 0, Math.PI * 2);
    context.stroke();

    context.globalAlpha = 1;

    drawRoundedRect(context, 64, 56, 1072, 518, 44);
    context.fillStyle = "rgba(255,255,255,0.09)";
    context.fill();
    context.strokeStyle = "rgba(255,255,255,0.18)";
    context.lineWidth = 2;
    context.stroke();

    drawRoundedRect(context, 96, 92, 104, 104, 30);
    context.fillStyle = "#ffffff";
    context.fill();
    context.strokeStyle = accent;
    context.lineWidth = 3;
    context.stroke();

    if (loadedLogo) {
      const imagePadding = 14;
      context.save();
      drawRoundedRect(context, 96, 92, 104, 104, 30);
      context.clip();
      context.fillStyle = "#ffffff";
      context.fillRect(96, 92, 104, 104);
      context.drawImage(
        loadedLogo,
        96 + imagePadding,
        92 + imagePadding,
        104 - imagePadding * 2,
        104 - imagePadding * 2,
      );
      context.restore();
    } else {
      context.fillStyle = primary;
      context.font =
        "900 34px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(getInitials(branding.displayName), 148, 144);
    }

    context.textAlign = "left";
    context.textBaseline = "alphabetic";

    context.fillStyle = accent;
    context.font =
      "900 24px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    context.fillText(
      campaignTypeLabel(selectedCampaign.type).toUpperCase(),
      224,
      122,
    );

    context.fillStyle = "#dbeafe";
    context.font =
      "800 29px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    context.fillText(branding.displayName, 224, 164);

    context.fillStyle = "#ffffff";
    context.font =
      "950 58px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

    const titleLines = wrapCanvasText(context, selectedCampaign.title, 920).slice(
      0,
      3,
    );

    let titleY = 270;

    for (const line of titleLines) {
      context.fillText(line, 96, titleY);
      titleY += 64;
    }

    const description = cleanText(
      selectedCampaign.description,
      campaignActionLabel(selectedCampaign.type),
    );

    context.fillStyle = "#bfdbfe";
    context.font =
      "800 28px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

    const descriptionLines = wrapCanvasText(context, description, 800).slice(
      0,
      2,
    );
    let descriptionY = Math.min(titleY + 10, 430);

    for (const line of descriptionLines) {
      context.fillText(line, 96, descriptionY);
      descriptionY += 36;
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
    const filename = `${slugifyFilename(
      selectedCampaign.title,
      "campaign",
    )}-share-card.png`;

    downloadDataUrl(dataUrl, filename);
  }

  async function handleDownloadQrCard(details: QrCardDetails) {
    const qrUrl = qrImageUrl(details.url, 900);

    if (!qrUrl) return;

    const canvas = document.createElement("canvas");
    const width = 1080;
    const height = 1350;
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

    const [loadedLogo, loadedQr] = await Promise.all([
      loadImage(logoSrc),
      loadImage(qrUrl),
    ]);

    if (!loadedQr) {
      setCopied("qr-error");
      window.setTimeout(() => setCopied(""), 2600);
      return;
    }

    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#020617");
    gradient.addColorStop(0.54, "#0f172a");
    gradient.addColorStop(1, "#172554");

    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.globalAlpha = 0.24;
    context.fillStyle = primary;
    context.beginPath();
    context.arc(930, 110, 300, 0, Math.PI * 2);
    context.fill();

    context.globalAlpha = 0.18;
    context.strokeStyle = accent;
    context.lineWidth = 5;
    context.beginPath();
    context.arc(120, 1240, 280, 0, Math.PI * 2);
    context.stroke();

    context.globalAlpha = 1;

    drawRoundedRect(context, 64, 64, 952, 1222, 54);
    context.fillStyle = "rgba(255,255,255,0.10)";
    context.fill();
    context.strokeStyle = "rgba(255,255,255,0.22)";
    context.lineWidth = 2;
    context.stroke();

    drawRoundedRect(context, 110, 104, 124, 124, 34);
    context.fillStyle = "#ffffff";
    context.fill();
    context.strokeStyle = accent;
    context.lineWidth = 4;
    context.stroke();

    if (loadedLogo) {
      const logoPadding = 17;
      context.save();
      drawRoundedRect(context, 110, 104, 124, 124, 34);
      context.clip();
      context.fillStyle = "#ffffff";
      context.fillRect(110, 104, 124, 124);
      context.drawImage(
        loadedLogo,
        110 + logoPadding,
        104 + logoPadding,
        124 - logoPadding * 2,
        124 - logoPadding * 2,
      );
      context.restore();
    } else {
      context.fillStyle = primary;
      context.font =
        "900 40px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(getInitials(branding.displayName), 172, 166);
    }

    context.textAlign = "left";
    context.textBaseline = "alphabetic";

    context.fillStyle = accent;
    context.font =
      "950 28px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    context.fillText(details.eyebrow, 262, 150);

    context.fillStyle = "#dbeafe";
    context.font =
      "850 31px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    context.fillText(branding.displayName, 262, 194);

    context.fillStyle = "#ffffff";
    context.font =
      "950 62px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

    const titleLines = wrapCanvasText(context, details.title, 850).slice(0, 3);

    let titleY = 330;

    for (const line of titleLines) {
      context.fillText(line, 110, titleY);
      titleY += 70;
    }

    context.fillStyle = "#bfdbfe";
    context.font =
      "850 31px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

    const actionLines = wrapCanvasText(context, details.action, 820).slice(0, 2);

    let actionY = Math.min(titleY + 8, 535);

    for (const line of actionLines) {
      context.fillText(line, 110, actionY);
      actionY += 40;
    }

    const qrBoxSize = 560;
    const qrBoxX = 260;
    const qrBoxY = 612;

    drawRoundedRect(
      context,
      qrBoxX - 28,
      qrBoxY - 28,
      qrBoxSize + 56,
      qrBoxSize + 56,
      42,
    );
    context.fillStyle = "#ffffff";
    context.fill();
    context.strokeStyle = accent;
    context.lineWidth = 5;
    context.stroke();

    context.drawImage(loadedQr, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);

    context.textAlign = "center";
    context.fillStyle = "#ffffff";
    context.font =
      "950 28px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    context.fillText("Scan to support securely", width / 2, 1232);

    context.fillStyle = "#bfdbfe";
    context.font =
      "750 20px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

    const hostText = details.url ? new URL(details.url).host : "";
    context.fillText(hostText, width / 2, 1264);

    const dataUrl = canvas.toDataURL("image/png");
    const filename = `${slugifyFilename(
      details.filenameSeed,
      "campaign",
    )}-qr-card.png`;

    downloadDataUrl(dataUrl, filename);
  }

  async function handleDownloadPublicHubSocialTile() {
    const qrUrl = qrImageUrl(publicHubUrl, 720);

    if (!qrUrl) return;

    const canvas = document.createElement("canvas");
    const width = 1080;
    const height = 1080;
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

    const [loadedLogo, loadedQr] = await Promise.all([
      loadImage(logoSrc),
      loadImage(qrUrl),
    ]);

    if (!loadedQr) {
      setCopied("qr-error");
      window.setTimeout(() => setCopied(""), 2600);
      return;
    }

    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#020617");
    gradient.addColorStop(0.55, "#0f172a");
    gradient.addColorStop(1, "#172554");

    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.globalAlpha = 0.22;
    context.fillStyle = primary;
    context.beginPath();
    context.arc(930, 120, 290, 0, Math.PI * 2);
    context.fill();

    context.globalAlpha = 0.2;
    context.strokeStyle = accent;
    context.lineWidth = 5;
    context.beginPath();
    context.arc(120, 1000, 260, 0, Math.PI * 2);
    context.stroke();

    context.globalAlpha = 1;

    drawRoundedRect(context, 60, 60, 960, 960, 56);
    context.fillStyle = "rgba(255,255,255,0.10)";
    context.fill();
    context.strokeStyle = "rgba(255,255,255,0.22)";
    context.lineWidth = 2;
    context.stroke();

    drawRoundedRect(context, 106, 100, 128, 128, 34);
    context.fillStyle = "#ffffff";
    context.fill();
    context.strokeStyle = accent;
    context.lineWidth = 4;
    context.stroke();

    if (loadedLogo) {
      const logoPadding = 17;
      context.save();
      drawRoundedRect(context, 106, 100, 128, 128, 34);
      context.clip();
      context.fillStyle = "#ffffff";
      context.fillRect(106, 100, 128, 128);
      context.drawImage(
        loadedLogo,
        106 + logoPadding,
        100 + logoPadding,
        128 - logoPadding * 2,
        128 - logoPadding * 2,
      );
      context.restore();
    } else {
      context.fillStyle = primary;
      context.font =
        "900 40px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(getInitials(branding.displayName), 170, 164);
    }

    context.textAlign = "left";
    context.textBaseline = "alphabetic";

    context.fillStyle = accent;
    context.font =
      "950 27px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    context.fillText("PUBLIC CAMPAIGN HUB", 266, 146);

    context.fillStyle = "#dbeafe";
    context.font =
      "850 31px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    context.fillText(branding.displayName, 266, 190);

    context.fillStyle = "#ffffff";
    context.font =
      "950 64px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

    const titleLines = wrapCanvasText(
      context,
      "Support our live fundraising campaigns",
      850,
    ).slice(0, 3);

    let titleY = 325;

    for (const line of titleLines) {
      context.fillText(line, 106, titleY);
      titleY += 72;
    }

    context.fillStyle = "#bfdbfe";
    context.font =
      "800 28px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

    const taglineLines = wrapCanvasText(
      context,
      cleanText(
        branding.tagline,
        "Browse the latest campaigns and choose how you would like to help.",
      ),
      820,
    ).slice(0, 2);

    let taglineY = Math.min(titleY + 12, 540);

    for (const line of taglineLines) {
      context.fillText(line, 106, taglineY);
      taglineY += 38;
    }

    const qrBoxSize = 330;
    const qrBoxX = 106;
    const qrBoxY = 650;

    drawRoundedRect(
      context,
      qrBoxX - 20,
      qrBoxY - 20,
      qrBoxSize + 40,
      qrBoxSize + 40,
      34,
    );
    context.fillStyle = "#ffffff";
    context.fill();
    context.strokeStyle = accent;
    context.lineWidth = 4;
    context.stroke();

    context.drawImage(loadedQr, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);

    context.textAlign = "left";
    context.fillStyle = "#ffffff";
    context.font =
      "950 34px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    context.fillText("Scan the QR code", 486, 720);

    context.fillStyle = "#bfdbfe";
    context.font =
      "800 24px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

    const instructionLines = wrapCanvasText(
      context,
      "Or tap the public hub link in the post to support securely.",
      430,
    ).slice(0, 3);

    let instructionY = 768;

    for (const line of instructionLines) {
      context.fillText(line, 486, instructionY);
      instructionY += 34;
    }

    drawRoundedRect(context, 486, 900, 420, 64, 32);
    context.fillStyle = primary;
    context.fill();

    context.fillStyle = "#ffffff";
    context.font =
      "950 24px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("View all live campaigns", 696, 932);

    const dataUrl = canvas.toDataURL("image/png");
    const filename = `${slugifyFilename(
      branding.displayName,
      "public-hub",
    )}-public-hub-social-tile.png`;

    downloadDataUrl(dataUrl, filename);
  }

  if (campaigns.length === 0) {
    return (
      <section style={styles.emptyState}>
        <h2 style={styles.emptyTitle}>No active campaigns available to share</h2>
        <p style={styles.emptyText}>
          Publish a campaign first, then return here to create a share kit for
          social posts, WhatsApp messages, emails, QR codes and posters.
        </p>
      </section>
    );
  }

  return (
    <section className="share-kit-shell" style={styles.shell}>
      <section className="share-public-hub-panel" style={styles.publicHubPanel}>
        <div style={styles.publicHubCopy}>
          <div style={styles.logoRow}>
            <div style={styles.logoWrap}>
              <img
                src={logoSrc}
                alt={branding.displayName}
                style={styles.logoImage}
              />
            </div>

            <div style={styles.logoCopy}>
              <p style={styles.kicker}>Public hub share kit</p>
              <h2 style={styles.title}>Promote all active campaigns</h2>
            </div>
          </div>

          <p style={styles.text}>
            Use the public campaign hub for posters, flyers, QR boards, social
            posts and general promotion. Supporters can browse every active
            raffle, squares game, event and auction in one branded place.
          </p>

          <div style={styles.linkBlock}>
            <span style={styles.linkLabel}>Public hub link</span>
            <strong style={styles.linkValue}>{publicHubUrl}</strong>
          </div>

          <div className="share-hub-actions" style={styles.publicHubActions}>
            <button
              type="button"
              onClick={() => handleCopy("hub-link", publicHubUrl)}
              style={{
                ...styles.primaryButton,
                background: branding.primaryColour,
                borderColor: branding.primaryColour,
              }}
            >
              Copy public hub link
            </button>

            <button
              type="button"
              onClick={() => handleCopy("hub-caption", publicHubCaption)}
              style={styles.secondaryButton}
            >
              Copy hub caption
            </button>

            <button
              type="button"
              onClick={handlePublicHubShare}
              style={styles.secondaryButton}
            >
              Share public hub
            </button>

            <button
              type="button"
              onClick={() => handleDownloadQrCard(hubQrDetails)}
              style={styles.darkButton}
            >
              Download hub QR PNG
            </button>

            <button
              type="button"
              onClick={handleDownloadPublicHubSocialTile}
              style={styles.darkButton}
            >
              Download social tile
            </button>
          </div>
        </div>

        <aside style={styles.hubQrPanel}>
          <div style={styles.qrHeader}>
            <div>
              <span style={styles.linkLabel}>QR code</span>
              <h3 style={styles.qrTitle}>Public campaign hub QR</h3>
            </div>

            <span style={styles.qrBadge}>Best default</span>
          </div>

          <div style={styles.qrPreviewBox}>
            <img
              src={hubQrPreviewUrl}
              alt={`Public campaign hub QR for ${branding.displayName}`}
              style={styles.qrImage}
            />
          </div>

          <p style={styles.qrHelpText}>
            This QR sends supporters to the public hub, not a single selected
            campaign.
          </p>

          <strong style={styles.qrUrlText}>{publicHubUrl}</strong>
        </aside>
      </section>

      <section className="share-selector-panel" style={styles.selectorPanel}>
        <div>
          <p style={styles.kicker}>Campaign-specific assets</p>
          <h2 style={styles.title}>Create assets for one campaign</h2>
          <p style={styles.text}>
            Choose a published campaign only when you want individual links,
            donation links, captions, campaign cards or QR codes for that one
            raffle, squares game, event or auction.
          </p>
        </div>

        <label style={styles.field}>
          <span style={styles.label}>Active campaign</span>
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
      </section>

      {selectedCampaign ? (
        <div className="share-kit-grid" style={styles.grid}>
          <article style={styles.previewCard}>
            <div style={styles.previewHeader}>
              <div style={styles.logoWrapLarge}>
                <img
                  src={logoSrc}
                  alt={branding.displayName}
                  style={styles.logoImage}
                />
              </div>

              <div style={styles.previewHeaderCopy}>
                <span
                  style={{
                    ...styles.typePill,
                    background: `${branding.accentColour}22`,
                    borderColor: `${branding.accentColour}88`,
                  }}
                >
                  {campaignTypeLabel(selectedCampaign.type)}
                </span>

                <span style={styles.livePill}>Active campaign</span>
              </div>
            </div>

            <div style={styles.previewBody}>
              <p style={styles.organisationName}>{branding.displayName}</p>

              <h3 style={styles.previewTitle}>{selectedCampaign.title}</h3>

              <p style={styles.previewText}>
                {selectedCampaign.description ||
                  campaignActionLabel(selectedCampaign.type)}
              </p>
            </div>

            <div style={styles.previewCallout}>
              <span style={styles.previewCalloutLabel}>Support action</span>
              <strong style={styles.previewCalloutValue}>
                {campaignActionLabel(selectedCampaign.type)}
              </strong>
            </div>

            <div className="share-preview-actions" style={styles.previewActions}>
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
                Share campaign
              </button>

              <button
                type="button"
                onClick={handleDownloadCard}
                style={styles.darkButton}
              >
                Download PNG card
              </button>

              {campaignQrDetails ? (
                <button
                  type="button"
                  onClick={() => handleDownloadQrCard(campaignQrDetails)}
                  style={styles.darkButton}
                >
                  Download campaign QR
                </button>
              ) : null}

              {supportQrDetails ? (
                <button
                  type="button"
                  onClick={() => handleDownloadQrCard(supportQrDetails)}
                  style={styles.darkButton}
                >
                  Download donation QR
                </button>
              ) : null}
            </div>

            {copied ? (
              <div
                style={{
                  ...styles.copyNotice,
                  ...(copied === "copy-error" || copied === "qr-error"
                    ? styles.copyError
                    : {}),
                }}
              >
                {copied === "copy-error"
                  ? "Copy failed. Please copy the text manually."
                  : copied === "qr-error"
                    ? "QR download failed. The QR preview can still be saved manually from the browser."
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
              <span style={styles.linkLabel}>Suggested campaign caption</span>
              <pre style={styles.captionText}>{caption}</pre>
            </div>

            <div style={styles.captionBox}>
              <span style={styles.linkLabel}>Suggested public hub caption</span>
              <pre style={styles.captionText}>{publicHubCaption}</pre>
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
    width: "100%",
    overflow: "hidden",
  },

  publicHubPanel: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 0.45fr)",
    gap: 16,
    alignItems: "start",
    padding: 22,
    borderRadius: 28,
    background:
      "radial-gradient(circle at top right, rgba(250,204,21,0.16), transparent 34%), linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)",
    border: "1px solid #fde68a",
    boxShadow: "0 14px 34px rgba(217,119,6,0.08)",
    minWidth: 0,
    overflow: "hidden",
  },

  publicHubCopy: {
    display: "grid",
    gap: 12,
    minWidth: 0,
  },

  publicHubActions: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))",
    gap: 10,
    minWidth: 0,
  },

  hubQrPanel: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 22,
    background:
      "radial-gradient(circle at top right, rgba(22,131,248,0.08), transparent 34%), #ffffff",
    border: "1px solid #dbeafe",
    boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
    minWidth: 0,
    overflow: "hidden",
  },

  logoRow: {
    display: "grid",
    gridTemplateColumns: "64px minmax(0, 1fr)",
    gap: 13,
    alignItems: "center",
    minWidth: 0,
  },

  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },

  logoWrapLarge: {
    width: 78,
    height: 78,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #dbeafe",
    boxShadow: "0 14px 30px rgba(15,23,42,0.09)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },

  logoImage: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "contain",
    padding: 8,
    boxSizing: "border-box",
  },

  logoCopy: {
    display: "grid",
    gap: 2,
    minWidth: 0,
  },

  selectorPanel: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
    gap: 16,
    alignItems: "end",
    padding: 22,
    borderRadius: 28,
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 58%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
    minWidth: 0,
    overflow: "hidden",
  },

  kicker: {
    margin: "0 0 6px",
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(24px, 4vw, 32px)",
    lineHeight: 1.05,
    letterSpacing: "-0.055em",
    overflowWrap: "anywhere",
  },

  text: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.55,
    fontWeight: 750,
    maxWidth: 820,
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
    gridTemplateColumns: "minmax(0, 0.9fr) minmax(320px, 1fr)",
    gap: 16,
    alignItems: "start",
    minWidth: 0,
    width: "100%",
  },

  previewCard: {
    display: "grid",
    gap: 16,
    padding: 22,
    borderRadius: 30,
    background:
      "radial-gradient(circle at top right, rgba(22,131,248,0.10), transparent 34%), linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)",
    border: "1px solid #bfdbfe",
    boxShadow: "0 16px 36px rgba(22,131,248,0.10)",
    minWidth: 0,
    overflow: "hidden",
    alignSelf: "start",
  },

  previewHeader: {
    display: "grid",
    gridTemplateColumns: "78px minmax(0, 1fr)",
    gap: 14,
    alignItems: "center",
    minWidth: 0,
  },

  previewHeaderCopy: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    minWidth: 0,
  },

  previewBody: {
    display: "grid",
    gap: 8,
    minWidth: 0,
  },

  organisationName: {
    margin: 0,
    color: "#2563eb",
    fontSize: 13,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    overflowWrap: "anywhere",
  },

  typePill: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    maxWidth: "100%",
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    overflowWrap: "anywhere",
  },

  livePill: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    maxWidth: "100%",
    padding: "7px 10px",
    borderRadius: 999,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontSize: 12,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  previewTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(30px, 4.6vw, 46px)",
    lineHeight: 0.98,
    letterSpacing: "-0.07em",
    overflowWrap: "anywhere",
  },

  previewText: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.5,
    fontWeight: 750,
    maxWidth: 760,
    overflowWrap: "anywhere",
  },

  previewCallout: {
    display: "grid",
    gap: 3,
    width: "fit-content",
    maxWidth: "100%",
    padding: "11px 14px",
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #dbeafe",
    boxShadow: "0 8px 18px rgba(15,23,42,0.04)",
    minWidth: 0,
  },

  previewCalloutLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  previewCalloutValue: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  previewActions: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
    gap: 10,
    marginTop: 2,
    minWidth: 0,
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
    lineHeight: 1.2,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
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
    lineHeight: 1.2,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
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
    lineHeight: 1.2,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  },

  copyNotice: {
    padding: 12,
    borderRadius: 16,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontWeight: 900,
    textAlign: "center",
    overflowWrap: "anywhere",
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
    overflow: "hidden",
    alignSelf: "start",
  },

  qrHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    minWidth: 0,
  },

  qrTitle: {
    margin: "4px 0 0",
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.08,
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
  },

  qrBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    maxWidth: "100%",
    padding: "7px 9px",
    borderRadius: 999,
    background: "#fffbeb",
    color: "#92400e",
    border: "1px solid #fde68a",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    whiteSpace: "nowrap",
  },

  qrPreviewBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 22px rgba(15,23,42,0.05)",
    minWidth: 0,
  },

  qrImage: {
    display: "block",
    width: "100%",
    maxWidth: 250,
    height: "auto",
    borderRadius: 16,
    background: "#ffffff",
  },

  qrHelpText: {
    margin: 0,
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  qrUrlText: {
    display: "block",
    padding: 10,
    borderRadius: 14,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    color: "#0f172a",
    fontSize: 12,
    lineHeight: 1.4,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },

  linkBlock: {
    display: "grid",
    gap: 6,
    padding: 13,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
    overflow: "hidden",
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
    overflow: "hidden",
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
