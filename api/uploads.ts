import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const json = await handleUpload({
      body: req.body as HandleUploadBody,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const safePathname =
          typeof pathname === "string" && pathname.trim()
            ? pathname.trim()
            : `uploads/${Date.now()}.bin`;

        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          addRandomSuffix: true,
          maximumSizeInBytes: 5 * 1024 * 1024,
          pathname: safePathname,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("Blob upload completed:", blob.url);
      },
    });

    return res.status(200).json(json);
  } catch (error: any) {
    console.error("Blob upload error:", error);
    return res.status(500).json({
      error: error?.message || "Upload failed",
    });
  }
}
