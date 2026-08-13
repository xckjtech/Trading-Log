"use client";

import { FormEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Trade = {
  id: number;
  tradeDate: string;
  symbol?: "HYPE" | "DOGE";
  side: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  entryFee: number;
  exitFee: number;
  grossPnl: number;
  netPnl: number;
  note: string;
  createdAt: string;
};

type Draft = {
  tradeDate: string;
  symbol: "HYPE" | "DOGE";
  entryPrice: string;
  exitPrice: string;
  quantity: string;
  entryFee: string;
  exitFee: string;
  note: string;
};

type GrowthPoint = {
  date: string;
  daily: number;
  cumulative: number;
  equity: number;
  baseline?: boolean;
};

const STARTING_CAPITAL = 20_000;

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const emptyDraft = (): Draft => ({
  tradeDate: today(),
  symbol: "HYPE",
  entryPrice: "",
  exitPrice: "",
  quantity: "",
  entryFee: "",
  exitFee: "",
  note: "",
});

const money = (value: number, signed = false) =>
  `${signed && value > 0 ? "+" : ""}${value < 0 ? "−" : ""}$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const compact = (value: number) =>
  value.toLocaleString("en-US", { maximumFractionDigits: 6 });

const tradeSymbol = (trade: Trade) => trade.symbol ?? "HYPE";

function previewPnl(draft: Draft) {
  const entry = Number(draft.entryPrice) || 0;
  const exit = Number(draft.exitPrice) || 0;
  const quantity = Number(draft.quantity) || 0;
  const fees = (Number(draft.entryFee) || 0) * entry + (Number(draft.exitFee) || 0);
  const gross = (exit - entry) * quantity;
  return gross - fees;
}

function GrowthChart({ points, tradingDayCount }: { points: GrowthPoint[]; tradingDayCount: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const activeIndex = points.length
    ? Math.min(selectedIndex ?? points.length - 1, points.length - 1)
    : 0;
  const selected = points.length ? points[activeIndex] : undefined;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;

    const draw = () => {
      const width = canvas.getBoundingClientRect().width;
      const height = 172;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const pad = { top: 17, right: 14, bottom: 28, left: 14 };
      const plotWidth = width - pad.left - pad.right;
      const plotHeight = height - pad.top - pad.bottom;
      const values = points.map((point) => point.equity);
      const rawMin = Math.min(...values);
      const rawMax = Math.max(...values);
      const baseRange = rawMax - rawMin || Math.max(Math.abs(rawMax) * 0.02, 1);
      const min = rawMin - baseRange * 0.14;
      const max = rawMax + baseRange * 0.14;
      const x = (index: number) => pad.left + (index / Math.max(points.length - 1, 1)) * plotWidth;
      const y = (value: number) => pad.top + ((max - value) / (max - min)) * plotHeight;
      const lineColor = points.at(-1)!.cumulative >= 0 ? "#39e6a4" : "#ff6b72";

      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(135,146,142,.13)";
      for (let row = 0; row <= 3; row += 1) {
        const gridY = pad.top + (plotHeight / 3) * row;
        ctx.beginPath();
        ctx.moveTo(pad.left, gridY);
        ctx.lineTo(width - pad.right, gridY);
        ctx.stroke();
      }

      const baselineY = y(points[0].equity);
      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = "rgba(214,255,70,.28)";
      ctx.beginPath();
      ctx.moveTo(pad.left, baselineY);
      ctx.lineTo(width - pad.right, baselineY);
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(x(index), y(point.equity));
        else ctx.lineTo(x(index), y(point.equity));
      });
      ctx.lineTo(x(points.length - 1), pad.top + plotHeight);
      ctx.lineTo(x(0), pad.top + plotHeight);
      ctx.closePath();
      const fill = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotHeight);
      fill.addColorStop(0, points.at(-1)!.cumulative >= 0 ? "rgba(57,230,164,.20)" : "rgba(255,107,114,.18)");
      fill.addColorStop(1, "rgba(9,13,12,0)");
      ctx.fillStyle = fill;
      ctx.fill();

      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(x(index), y(point.equity));
        else ctx.lineTo(x(index), y(point.equity));
      });
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = lineColor;
      ctx.shadowColor = lineColor;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      const active = activeIndex;
      const activeX = x(active);
      const activeY = y(points[active].equity);
      ctx.strokeStyle = "rgba(244,247,245,.20)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(activeX, pad.top);
      ctx.lineTo(activeX, pad.top + plotHeight);
      ctx.stroke();
      ctx.fillStyle = "#0d1210";
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(activeX, activeY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      points.forEach((point, index) => {
        ctx.fillStyle = lineColor;
        ctx.beginPath();
        ctx.arc(x(index), y(point.equity), 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = "#66716d";
      ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textBaseline = "bottom";
      const labelStep = Math.max(1, Math.ceil((points.length - 1) / 6));
      const labelIndexes = [...new Set([
        ...Array.from({ length: points.length }, (_, index) => index).filter((index) => index % labelStep === 0),
        points.length - 1,
      ])];
      labelIndexes.forEach((index) => {
        const pointX = x(index);
        ctx.textAlign = index === 0 ? "left" : index === points.length - 1 ? "right" : "center";
        const label = points[index].baseline ? "起始" : points[index].date.slice(5).replace("-", "/");
        ctx.fillText(label, pointX, height - 5);
      });
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [activeIndex, points]);

  function selectPoint(event: PointerEvent<HTMLCanvasElement>) {
    if (points.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const plotWidth = Math.max(1, rect.width - 28);
    const position = Math.min(1, Math.max(0, (event.clientX - rect.left - 14) / plotWidth));
    setSelectedIndex(Math.round(position * (points.length - 1)));
  }

  return (
    <section className="growth-section">
      <div className="growth-head">
        <div><h2>收益增长</h2></div>
        <span className="day-count">{tradingDayCount} 个交易日</span>
      </div>
      <div className="growth-card">
        {points.length === 0 ? (
          <div className="growth-empty">
            <span className="growth-symbol growth-chart-icon" aria-hidden="true" />
            <div><strong>记录后生成净值曲线</strong></div>
          </div>
        ) : (
          <>
            <div className="chart-summary">
              <div><span>{selected!.baseline ? "起始本金" : selected!.date}</span><small>{selected!.baseline ? "账户起点" : `当日 ${money(selected!.daily, true)}`}</small></div>
              <strong className={selected!.cumulative >= 0 ? "positive" : "negative"}>{money(selected!.equity)}</strong>
            </div>
            <canvas
              ref={canvasRef}
              className="growth-canvas"
              onPointerDown={selectPoint}
              onPointerMove={(event) => event.pointerType === "mouse" && selectPoint(event)}
              role="img"
              aria-label={`账户净值增长曲线，最新净值 ${money(points.at(-1)!.equity)}`}
            />
          </>
        )}
      </div>
    </section>
  );
}

function CapitalOverview({ currentEquity, totalNet, returnRate }: { currentEquity: number; totalNet: number; returnRate: number }) {
  return (
    <section className="capital-overview" aria-label="资金概览">
      <div className="capital-heading">
        <div><h2>资金概览</h2></div>
        <span className="capital-currency">USD / USDT</span>
      </div>
      <div className="capital-grid">
        <div className="capital-metric">
          <span>起始本金</span>
          <strong>{money(STARTING_CAPITAL)}</strong>
        </div>
        <div className="capital-metric">
          <span>当前净值</span>
          <strong className={currentEquity >= STARTING_CAPITAL ? "positive" : "negative"}>{money(currentEquity)}</strong>
        </div>
        <div className="capital-metric">
          <span>累计回报</span>
          <strong className={totalNet >= 0 ? "positive" : "negative"}>{totalNet > 0 ? "+" : ""}{returnRate.toFixed(2)}%</strong>
        </div>
      </div>
    </section>
  );
}

export default function TradeJournal({
  displayName,
  canWrite,
  signInHref,
  ownerSessionHref,
}: {
  displayName: string;
  canWrite: boolean;
  signInHref?: string;
  ownerSessionHref?: string;
}) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [ownerReady, setOwnerReady] = useState(canWrite);
  const [activeDisplayName, setActiveDisplayName] = useState(displayName);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"today" | "all">("today");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadTrades = useCallback(async () => {
    const response = await fetch("/api/trades", { cache: "no-store" });
    const payload = (await response.json()) as { trades?: Trade[]; error?: string };
    if (!response.ok) throw new Error(payload.error || "记录加载失败");
    return payload.trades ?? [];
  }, []);

  useEffect(() => {
    let mounted = true;
    void loadTrades()
      .then((nextTrades) => {
        if (mounted) setTrades(nextTrades);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : "记录加载失败");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [loadTrades]);

  useEffect(() => {
    if (!ownerSessionHref || canWrite) return;
    let mounted = true;
    void fetch(ownerSessionHref, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as {
          authenticated?: boolean;
          displayName?: string;
        };
        if (mounted && payload.authenticated) {
          setOwnerReady(true);
          if (payload.displayName) setActiveDisplayName(payload.displayName);
        }
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [canWrite, ownerSessionHref]);

  const todayTrades = useMemo(
    () => trades.filter((trade) => trade.tradeDate === today()),
    [trades],
  );
  const visibleTrades = filter === "today" ? todayTrades : trades;
  const totalNet = useMemo(
    () => trades.reduce((sum, trade) => sum + trade.netPnl, 0),
    [trades],
  );
  const growthPoints = useMemo(() => {
    const daily = new Map<string, number>();
    trades.forEach((trade) => daily.set(trade.tradeDate, (daily.get(trade.tradeDate) ?? 0) + trade.netPnl));
    const sortedDaily = [...daily.entries()].sort(([dateA], [dateB]) => dateA.localeCompare(dateB));
    if (sortedDaily.length === 0) return [];

    let cumulative = 0;
    const firstDate = sortedDaily[0][0];
    return [
      { date: firstDate, daily: 0, cumulative: 0, equity: STARTING_CAPITAL, baseline: true },
      ...sortedDaily.map(([date, dailyNet]) => {
        cumulative += dailyNet;
        return { date, daily: dailyNet, cumulative, equity: STARTING_CAPITAL + cumulative };
      }),
    ];
  }, [trades]);
  const currentEquity = STARTING_CAPITAL + totalNet;
  const returnRate = (totalNet / STARTING_CAPITAL) * 100;
  const stats = useMemo(() => {
    const scopedTrades = filter === "today" ? todayTrades : trades;
    const net = scopedTrades.reduce((sum, trade) => sum + trade.netPnl, 0);
    const fees = scopedTrades.reduce(
      (sum, trade) => sum + trade.entryFee * trade.entryPrice + trade.exitFee,
      0,
    );
    const wins = scopedTrades.filter((trade) => trade.netPnl > 0).length;
    return {
      net,
      fees,
      count: scopedTrades.length,
      winRate: scopedTrades.length ? (wins / scopedTrades.length) * 100 : 0,
    };
  }, [filter, todayTrades, trades]);

  const summaryScope = filter === "today" ? "今日" : "全部";

  const pnlPreview = previewPnl(draft);

  async function submitTrade(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(ownerReady ? "/owner/api/trades" : "/api/trades", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json()) as { trade?: Trade; error?: string };
      if (!response.ok || !payload.trade) {
        throw new Error(payload.error || "保存失败");
      }
      setTrades((current) => [payload.trade!, ...current]);
      setDraft(emptyDraft());
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTrade(id: number) {
    if (!window.confirm("删除这笔交易记录？")) return;
    const response = await fetch(`/owner/api/trades?id=${id}`, { method: "DELETE" });
    if (response.ok) {
      setTrades((current) => current.filter((trade) => trade.id !== id));
    } else {
      setError("删除失败，请稍后重试");
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">₿</span>
          <div>
            <strong>Joe&apos;s Trading Log</strong>
          </div>
        </div>
        {ownerReady ? (
          <div className="user-chip owner-chip" title={activeDisplayName}>
            {activeDisplayName.slice(0, 1).toUpperCase()}
          </div>
        ) : signInHref ? (
          <a className="access-chip login-link" href={signInHref}>登录</a>
        ) : (
          <div className="access-chip" title="访客只能浏览交易记录">只读浏览</div>
        )}
      </header>

      <CapitalOverview currentEquity={currentEquity} totalNet={totalNet} returnRate={returnRate} />

      <section className="hero summary-panel">
        <div className="summary-lead">
          <div>
            <span className="summary-label">{summaryScope}净收益</span>
            <h1 className={stats.net > 0 ? "positive" : stats.net < 0 ? "negative" : ""}>
              {money(stats.net, true)}
            </h1>
          </div>
          <div className={`result-badge ${stats.net >= 0 ? "win" : "loss"}`}>
            <span className="status-dot" />{filter === "today" ? (stats.net >= 0 ? "盈利日" : "亏损日") : (stats.net >= 0 ? "累计盈利" : "累计亏损")}
          </div>
        </div>
        <div className="summary-grid">
          <div className="summary-metric">
            <span>总收益</span>
            <strong className={totalNet > 0 ? "positive" : totalNet < 0 ? "negative" : ""}>{money(totalNet, true)}</strong>
          </div>
          <div className="summary-metric"><span>交易笔数 · {summaryScope}</span><strong>{stats.count}</strong></div>
          <div className="summary-metric"><span>胜率 · {summaryScope}</span><strong>{stats.winRate.toFixed(0)}%</strong></div>
          <div className="summary-metric"><span>手续费 · {summaryScope}</span><strong>{money(stats.fees)}</strong></div>
        </div>
      </section>

      <section className="journal-section">
        <div className="section-heading">
          <div>
            <h2>交易记录</h2>
          </div>
          <div className="filter-toggle" role="group" aria-label="记录范围">
            <button className={filter === "today" ? "active" : ""} onClick={() => setFilter("today")}>今日</button>
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>全部</button>
          </div>
        </div>

        {error && <div className="error-banner">{error}<button onClick={() => setError("")}>×</button></div>}

        <div className="trade-list">
          {loading ? (
            <div className="empty-state"><span className="loader" />正在读取记录…</div>
          ) : visibleTrades.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon trade-empty-icon" aria-hidden="true"><span /></div>
              <strong>{filter === "today" ? "今天还没有交易" : "还没有交易记录"}</strong>
            </div>
          ) : (
            visibleTrades.map((trade) => (
              <article className="trade-card" key={trade.id}>
                <div className="trade-main">
                  <div className="trade-identity">
                    <div className="trade-topline">
                      <span className="symbol-pill">{tradeSymbol(trade)}</span>
                      <span className="side-pill long">做多</span>
                    </div>
                    <strong className="trade-route"><span>${compact(trade.entryPrice)}</span><i>→</i><span>${compact(trade.exitPrice)}</span></strong>
                    <span className="trade-quantity">{compact(trade.quantity)} {tradeSymbol(trade)}</span>
                  </div>
                  <div className={`trade-pnl ${trade.netPnl >= 0 ? "positive" : "negative"}`}>
                    <span className="trade-date">{trade.tradeDate}</span>
                    <strong>{money(trade.netPnl, true)}</strong>
                    <span>手续费 {money(trade.entryFee * trade.entryPrice + trade.exitFee)}</span>
                  </div>
                </div>
                <div className="trade-foot">
                  <p>{trade.note || "未填写交易备注"}</p>
                  {ownerReady && <button aria-label="删除交易" onClick={() => void deleteTrade(trade.id)}>删除</button>}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <GrowthChart points={growthPoints} tradingDayCount={Math.max(0, growthPoints.length - 1)} />

      {ownerReady && (
        <button className="add-button" onClick={() => setShowForm(true)}>
          <span>＋</span> 记录一笔交易
        </button>
      )}

      {ownerReady && showForm && (
        <div className="modal-backdrop">
          <button type="button" className="modal-backdrop-dismiss" aria-label="关闭记录交易窗口" onClick={() => setShowForm(false)} />
          <form className="trade-form" onSubmit={submitTrade}>
            <div className="form-handle" />
            <button type="button" className="close-button" aria-label="关闭" onClick={() => setShowForm(false)}>×</button>

            <div className="form-block">
              <div className="form-meta-grid">
                <label>
                  <span className="field-label">交易币种</span>
                  <div className="input-wrap symbol-select-wrap">
                    <select aria-label="交易币种" className="symbol-select" value={draft.symbol} onChange={(e) => setDraft({ ...draft, symbol: e.target.value as Draft["symbol"] })}>
                      <option value="HYPE">HYPE</option>
                      <option value="DOGE">DOGE</option>
                    </select>
                  </div>
                </label>
                <label><span className="field-label">交易日期</span><div className="input-wrap"><input type="date" required value={draft.tradeDate} onChange={(e) => setDraft({ ...draft, tradeDate: e.target.value })} /></div></label>
              </div>
            </div>

            <div className="form-block">
              <div className="field-grid">
                <label><span>开仓价格</span><div className="input-wrap"><input inputMode="decimal" required placeholder="0.00" value={draft.entryPrice} onChange={(e) => setDraft({ ...draft, entryPrice: e.target.value })} /><b>USDT</b></div></label>
                <label><span>平仓价格</span><div className="input-wrap"><input inputMode="decimal" required placeholder="0.00" value={draft.exitPrice} onChange={(e) => setDraft({ ...draft, exitPrice: e.target.value })} /><b>USDT</b></div></label>
                <label><span>数量</span><div className="input-wrap"><input inputMode="decimal" required placeholder="0" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} /><b>{draft.symbol}</b></div></label>
              </div>
            </div>

            <div className="form-block">
              <div className="field-grid">
                <label><span>开仓手续费</span><div className="input-wrap"><input inputMode="decimal" placeholder="0.00" value={draft.entryFee} onChange={(e) => setDraft({ ...draft, entryFee: e.target.value })} /><b>{draft.symbol}</b></div></label>
                <label><span>平仓手续费</span><div className="input-wrap"><input inputMode="decimal" placeholder="0.00" value={draft.exitFee} onChange={(e) => setDraft({ ...draft, exitFee: e.target.value })} /><b>USDT</b></div></label>
              </div>
            </div>

            <div className="preview-row">
              <span>预计净收益</span>
              <strong className={pnlPreview >= 0 ? "positive" : "negative"}>{money(pnlPreview, true)}</strong>
            </div>
            <button className="save-button" disabled={saving}>{saving ? "正在保存…" : "保存交易记录"}</button>
          </form>
        </div>
      )}
    </main>
  );
}
