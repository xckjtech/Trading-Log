"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

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
  const fees = (Number(draft.entryFee) || 0) + (Number(draft.exitFee) || 0);
  const gross = (exit - entry) * quantity;
  return gross - fees;
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
  const stats = useMemo(() => {
    const net = todayTrades.reduce((sum, trade) => sum + trade.netPnl, 0);
    const fees = todayTrades.reduce(
      (sum, trade) => sum + trade.entryFee + trade.exitFee,
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
            <strong>HYPE Journal</strong>
            <span>Day Trading Log</span>
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
      </section>

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
                    <span>手续费 {money(trade.entryFee + trade.exitFee)}</span>
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
              <label><span>开仓手续费</span><div className="input-wrap"><input inputMode="decimal" placeholder="0.00" value={draft.entryFee} onChange={(e) => setDraft({ ...draft, entryFee: e.target.value })} /><b>USDT</b></div></label>
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
