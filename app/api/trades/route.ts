import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { trades } from "../../../db/schema";

export async function GET() {
  try {
    const db = await getDb();
    const rows = await db.select().from(trades).orderBy(desc(trades.tradeDate), desc(trades.id)).limit(300);
    return Response.json({ trades: rows });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "记录加载失败" }, { status: 500 });
  }
}
