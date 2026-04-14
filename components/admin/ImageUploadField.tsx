import React, { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
};

export default function ImageUploadField({ label, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!file) return;

    setUploading(true);

    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/uploads",
      });

      onChange(blob.url);
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={styles.container}>
      <label style={styles.label}>{label}</label>

      {value ? (
        <img src={value} style={styles.preview} />
      ) : (
        <div style={styles.placeholder}>No image</div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handleFile(e.target.files[0]);
          }
        }}
      />

      <button
        type="button"
        style={styles.button}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? "Uploading..." : "Upload image"}
      </button>

      {value && (
        <button
          type="button"
          style={styles.remove}
          onClick={() => onChange("")}
        >
          Remove
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", gap: 8 },
  label: { fontWeight: 600 },
  preview: { width: 120, height: 120, objectFit: "cover", borderRadius: 8 },
  placeholder: {
    width: 120,
    height: 120,
    background: "#eee",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  button: {
    height: 36,
    borderRadius: 8,
    border: "1px solid #ccc",
    background: "#fff",
    cursor: "pointer",
  },
  remove: {
    background: "transparent",
    border: "none",
    color: "red",
    cursor: "pointer",
  },
};
