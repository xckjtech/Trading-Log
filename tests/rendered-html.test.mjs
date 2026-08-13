import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/", headers = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html", ...headers },
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
