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
  assert.match(html, /<title>Joe's Trading Log<\/title>/i);
  assert.match(html, /Joe(?:&apos;|&#x27;|&#39;|')s Trading Log/);
  assert.match(html, /资金概览/);
  assert.match(html, /交易记录/);
  assert.match(html, /收益增长/);
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /favicon\.ico/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|codex-preview/);
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
