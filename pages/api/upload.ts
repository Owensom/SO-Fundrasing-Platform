import type { NextApiRequest, NextApiResponse } from "next";
import { put } from "@vercel/blob";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const filename = req.headers["x-filename"] as string;

    const blob = await put(filename, req, {
      access: "public",
    });

    return res.status(200).json({
      url: blob.url,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Upload failed",
    });
  }
}
