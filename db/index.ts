import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

let initialized = false;

export async function getDb() {
  if (!env.DB) throw new Error("交易数据库暂时不可用");
  if (!initialized) {
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        trade_date TEXT NOT NULL,
        symbol TEXT NOT NULL DEFAULT 'HYPE',
        side TEXT NOT NULL CHECK (side IN ('long', 'short')),
        entry_price REAL NOT NULL,
        exit_price REAL NOT NULL,
        quantity REAL NOT NULL,
        entry_fee REAL NOT NULL DEFAULT 0,
        exit_fee REAL NOT NULL DEFAULT 0,
        gross_pnl REAL NOT NULL,
        net_pnl REAL NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      )`),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_trades_user_date ON trades(user_id, trade_date)"),
    ]);
    try {
      await env.DB.prepare("ALTER TABLE trades ADD COLUMN symbol TEXT NOT NULL DEFAULT 'HYPE'").run();
    } catch (error) {
      if (!String(error).toLowerCase().includes("duplicate column name")) throw error;
    }
    initialized = true;
  }
  return drizzle(env.DB, { schema });
}
