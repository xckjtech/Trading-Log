import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const trades = sqliteTable(
  "trades",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    tradeDate: text("trade_date").notNull(),
    symbol: text("symbol", { enum: ["HYPE", "DOGE"] }).notNull().default("HYPE"),
    side: text("side", { enum: ["long", "short"] }).notNull(),
    entryPrice: real("entry_price").notNull(),
    exitPrice: real("exit_price").notNull(),
    quantity: real("quantity").notNull(),
    entryFee: real("entry_fee").notNull().default(0),
    exitFee: real("exit_fee").notNull().default(0),
    grossPnl: real("gross_pnl").notNull(),
    netPnl: real("net_pnl").notNull(),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_trades_user_date").on(table.userId, table.tradeDate)],
);
