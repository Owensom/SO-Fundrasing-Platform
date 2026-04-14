import type { NextApiRequest, NextApiResponse } from "next";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const result = await handleUpload({
      body: req.body as HandleUploadBody,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const safePathname =
          typeof pathname === "string" && pathname.trim()
            ? pathname.trim()
            : `raffles/${Date.now()}-image`;

        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          addRandomSuffix: true,
          maximumSizeInBytes: 5 * 1024 * 1024,
          pathname: safePathname,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("Upload completed:", blob.url);
      },
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("api/uploads error:", error);
    return res.status(500).json({
      error: error?.message || "Upload failed",
    });
  }
}
