"use client";

import { useState, type CSSProperties } from "react";

type Props = {
  currentImageUrl?: string | null;
  currentFocusX?: number | null;
  currentFocusY?: number | null;
  imageFieldName?: string;
  focusXFieldName?: string;
  focusYFieldName?: string;
  label?: string;
  previewAlt?: string;
  onImageUrlChange?: (url: string) => void;
  onFocusXChange?: (value: number) => void;
  onFocusYChange?: (value: number) => void;
  subscriptionTier?: string | null;
  customImagesAllowed?: boolean;
};

function cleanFocus(value: number | null | undefined) {
  const number = Number(value);

  if (!Number.isFinite(number)) return 50;

  return Math.max(0, Math.min(100, Math.round(number)));
}

export default function ImageFocusUploadField({
  currentImageUrl = "",
  currentFocusX = 50,
  currentFocusY = 50,
  imageFieldName = "image_url",
  focusXFieldName = "image_focus_x",
  focusYFieldName = "image_focus_y",
  label = "Image upload",
  previewAlt = "Uploaded image preview",
  onImageUrlChange,
  onFocusXChange,
  onFocusYChange,
  subscriptionTier = "community",
  customImagesAllowed,
}: Props) {
  const [imageUrl, setImageUrl] = useState(currentImageUrl || "");
  const [focusX, setFocusX] = useState(cleanFocus(currentFocusX));
  const [focusY, setFocusY] = useState(cleanFocus(currentFocusY));
  const [uploading, setUploading] = useState(false);

  const cleanTier = String(subscriptionTier || "community").toLowerCase();

  const uploadsAllowed =
    typeof customImagesAllowed === "boolean"
      ? customImagesAllowed
      : cleanTier === "professional" || cleanTier === "foundation";

  const uploadsLocked = !uploadsAllowed;

  function updateImageUrl(url: string) {
    setImageUrl(url);
    onImageUrlChange?.(url);
  }

  function updateFocusX(value: number) {
    const clean = cleanFocus(value);

    setFocusX(clean);
    onFocusXChange?.(clean);
  }

  function updateFocusY(value: number) {
    const clean = cleanFocus(value);

    setFocusY(clean);
    onFocusYChange?.(clean);
  }

  async function uploadImage(file: File) {
    if (uploadsLocked) {
      alert("Custom campaign images require the Professional plan or higher.");
      return;
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !preset) {
      alert("Cloudinary settings are missing.");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("upload_preset", preset);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok || !data.secure_url) {
        console.error(data);
        alert("Image upload failed.");
        return;
      }

      updateImageUrl(data.secure_url);
    } catch (error) {
      console.error(error);
      alert("Upload error");
    } finally {
      setUploading(false);
    }
  }

  const previewImageStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: `${focusX}% ${focusY}%`,
    display: "block",
  };

  return (
    <div style={styles.wrapper}>
      <input type="hidden" name={imageFieldName} value={imageUrl} />
      <input type="hidden" name={focusXFieldName} value={focusX} />
      <input type="hidden" name={focusYFieldName} value={focusY} />

      <div style={styles.headerRow}>
        <div style={styles.headerText}>
          <div style={styles.title}>{label}</div>

          <div style={styles.subtitle}>
            Upload campaign artwork and adjust crop focus positioning.
          </div>
        </div>

        <div
          style={{
            ...styles.planPill,
            ...(uploadsLocked
              ? styles.communityPill
              : styles.professionalPill),
          }}
        >
          {uploadsLocked
            ? "Professional feature"
            : cleanTier === "foundation"
              ? "Foundation enabled"
              : "Professional enabled"}
        </div>
      </div>

      {uploadsLocked ? (
        <div style={styles.lockedCard}>
          <div style={styles.lockedTitle}>
            Custom campaign images are locked
          </div>

          <p style={styles.lockedText}>
            Community campaigns use the premium SO platform default artwork.
            Upgrade to Professional or Foundation to upload custom branding,
            sponsor artwork, event banners and prize imagery.
          </p>

          <div style={styles.upgradeRow}>
            <div style={styles.upgradePrice}>Professional · £25/month</div>
            <div style={styles.upgradePrice}>Foundation · £99/month</div>
          </div>
        </div>
      ) : null}

      <label
        style={{
          ...styles.label,
          ...(uploadsLocked ? styles.disabledLabel : {}),
        }}
      >
        Upload image
        <input
          type="file"
          accept="image/*"
          disabled={uploadsLocked || uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              uploadImage(file);
            }
          }}
          style={{
            ...styles.fileInput,
            ...(uploadsLocked ? styles.disabledInput : {}),
          }}
        />
      </label>

      {uploading ? <p style={styles.muted}>Uploading image...</p> : null}

      {imageUrl ? (
        <>
          <div style={styles.previewGrid}>
            <div style={styles.previewColumn}>
              <div style={styles.previewLabel}>Wide banner preview</div>

              <div style={styles.bannerPreview}>
                <img
                  src={imageUrl}
                  alt={previewAlt}
                  style={previewImageStyle}
                />

                <div
                  style={{
                    ...styles.crosshair,
                    left: `${focusX}%`,
                    top: `${focusY}%`,
                  }}
                />
              </div>
            </div>

            <div style={styles.previewColumn}>
              <div style={styles.previewLabel}>Card preview</div>

              <div style={styles.cardPreview}>
                <img
                  src={imageUrl}
                  alt={previewAlt}
                  style={previewImageStyle}
                />

                <div
                  style={{
                    ...styles.crosshair,
                    left: `${focusX}%`,
                    top: `${focusY}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div style={styles.controls}>
            <label style={styles.label}>
              Horizontal focus: {focusX}%
              <input
                type="range"
                min="0"
                max="100"
                value={focusX}
                disabled={uploadsLocked}
                onChange={(event) => updateFocusX(Number(event.target.value))}
                style={styles.range}
              />
            </label>

            <label style={styles.label}>
              Vertical focus: {focusY}%
              <input
                type="range"
                min="0"
                max="100"
                value={focusY}
                disabled={uploadsLocked}
                onChange={(event) => updateFocusY(Number(event.target.value))}
                style={styles.range}
              />
            </label>
          </div>

          <p style={styles.urlText}>{imageUrl}</p>
        </>
      ) : (
        <div style={styles.emptyPreview}>
          {uploadsLocked
            ? "Community campaigns use the SO platform default image."
            : "Upload an image to preview and set the crop focus."}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: "grid",
    gap: 14,
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    overflow: "hidden",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  headerText: {
    display: "grid",
    gap: 4,
  },
  title: {
    color: "#0f172a",
    fontWeight: 950,
    fontSize: 18,
  },
  subtitle: {
    color: "#64748b",
    fontWeight: 700,
    fontSize: 13,
  },
  planPill: {
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  communityPill: {
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fde68a",
  },
  professionalPill: {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
  },
  lockedCard: {
    display: "grid",
    gap: 10,
    padding: 18,
    borderRadius: 18,
    background: "linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)",
    border: "1px solid #fed7aa",
  },
  lockedTitle: {
    color: "#9a3412",
    fontWeight: 950,
    fontSize: 18,
  },
  lockedText: {
    margin: 0,
    color: "#7c2d12",
    lineHeight: 1.6,
    fontWeight: 700,
  },
  upgradeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  upgradePrice: {
    padding: "8px 10px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid #fdba74",
    color: "#9a3412",
    fontWeight: 900,
    fontSize: 12,
  },
  label: {
    display: "grid",
    gap: 7,
    color: "#0f172a",
    fontWeight: 900,
    minWidth: 0,
    maxWidth: "100%",
  },
  disabledLabel: {
    opacity: 0.72,
  },
  fileInput: {
    display: "block",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    padding: 10,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    minWidth: 0,
  },
  disabledInput: {
    cursor: "not-allowed",
    background: "#f8fafc",
  },
  muted: {
    margin: 0,
    color: "#64748b",
    fontWeight: 800,
  },
  previewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
    gap: 14,
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
  },
  previewColumn: {
    minWidth: 0,
    maxWidth: "100%",
  },
  previewLabel: {
    marginBottom: 8,
    color: "#475569",
    fontSize: 13,
    fontWeight: 900,
  },
  bannerPreview: {
    position: "relative",
    width: "100%",
    minHeight: 170,
    aspectRatio: "16 / 9",
    borderRadius: 18,
    overflow: "hidden",
    background: "#e2e8f0",
    border: "1px solid #cbd5e1",
  },
  cardPreview: {
    position: "relative",
    width: "100%",
    minHeight: 170,
    aspectRatio: "4 / 3",
    borderRadius: 18,
    overflow: "hidden",
    background: "#e2e8f0",
    border: "1px solid #cbd5e1",
  },
  crosshair: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 999,
    border: "3px solid #ffffff",
    boxShadow: "0 0 0 2px rgba(15,23,42,0.75)",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  },
  controls: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
    gap: 14,
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
  },
  range: {
    width: "100%",
    maxWidth: "100%",
  },
  urlText: {
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    wordBreak: "break-all",
    overflowWrap: "anywhere",
    maxWidth: "100%",
  },
  emptyPreview: {
    padding: 18,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 800,
    overflowWrap: "anywhere",
  },
};
