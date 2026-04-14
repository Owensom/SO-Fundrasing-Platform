import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleUpload } from "@vercel/blob/client";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const json = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          maximumSizeInBytes: 5 * 1024 * 1024, // 5MB
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("Upload complete:", blob.url);
      },
    });

    return res.status(200).json(json);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
