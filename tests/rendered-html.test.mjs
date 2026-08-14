import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function request(pathname = "/", init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      ...init,
      headers: { accept: "text/html", ...init.headers },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function render(pathname = "/", headers = {}) {
  return request(pathname, { headers });
}

test("server-renders the Trading Log shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  const head = html.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? "";
  const body = html.match(/<body>([\s\S]*?)<\/body>/i)?.[1] ?? "";
  assert.match(html, /<title>Joe's Trading Log<\/title>/i);
  assert.match(html, /Joe(?:&apos;|&#x27;|&#39;|')s Trading Log/);
  assert.match(html, /资金概览/);
  assert.match(html, /资金概览[\s\S]*起始本金[\s\S]*当前净值[\s\S]*总收益[\s\S]*累计回报/);
  assert.match(html, /统计与交易记录范围/);
  assert.match(html, /净收益 · (?:<!-- -->)?今日/);
  assert.match(html, /交易记录/);
  assert.match(html, /收益增长/);
  assert.match(html, /manifest\.webmanifest/);
  assert.match(head, /<link rel="icon" href="\/icons\/icon-192\.png\?v=20260814-head"/);
  assert.doesNotMatch(body, /rel="(?:shortcut )?icon"/);
  assert.doesNotMatch(html, /\/Users\/|\.vinext\/fonts/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|codex-preview/);
});

test("tab favicon points to a decodable PNG", async () => {
  const icon = await readFile(new URL("../public/icons/icon-192.png", import.meta.url));

  assert.deepEqual(icon.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.equal(icon.readUInt32BE(16), 192);
  assert.equal(icon.readUInt32BE(20), 192);
});

test("one range toggle controls both performance and trade records", async () => {
  const journal = await readFile(new URL("../app/trade-journal.tsx", import.meta.url), "utf8");
  const toggles = journal.match(/className="filter-toggle"/g) ?? [];
  const summaryToggle = journal.indexOf('aria-label="统计与交易记录范围"');
  const tradeHeading = journal.indexOf("<h2>交易记录</h2>");

  assert.equal(toggles.length, 1);
  assert.ok(summaryToggle > journal.indexOf('className="summary-heading"'));
  assert.ok(summaryToggle < tradeHeading);
  assert.doesNotMatch(journal, /<h2>\{summaryScope\}表现<\/h2>/);
});

test("open positions follow the performance summary without an oversized gap", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(styles, /\.open-positions-section\s*\{\s*margin:\s*4px 0 30px;/);
});

test("production fonts use public portable assets", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.doesNotMatch(layout, /next\/font/);
  assert.match(styles, /font-family:\s*"Trading Geist"/);
  assert.match(styles, /font-family:\s*"Trading Geist Mono"/);
  await readFile(new URL("../public/fonts/geist-sans-latin.woff2", import.meta.url));
  await readFile(new URL("../public/fonts/geist-mono-latin.woff2", import.meta.url));
});

test("owner session stays closed without Cloudflare Access identity", async () => {
  const response = await render("/owner/session");
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { authenticated: false });
});

test("trade route exports keep public access read-only", async () => {
  const publicRoute = await readFile(new URL("../app/api/trades/route.ts", import.meta.url), "utf8");
  const ownerRoute = await readFile(new URL("../app/owner/api/trades/route.ts", import.meta.url), "utf8");

  assert.match(publicRoute, /export async function GET\s*\(/);
  assert.doesNotMatch(publicRoute, /export async function (?:POST|PATCH|DELETE)\s*\(/);
  assert.match(ownerRoute, /export async function POST\s*\(/);
  assert.match(ownerRoute, /export async function PATCH\s*\(/);
  assert.match(ownerRoute, /export async function DELETE\s*\(/);
});

test("open positions cannot be deleted", async () => {
  const journal = await readFile(new URL("../app/trade-journal.tsx", import.meta.url), "utf8");
  const ownerRoute = await readFile(new URL("../app/owner/api/trades/route.ts", import.meta.url), "utf8");

  assert.match(journal, /\{!isOpen && <button aria-label="删除交易"/);
  assert.match(ownerRoute, /existing\.status === "open"/);
  assert.match(ownerRoute, /持仓中的交易不能删除/);
  assert.match(ownerRoute, /eq\(trades\.status, "closed"\)/);
});

test("open position cards distinguish the buy action from holding status", async () => {
  const journal = await readFile(new URL("../app/trade-journal.tsx", import.meta.url), "utf8");

  assert.match(journal, /\{isOpen \? "买入" : "做多"\}/);
  assert.match(journal, /\{isOpen \? "持仓中" : money\(trade\.netPnl, true\)\}/);
  assert.doesNotMatch(journal, /\{isOpen \? "等待卖出"/);
});
