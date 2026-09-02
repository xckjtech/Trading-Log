import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { trades } from "../../../../db/schema";
import { getCloudflareAccessUser, isTradingLogOwner, type AuthenticatedUser } from "../../../auth";

async function currentUser(): Promise<AuthenticatedUser | null> {
  if (process.env.NODE_ENV === "development") {
    return { displayName: "Joe", email: "local@preview", userId: "local-preview" };
  }
  return getCloudflareAccessUser();
}

function numberField(value: unknown, name: string, allowZero = false) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed > Number.MAX_SAFE_INTEGER || (allowZero ? parsed < 0 : parsed <= 0)) {
    throw new Error(`${name}格式不正确`);
  }
  return parsed;
}

function dateField(value: unknown, name: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${name}格式不正确`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
    throw new Error(`${name}格式不正确`);
  }
  return value;
}

function calculatePnl(entryPrice: number, exitPrice: number, quantity: number, entryFee: number, exitFee: number) {
  const grossPnl = (exitPrice - entryPrice) * quantity;
  const netPnl = grossPnl - entryFee * entryPrice - exitFee;
  if (!Number.isFinite(grossPnl) || !Number.isFinite(netPnl)) throw new Error("交易金额超出支持范围");
  return { grossPnl, netPnl };
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!isTradingLogOwner(user)) return Response.json({ error: "只有站点所有者可以记录交易" }, { status: 403 });
  const userId = user!.userId;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const symbol = body.symbol === "DOGE" ? "DOGE" : body.symbol === "HYPE" || body.symbol === undefined ? "HYPE" : null;
    const side = "long" as const;
    const tradeDate = dateField(body.tradeDate, "交易日期");
    if (!symbol) throw new Error("请选择交易币种");
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
  if (!isTradingLogOwner(user)) return Response.json({ error: "只有站点所有者可以修改交易" }, { status: 403 });
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "记录编号无效" }, { status: 400 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const db = await getDb();
    const [existing] = await db.select().from(trades).where(and(eq(trades.id, id), eq(trades.userId, user!.userId))).limit(1);
    if (!existing) return Response.json({ error: "找不到这笔交易" }, { status: 404 });

    if (url.searchParams.get("action") === "edit") {
      const symbol = body.symbol === "HYPE" || body.symbol === "DOGE" ? body.symbol : null;
      const tradeDate = dateField(body.tradeDate, "交易日期");
      if (!symbol) throw new Error("请选择交易币种");
      const entryPrice = numberField(body.entryPrice, "开仓价格");
      const quantity = numberField(body.quantity, "数量");
      const entryFee = numberField(body.entryFee || 0, "开仓手续费", true);

      if (existing.status === "open") {
        const [trade] = await db.update(trades).set({
          symbol,
          tradeDate,
          entryPrice,
          quantity,
          entryFee,
        }).where(and(eq(trades.id, id), eq(trades.userId, user!.userId), eq(trades.status, "open"))).returning();
        if (!trade) return Response.json({ error: "这笔交易状态已经改变，请刷新后重试" }, { status: 409 });
        return Response.json({ trade });
      }

      const exitDate = dateField(body.exitDate, "卖出日期");
      if (exitDate < tradeDate) throw new Error("卖出日期不能早于买入日期");
      const exitPrice = numberField(body.exitPrice, "卖出价格");
      const exitFee = numberField(body.exitFee || 0, "卖出手续费", true);
      const { grossPnl, netPnl } = calculatePnl(entryPrice, exitPrice, quantity, entryFee, exitFee);
      const [trade] = await db.update(trades).set({
        symbol,
        tradeDate,
        exitDate,
        entryPrice,
        exitPrice,
        quantity,
        entryFee,
        exitFee,
        grossPnl,
        netPnl,
      }).where(and(eq(trades.id, id), eq(trades.userId, user!.userId), eq(trades.status, "closed"))).returning();
      if (!trade) return Response.json({ error: "这笔交易状态已经改变，请刷新后重试" }, { status: 409 });
      return Response.json({ trade });
    }

    const exitDate = dateField(body.exitDate, "卖出日期");
    const exitPrice = numberField(body.exitPrice, "卖出价格");
    const exitFee = numberField(body.exitFee || 0, "卖出手续费", true);
    if (existing.status !== "open") return Response.json({ error: "这笔交易已经完成" }, { status: 409 });
    if (exitDate < existing.tradeDate) throw new Error("卖出日期不能早于买入日期");

    const { grossPnl, netPnl } = calculatePnl(existing.entryPrice, exitPrice, existing.quantity, existing.entryFee, exitFee);
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
  const [existing] = await db.select({ status: trades.status }).from(trades).where(and(eq(trades.id, id), eq(trades.userId, user!.userId))).limit(1);
  if (!existing) return Response.json({ error: "找不到这笔交易" }, { status: 404 });

  await db.delete(trades).where(and(eq(trades.id, id), eq(trades.userId, user!.userId)));
  return Response.json({ ok: true });
}
