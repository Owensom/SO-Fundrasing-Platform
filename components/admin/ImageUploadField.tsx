import React, { useState } from "react";

export default function ImageUploadField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/uploads", {
      method: "POST",
      body: formData,
    });

    const json = await res.json();

    setUploading(false);

    if (json?.url) {
      onChange(json.url);
    } else {
      alert("Upload failed");
    }
  }

  return (
    <div>
      <label style={{ fontWeight: 600 }}>{label}</label>

      {value && (
        <div style={{ margin: "10px 0" }}>
          <img
            src={value}
            style={{ width: "100%", maxHeight: 200, objectFit: "cover" }}
          />
        </div>
      )}

      <input type="file" accept="image/*" onChange={handleFile} />

      {uploading && <p>Uploading...</p>}
    </div>
  );
}
