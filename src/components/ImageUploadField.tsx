"use client";

import { useState } from "react";

export default function ImageUploadField({
  currentImageUrl,
}: {
  currentImageUrl: string;
}) {
  const [imageUrl, setImageUrl] = useState(currentImageUrl);
  const [uploading, setUploading] = useState(false);

  async function uploadImage(file: File) {
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

      setImageUrl(data.secure_url);
    } catch (err) {
      console.error(err);
      alert("Upload error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label>
        Image upload
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) uploadImage(file);
          }}
          style={{
            display: "block",
            width: "100%",
            padding: 10,
            marginTop: 6,
          }}
        />
      </label>

      <input type="hidden" name="image_url" value={imageUrl} />

      {uploading && (
        <p style={{ marginTop: 8 }}>Uploading image...</p>
      )}

      {imageUrl && (
        <div style={{ marginTop: 12 }}>
          <img
            src={imageUrl}
            alt="Uploaded"
            style={{
              maxWidth: 240,
              borderRadius: 12,
              display: "block",
              marginBottom: 8,
            }}
          />
          <p
            style={{
              fontSize: 12,
              wordBreak: "break-all",
              color: "#6b7280",
            }}
          >
            {imageUrl}
          </p>
        </div>
      )}
    </div>
  );
}
