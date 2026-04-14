import type { NextApiRequest, NextApiResponse } from "next";
import { put } from "@vercel/blob";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRequestBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];

  return await new Promise<Buffer>((resolve, reject) => {
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function getBoundary(contentType: string): string | null {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return match?.[1] || match?.[2] || null;
}

function parseMultipartFormData(
  body: Buffer,
  boundary: string
): { filename: string; contentType: string; fileBuffer: Buffer } | null {
  const boundaryText = `--${boundary}`;
  const bodyText = body.toString("latin1");
  const parts = bodyText.split(boundaryText);

  for (const part of parts) {
    if (!part || part === "--\r\n" || part === "--") continue;

    const [rawHeaders, rawContent] = part.split("\r\n\r\n");
    if (!rawHeaders || !rawContent) continue;

    const dispositionMatch = rawHeaders.match(
      /content-disposition:[^\n]*name="file"; filename="([^"]+)"/i
    );
    if (!dispositionMatch) continue;

    const filename = dispositionMatch[1] || "image";
    const contentTypeMatch = rawHeaders.match(/content-type:\s*([^\r\n]+)/i);
    const contentType = contentTypeMatch?.[1]?.trim() || "application/octet-stream";

    // Remove trailing CRLF and optional --
    let content = rawContent;
    if (content.endsWith("\r\n")) content = content.slice(0, -2);
    if (content.endsWith("--")) content = content.slice(0, -2);
    if (content.endsWith("\r\n")) content = content.slice(0, -2);

    return {
      filename,
      contentType,
      fileBuffer: Buffer.from(content, "latin1"),
    };
  }

  return null;
}

function makeSafeFilename(filename: string) {
  const clean = String(filename || "image")
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `raffles/${Date.now()}-${clean || "image"}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const contentType = req.headers["content-type"] || "";
    const boundary = getBoundary(contentType);

    if (!boundary) {
      return res.status(400).json({ error: "Missing multipart boundary" });
    }

    const bodyBuffer = await readRequestBody(req);
    const parsed = parseMultipartFormData(bodyBuffer, boundary);

    if (!parsed) {
      return res.status(400).json({ error: "No file found in upload" });
    }

    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowedTypes.has(parsed.contentType)) {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    const blob = await put(makeSafeFilename(parsed.filename), parsed.fileBuffer, {
      access: "public",
      contentType: parsed.contentType,
      addRandomSuffix: true,
    });

    return res.status(200).json({
      url: blob.url,
      pathname: blob.pathname,
    });
  } catch (error: any) {
    console.error("api/uploads error:", error);
    return res.status(500).json({
      error: error?.message || "Upload failed",
    });
  }
}
