"use client";

import { FormEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Trade = {
  id: number;
  tradeDate: string;
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
};

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const emptyDraft = (): Draft => ({
  tradeDate: today(),
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

function previewPnl(draft: Draft) {
  const entry = Number(draft.entryPrice) || 0;
  const exit = Number(draft.exitPrice) || 0;
  const quantity = Number(draft.quantity) || 0;
  const fees = (Number(draft.entryFee) || 0) * entry + (Number(draft.exitFee) || 0);
  const gross = (exit - entry) * quantity;
  return gross - fees;
}

function GrowthChart({ points }: { points: GrowthPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(() => Math.max(0, points.length - 1));
  const selected = points[Math.min(selectedIndex, points.length - 1)];

  useEffect(() => {
    setSelectedIndex(Math.max(0, points.length - 1));
  }, [points.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length < 3) return;

    const draw = () => {
      const width = canvas.getBoundingClientRect().width;
      const height = 190;
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
      const values = points.map((point) => point.cumulative);
      const rawMin = Math.min(0, ...values);
      const rawMax = Math.max(0, ...values);
      const baseRange = rawMax - rawMin || Math.max(Math.abs(rawMax), 1);
      const min = rawMin - baseRange * 0.14;
      const max = rawMax + baseRange * 0.14;
      const x = (index: number) => pad.left + (index / (points.length - 1)) * plotWidth;
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

      const zeroY = y(0);
      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = "rgba(214,255,70,.32)";
      ctx.beginPath();
      ctx.moveTo(pad.left, zeroY);
      ctx.lineTo(width - pad.right, zeroY);
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(x(index), y(point.cumulative));
        else ctx.lineTo(x(index), y(point.cumulative));
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
        if (index === 0) ctx.moveTo(x(index), y(point.cumulative));
        else ctx.lineTo(x(index), y(point.cumulative));
      });
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = lineColor;
      ctx.shadowColor = lineColor;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      const active = Math.min(selectedIndex, points.length - 1);
      const activeX = x(active);
      const activeY = y(points[active].cumulative);
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

      ctx.fillStyle = "#66716d";
      ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textBaseline = "bottom";
      ctx.textAlign = "left";
      ctx.fillText(points[0].date.slice(5).replace("-", "/"), pad.left, height - 5);
      ctx.textAlign = "right";
      ctx.fillText(points.at(-1)!.date.slice(5).replace("-", "/"), width - pad.right, height - 5);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [points, selectedIndex]);

  function selectPoint(event: PointerEvent<HTMLCanvasElement>) {
    if (points.length < 3) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const plotWidth = Math.max(1, rect.width - 28);
    const position = Math.min(1, Math.max(0, (event.clientX - rect.left - 14) / plotWidth));
    setSelectedIndex(Math.round(position * (points.length - 1)));
  }

  return (
    <section className="growth-card">
      <div className="growth-head">
        <div><span className="section-kicker">PERFORMANCE</span><h2>收益增长</h2></div>
        <span className="day-count">{points.length} 个交易日</span>
      </div>
      {points.length < 3 ? (
        <div className="growth-empty">
          <span className="growth-symbol">↗</span>
          <div><strong>继续记录后生成曲线</strong><small>累计满 3 个交易日即可查看收益趋势</small></div>
        </div>
      ) : (
        <>
          <div className="chart-summary">
            <div><span>{selected.date}</span><small>当日 {money(selected.daily, true)}</small></div>
            <strong className={selected.cumulative >= 0 ? "positive" : "negative"}>{money(selected.cumulative, true)}</strong>
          </div>
          <canvas
            ref={canvasRef}
            className="growth-canvas"
            onPointerDown={selectPoint}
            onPointerMove={(event) => event.pointerType === "mouse" && selectPoint(event)}
            role="img"
            aria-label={`累计净收益曲线，最新总收益 ${money(points.at(-1)!.cumulative, true)}`}
          />
        </>
      )}
    </section>
  );
}

export default function TradeJournal({ displayName }: { displayName: string }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"today" | "all">("today");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadTrades = useCallback(async () => {
    try {
      const response = await fetch("/api/trades", { cache: "no-store" });
      const payload = (await response.json()) as { trades?: Trade[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "记录加载失败");
      setTrades(payload.trades ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "记录加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTrades();
  }, [loadTrades]);

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
    let cumulative = 0;
    return [...daily.entries()]
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, dailyNet]) => {
        cumulative += dailyNet;
        return { date, daily: dailyNet, cumulative };
      });
  }, [trades]);
  const stats = useMemo(() => {
    const net = todayTrades.reduce((sum, trade) => sum + trade.netPnl, 0);
    const fees = todayTrades.reduce(
      (sum, trade) => sum + trade.entryFee * trade.entryPrice + trade.exitFee,
      0,
    );
    const wins = todayTrades.filter((trade) => trade.netPnl > 0).length;
    return {
      net,
      fees,
      count: todayTrades.length,
      winRate: todayTrades.length ? (wins / todayTrades.length) * 100 : 0,
    };
  }, [todayTrades]);

  const pnlPreview = previewPnl(draft);

  async function submitTrade(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/trades", {
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
    const response = await fetch(`/api/trades?id=${id}`, { method: "DELETE" });
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
          <span className="brand-mark">H</span>
          <div>
            <strong>Day Trading Log</strong>
            <span>HYPE · Spot Long Only</span>
          </div>
        </div>
        <div className="user-chip" title={displayName}>
          {displayName.slice(0, 1).toUpperCase()}
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow"><span className="live-dot" /> TODAY · HYPE / USDT</div>
        <div className="pnl-row">
          <div>
            <p>今日净收益</p>
            <h1 className={stats.net > 0 ? "positive" : stats.net < 0 ? "negative" : ""}>
              {money(stats.net, true)}
            </h1>
          </div>
          <div className={`result-badge ${stats.net >= 0 ? "win" : "loss"}`}>
            {stats.net >= 0 ? "盈利日" : "亏损日"}
          </div>
        </div>
        <div className="stats-grid">
          <div><span>交易笔数</span><strong>{stats.count}</strong></div>
          <div><span>胜率</span><strong>{stats.winRate.toFixed(0)}%</strong></div>
          <div><span>手续费</span><strong>{money(stats.fees)}</strong></div>
        </div>
        <div className="total-return">
          <div><span>总收益</span><small>全部交易 · 已扣手续费</small></div>
          <strong className={totalNet > 0 ? "positive" : totalNet < 0 ? "negative" : ""}>
            {money(totalNet, true)}
          </strong>
        </div>
      </section>

      <details className="strategy-card">
        <summary className="strategy-head">
          <div><span className="section-kicker">MY PLAYBOOK</span><h2>我的交易策略</h2></div>
          <div className="strategy-meta"><span className="strategy-count">7 条纪律</span><span className="strategy-chevron">⌄</span></div>
        </summary>
        <ol className="strategy-list">
          <li><span>01</span><p>只做 <strong>HYPE 现货多单</strong></p></li>
          <li><span>02</span><p>单次最多 <strong>50 枚</strong></p></li>
          <li><span>03</span><p>买入前先确定<strong>止损</strong></p></li>
          <li><span>04</span><p>正常单笔计划亏损控制在约 <strong>20–40 USDT</strong>，绝对不要超过 <strong className="danger-text">73 USDT</strong></p></li>
          <li><span>05</span><p>潜在利润至少是计划亏损的 <strong>2 倍</strong></p></li>
          <li><span>06</span><p>到止损就卖，不再“等等看”</p></li>
          <li><span>07</span><p>每笔记录<strong>入场、止损、目标、结果和手续费</strong></p></li>
        </ol>
      </details>

      <GrowthChart points={growthPoints} />

      <section className="journal-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">TRADE HISTORY</span>
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
              <div className="empty-icon">↗</div>
              <strong>{filter === "today" ? "今天还没有交易" : "还没有交易记录"}</strong>
              <span>完成一笔 HYPE 交易后，在这里记下来。</span>
            </div>
          ) : (
            visibleTrades.map((trade) => (
              <article className="trade-card" key={trade.id}>
                <div className="trade-main">
                  <span className="side-pill long">做多</span>
                  <div className="trade-prices">
                    <strong>{compact(trade.entryPrice)} <i>→</i> {compact(trade.exitPrice)}</strong>
                    <span>{trade.tradeDate} · {compact(trade.quantity)} HYPE</span>
                  </div>
                  <div className={`trade-pnl ${trade.netPnl >= 0 ? "positive" : "negative"}`}>
                    <strong>{money(trade.netPnl, true)}</strong>
                    <span>手续费 {money(trade.entryFee * trade.entryPrice + trade.exitFee)}</span>
                  </div>
                </div>
                {(trade.note || true) && (
                  <div className="trade-foot">
                    <p>{trade.note || "未填写交易备注"}</p>
                    <button aria-label="删除交易" onClick={() => void deleteTrade(trade.id)}>删除</button>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </section>

      <button className="add-button" onClick={() => setShowForm(true)}>
        <span>＋</span> 记录一笔交易
      </button>

      {showForm && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <form className="trade-form" onSubmit={submitTrade}>
            <div className="form-handle" />
            <div className="form-head">
              <div><span className="section-kicker">NEW TRADE</span><h2>记录交易</h2></div>
              <button type="button" className="close-button" onClick={() => setShowForm(false)}>×</button>
            </div>

            <div className="field-grid">
              <label><span>开仓价格</span><div className="input-wrap"><input inputMode="decimal" required placeholder="0.00" value={draft.entryPrice} onChange={(e) => setDraft({ ...draft, entryPrice: e.target.value })} /><b>USDT</b></div></label>
              <label><span>平仓价格</span><div className="input-wrap"><input inputMode="decimal" required placeholder="0.00" value={draft.exitPrice} onChange={(e) => setDraft({ ...draft, exitPrice: e.target.value })} /><b>USDT</b></div></label>
              <label><span>数量</span><div className="input-wrap"><input inputMode="decimal" required placeholder="0" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} /><b>HYPE</b></div></label>
              <label><span>交易日期</span><div className="input-wrap"><input type="date" required value={draft.tradeDate} onChange={(e) => setDraft({ ...draft, tradeDate: e.target.value })} /></div></label>
              <label><span>开仓手续费</span><div className="input-wrap"><input inputMode="decimal" placeholder="0.00" value={draft.entryFee} onChange={(e) => setDraft({ ...draft, entryFee: e.target.value })} /><b>HYPE</b></div></label>
              <label><span>平仓手续费</span><div className="input-wrap"><input inputMode="decimal" placeholder="0.00" value={draft.exitFee} onChange={(e) => setDraft({ ...draft, exitFee: e.target.value })} /><b>USDT</b></div></label>
            </div>

            <label className="note-field"><span>交易备注 <em>选填</em></span><textarea maxLength={160} placeholder="为什么进场？哪里做得好或需要改进？" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label>

            <div className="preview-row">
              <span>预计净收益 <small>已扣手续费</small></span>
              <strong className={pnlPreview >= 0 ? "positive" : "negative"}>{money(pnlPreview, true)}</strong>
            </div>
            <button className="save-button" disabled={saving}>{saving ? "正在保存…" : "保存交易记录"}</button>
          </form>
        </div>
      )}
    </main>
  );
}
