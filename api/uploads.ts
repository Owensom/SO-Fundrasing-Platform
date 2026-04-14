import type { NextApiRequest, NextApiResponse } from "next";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

/**
 * 🚨 CRITICAL: disable body parsing
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

const CALLBACK_URL = "https://so-fundraising-platform.vercel.app/api/uploads";

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
          callbackUrl: CALLBACK_URL,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("Upload completed:", blob.url);
      },
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("api/uploads error:", error);
    return res.status(400).json({
      error: error?.message || "Upload failed",
    });
  }
}
