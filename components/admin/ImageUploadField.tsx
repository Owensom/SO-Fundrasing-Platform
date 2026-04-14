import React, { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import type { PutBlobResult } from "@vercel/blob";

type Props = {
  label: string;
  value?: string;
  onChange: (url: string) => void;
};

function makeSafeFilename(file: File) {
  const cleanName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `raffles/${Date.now()}-${cleanName || "image"}`;
}

export default function ImageUploadField({
  label,
  value = "",
  onChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleSelectedFile(file: File) {
    setUploading(true);
    setError("");

    try {
      const blob: PutBlobResult = await upload(makeSafeFilename(file), file, {
        access: "public",
        handleUploadUrl: "/api/uploads",
      });

      onChange(blob.url);
    } catch (err: any) {
      console.error("Image upload failed:", err);
      setError(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <label style={styles.label}>{label}</label>

      {value ? (
        <div style={styles.previewWrap}>
          <img src={value} alt={label} style={styles.previewImage} />
        </div>
      ) : (
        <div style={styles.placeholder}>No image uploaded</div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleSelectedFile(file);
          }
        }}
      />

      <div style={styles.actions}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={styles.button}
        >
          {uploading ? "Uploading..." : "Upload image"}
        </button>

        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            style={styles.removeButton}
          >
            Remove
          </button>
        ) : null}
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  label: {
    fontWeight: 600,
    fontSize: 14,
  },
  previewWrap: {
    width: "100%",
    borderRadius: 10,
    overflow: "hidden",
    border: "1px solid #d1d5db",
    background: "#fff",
  },
  previewImage: {
    display: "block",
    width: "100%",
    maxHeight: 220,
    objectFit: "cover",
  },
  placeholder: {
    minHeight: 120,
    borderRadius: 10,
    border: "1px dashed #d1d5db",
    background: "#f9fafb",
    color: "#6b7280",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
  },
  actions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  button: {
    height: 40,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  removeButton: {
    height: 40,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #dc2626",
    background: "#fff",
    color: "#dc2626",
    cursor: "pointer",
    fontWeight: 600,
  },
  error: {
    padding: 10,
    borderRadius: 10,
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    fontSize: 14,
  },
};
