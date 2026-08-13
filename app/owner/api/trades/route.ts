import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { trades } from "../../../../db/schema";
import { getCurrentUser, isTradingLogOwner, type ChatGPTUser } from "../../../chatgpt-auth";

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
    const quantity = numberField(body.quantity, "数量");
    const entryFee = numberField(body.entryFee || 0, "开仓手续费", true);
    const db = await getDb();
    const [trade] = await db.insert(trades).values({
      userId,
      tradeDate,
      exitDate: null,
      symbol,
      side,
      status: "open",
      entryPrice,
      exitPrice: 0,
      quantity,
      entryFee,
      exitFee: 0,
      grossPnl: 0,
      netPnl: 0,
      note: "",
      createdAt: new Date().toISOString(),
    }).returning();
    return Response.json({ trade }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "保存失败" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!isTradingLogOwner(user)) return Response.json({ error: "只有站点所有者可以完成交易" }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "记录编号无效" }, { status: 400 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const exitDate = typeof body.exitDate === "string" ? body.exitDate : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exitDate)) throw new Error("卖出日期格式不正确");
    const exitPrice = numberField(body.exitPrice, "卖出价格");
    const exitFee = numberField(body.exitFee || 0, "卖出手续费", true);
    const db = await getDb();
    const [existing] = await db.select().from(trades).where(and(eq(trades.id, id), eq(trades.userId, user!.userId))).limit(1);
    if (!existing) return Response.json({ error: "找不到这笔持仓" }, { status: 404 });
    if (existing.status !== "open") return Response.json({ error: "这笔交易已经完成" }, { status: 409 });
    if (exitDate < existing.tradeDate) throw new Error("卖出日期不能早于买入日期");

    const grossPnl = (exitPrice - existing.entryPrice) * existing.quantity;
    const netPnl = grossPnl - existing.entryFee * existing.entryPrice - exitFee;
    const [trade] = await db.update(trades).set({
      status: "closed",
      exitDate,
      exitPrice,
      exitFee,
      grossPnl,
      netPnl,
    }).where(and(eq(trades.id, id), eq(trades.userId, user!.userId), eq(trades.status, "open"))).returning();

    if (!trade) return Response.json({ error: "这笔交易已经完成" }, { status: 409 });
    return Response.json({ trade });
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
  await db.delete(trades).where(and(eq(trades.id, id), eq(trades.userId, user!.userId)));
  return Response.json({ ok: true });
}
