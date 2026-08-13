import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { trades } from "../../../db/schema";
import { getCurrentUser, isTradingLogOwner, type ChatGPTUser } from "../../chatgpt-auth";

async function currentUser(): Promise<ChatGPTUser | null> {
  if (process.env.NODE_ENV === "development") {
    return { displayName: "Joe", email: "local@preview", userId: "local-preview", fullName: "Joe" };
  }
  return getCurrentUser();
}

function numberField(value: unknown, name: string, allowZero = false) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || (allowZero ? parsed < 0 : parsed <= 0)) {
    throw new Error(`${name}格式不正确`);
  }
  return parsed;
}

export async function GET() {
  try {
    const db = await getDb();
    const rows = await db.select().from(trades).orderBy(desc(trades.tradeDate), desc(trades.id)).limit(300);
    return Response.json({ trades: rows });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "记录加载失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!isTradingLogOwner(user)) return Response.json({ error: "只有站点所有者可以记录交易" }, { status: 403 });
  const userId = user!.userId;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const symbol = body.symbol === "DOGE" ? "DOGE" : body.symbol === "HYPE" || body.symbol === undefined ? "HYPE" : null;
    const side = "long" as const;
    const tradeDate = typeof body.tradeDate === "string" ? body.tradeDate : "";
    if (!symbol) throw new Error("请选择交易币种");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)) throw new Error("交易日期格式不正确");
    const entryPrice = numberField(body.entryPrice, "开仓价格");
    const exitPrice = numberField(body.exitPrice, "平仓价格");
    const quantity = numberField(body.quantity, "数量");
    const entryFee = numberField(body.entryFee || 0, "开仓手续费", true);
    const exitFee = numberField(body.exitFee || 0, "平仓手续费", true);
    const grossPnl = (exitPrice - entryPrice) * quantity;
    const netPnl = grossPnl - entryFee * entryPrice - exitFee;
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 160) : "";
    const db = await getDb();
    const [trade] = await db.insert(trades).values({ userId, tradeDate, symbol, side, entryPrice, exitPrice, quantity, entryFee, exitFee, grossPnl, netPnl, note, createdAt: new Date().toISOString() }).returning();
    return Response.json({ trade }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "保存失败" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!isTradingLogOwner(user)) return Response.json({ error: "只有站点所有者可以删除交易" }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "记录编号无效" }, { status: 400 });
  const db = await getDb();
  await db.delete(trades).where(and(eq(trades.id, id), eq(trades.userId, userId)));
  return Response.json({ ok: true });
}
