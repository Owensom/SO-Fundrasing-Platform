import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../../src/server/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const columnsResult = await db.query(`
      select column_name
      from information_schema.columns
      where table_name = 'raffles'
      order by ordinal_position
    `);

    return res.status(200).json({
      ok: true,
      columns: columnsResult.rows.map((row) => row.column_name),
    });
  } catch (error) {
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
