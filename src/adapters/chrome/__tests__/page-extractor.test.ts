import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractPageContentLightweight } from "../page-extractor";

function setupDOM(html: string, url = "https://example.com/page"): JSDOM {
  const dom = new JSDOM(html, { url });
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("location", dom.window.location);
  return dom;
}

describe("extractPageContentLightweight", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("article u8981u7d20u304bu3089u30c6u30adu30b9u30c8u3092u62bdu51fau3059u308b", () => {
    setupDOM(`
      <html>
        <head>
          <title>u8a18u4e8bu30bfu30a4u30c8u30eb</title>
          <meta name="description" content="u8a18u4e8bu306eu8aacu660eu6587">
        </head>
        <body>
          <nav>u30cau30d3u30b2u30fcu30b7u30e7u30f3</nav>
          <article>
            <h1>u898bu51fau3057</h1>
            <p>u8a18u4e8bu306eu672cu6587u3067u3059u3002u3053u308cu306fu30c6u30b9u30c8u7528u306eu5341u5206u306au9577u3055u306eu30b3u30f3u30c6u30f3u30c4u3067u3059u3002u30c6u30b9u30c8u304cu6b63u5e38u306bu52d5u4f5cu3059u308bu3053u3068u3092u78bau8a8du3057u307eu3059u3002</p>
          </article>
          <footer>u30d5u30c3u30bfu30fc</footer>
        </body>
      </html>
    `);

    const result = extractPageContentLightweight();

    expect(result.h1).toBe("u898bu51fau3057");
    expect(result.description).toBe("u8a18u4e8bu306eu8aacu660eu6587");
    expect(result.method).toBe("article");
    expect(result.text).toContain("u8a18u4e8bu306eu672cu6587u3067u3059");
    expect(result.text).not.toContain("u30cau30d3u30b2u30fcu30b7u30e7u30f3");
    expect(result.text).not.toContain("u30d5u30c3u30bfu30fc");
  });

  it("main u8981u7d20u306bu30d5u30a9u30fcu30ebu30d0u30c3u30afu3059u308b", () => {
    setupDOM(`
      <html>
        <head><title>u30e1u30a4u30f3u30dau30fcu30b8</title></head>
        <body>
          <header>u30d8u30c3u30c0u30fc</header>
          <main>
            <p>u30e1u30a4u30f3u30b3u30f3u30c6u30f3u30c4u306eu672cu6587u3067u3059u3002u3053u308cu306fu30c6u30b9u30c8u7528u306eu5341u5206u306au9577u3055u306eu30b3u30f3u30c6u30f3u30c4u3067u3059u3002u30c6u30b9u30c8u304cu6b63u5e38u306bu52d5u4f5cu3059u308bu3053u3068u3092u78bau8a8du3057u307eu3059u3002</p>
          </main>
        </body>
      </html>
    `);

    const result = extractPageContentLightweight();

    expect(result.method).toBe("main");
    expect(result.text).toContain(
      "u30e1u30a4u30f3u30b3u30f3u30c6u30f3u30c4u306eu672cu6587u3067u3059",
    );
    expect(result.text).not.toContain("u30d8u30c3u30c0u30fc");
  });

  it("[role='main'] u3092u691cu51fau3059u308b", () => {
    setupDOM(`
      <html>
        <head><title>u30edu30fcu30ebu30dau30fcu30b8</title></head>
        <body>
          <div role="main">
            <p>u30edu30fcu30ebu30e1u30a4u30f3u306eu30b3u30f3u30c6u30f3u30c4u3067u3059u3002u3053u308cu306fu30c6u30b9u30c8u7528u306eu5341u5206u306au9577u3055u306eu30b3u30f3u30c6u30f3u30c4u3067u3059u3002u30c6u30b9u30c8u304cu6b63u5e38u306bu52d5u4f5cu3059u308bu3053u3068u3092u78bau8a8du3002</p>
          </div>
        </body>
      </html>
    `);

    const result = extractPageContentLightweight();

    expect(result.method).toBe('[role="main"]');
    expect(result.text).toContain(
      "u30edu30fcu30ebu30e1u30a4u30f3u306eu30b3u30f3u30c6u30f3u30c4u3067u3059",
    );
  });

  it("u30e1u30a4u30f3u30b3u30f3u30c6u30f3u30c4u304cu898bu3064u304bu3089u306au3044u5834u5408 body u306bu30d5u30a9u30fcu30ebu30d0u30c3u30afu3059u308b", () => {
    setupDOM(`
      <html>
        <head><title>u30b7u30f3u30d7u30ebu30dau30fcu30b8</title></head>
        <body>
          <div>
            <p>u672cu6587u306eu30c6u30adu30b9u30c8u3067u3059u3002u3053u308cu306fu30c6u30b9u30c8u7528u306eu5341u5206u306au9577u3055u306eu30b3u30f3u30c6u30f3u30c4u3067u3059u3002u30c6u30b9u30c8u304cu6b63u5e38u306bu52d5u4f5cu3059u308bu3053u3068u3092u78bau8a8du3057u3066u3044u307eu3059u3002</p>
          </div>
        </body>
      </html>
    `);

    const result = extractPageContentLightweight();

    expect(result.method).toBe("body");
    expect(result.text).toContain("u672cu6587u306eu30c6u30adu30b9u30c8u3067u3059");
  });

  it("u4e0du8981u8981u7d20uff08script, style, nav, asideuff09u3092u9664u5916u3059u308b", () => {
    setupDOM(`
      <html>
        <head><title>u30c6u30b9u30c8</title></head>
        <body>
          <article>
            <p>u672cu6587u3067u3059u3002u3053u308cu306fu30c6u30b9u30c8u7528u306eu5341u5206u306au9577u3055u306eu30b3u30f3u30c6u30f3u30c4u3067u3059u3002u30c6u30b9u30c8u304cu6b63u5e38u306bu52d5u4f5cu3059u308bu3053u3068u3092u78bau8a8du3059u308bu305fu3081u306eu30c6u30adu30b9u30c8u3002</p>
            <script>console.log("script")</script>
            <style>.hidden { display: none; }</style>
            <nav>u30b5u30a4u30c8u30cau30d3</nav>
            <aside>u30b5u30a4u30c9u30d0u30fc</aside>
          </article>
        </body>
      </html>
    `);

    const result = extractPageContentLightweight();

    expect(result.text).toContain("u672cu6587u3067u3059");
    expect(result.text).not.toContain("console.log");
    expect(result.text).not.toContain(".hidden");
    expect(result.text).not.toContain("u30b5u30a4u30c8u30cau30d3");
    expect(result.text).not.toContain("u30b5u30a4u30c9u30d0u30fc");
  });

  it("u30c6u30adu30b9u30c8u3092u6700u59276000u6587u5b57u306bu5236u9650u3059u308b", () => {
    const longText = "u3042".repeat(10000);
    setupDOM(`
      <html>
        <head><title>u9577u3044u30dau30fcu30b8</title></head>
        <body>
          <article><p>${longText}</p></article>
        </body>
      </html>
    `);

    const result = extractPageContentLightweight();

    expect(result.text.length).toBeLessThanOrEqual(6000);
  });

  it("meta description u304cu7121u3044u5834u5408u306fu7a7au6587u5b57u3092u8fd4u3059", () => {
    setupDOM(`
      <html>
        <head><title>u30e1u30bfu306au3057</title></head>
        <body>
          <article><p>u30b3u30f3u30c6u30f3u30c4u3067u3059u3002u3053u308cu306fu30c6u30b9u30c8u7528u306eu5341u5206u306au9577u3055u306eu30b3u30f3u30c6u30f3u30c4u3067u3059u3002u30c6u30b9u30c8u304cu6b63u5e38u306bu52d5u4f5cu3059u308bu3053u3068u3092u78bau8a8du3002</p></article>
        </body>
      </html>
    `);

    const result = extractPageContentLightweight();

    expect(result.description).toBe("");
  });

  it("article u306eu30c6u30adu30b9u30c8u304c50u6587u5b57u672au6e80u306au3089u6b21u306eu30bbu30ecu30afu30bfu306bu9032u3080", () => {
    setupDOM(`
      <html>
        <head><title>u77edu3044u8a18u4e8b</title></head>
        <body>
          <article><p>u77edu3044</p></article>
          <main><p>u30e1u30a4u30f3u30b3u30f3u30c6u30f3u30c4u306eu672cu6587u3067u3059u3002u3053u308cu306fu30c6u30b9u30c8u7528u306eu5341u5206u306au9577u3055u306eu30b3u30f3u30c6u30f3u30c4u3067u3059u3002u30c6u30b9u30c8u304cu6b63u5e38u306bu52d5u4f5cu3059u308bu3053u3068u3092u78bau8a8du3002</p></main>
        </body>
      </html>
    `);

    const result = extractPageContentLightweight();

    expect(result.method).toBe("main");
  });

  it("u9023u7d9au3059u308bu7a7au767du3092u6b63u898fu5316u3059u308b", () => {
    setupDOM(`
      <html>
        <head><title>u7a7au767du30c6u30b9u30c8</title></head>
        <body>
          <article>
            <p>u30c6u30adu30b9u30c81u3067u3059u3002u3053u308cu306fu30c6u30b9u30c8u7528u306eu5341u5206u306au9577u3055u306eu30b3u30f3u30c6u30f3u30c4u3067u3059u3002u7a7au767du6b63u898fu5316u30c6u30b9u30c8u3002</p>



            <p>u30c6u30adu30b9u30c82u3067u3059u3002</p>
          </article>
        </body>
      </html>
    `);

    const result = extractPageContentLightweight();

    expect(result.text).not.toMatch(/\n{3,}/);
  });

  it("aria-hidden='true' u306eu8981u7d20u3092u9664u5916u3059u308b", () => {
    setupDOM(`
      <html>
        <head><title>u30c6u30b9u30c8</title></head>
        <body>
          <article>
            <p>u8868u793au30c6u30adu30b9u30c8u3002u3053u308cu306fu30c6u30b9u30c8u7528u306eu5341u5206u306au9577u3055u306eu30b3u30f3u30c6u30f3u30c4u3067u3059u3002u30c6u30b9u30c8u304cu6b63u5e38u306bu52d5u4f5cu3059u308bu3053u3068u3092u78bau8a8du3059u308bu305fu3081u3002</p>
            <div aria-hidden="true">u975eu8868u793au30b3u30f3u30c6u30f3u30c4</div>
          </article>
        </body>
      </html>
    `);

    const result = extractPageContentLightweight();

    expect(result.text).toContain("u8868u793au30c6u30adu30b9u30c8");
    expect(result.text).not.toContain("u975eu8868u793au30b3u30f3u30c6u30f3u30c4");
  });

  it("h1 u3092u62bdu51fau3059u308b", () => {
    setupDOM(`
      <html>
        <head><title>u30c6u30b9u30c8</title></head>
        <body>
          <h1>u30dau30fcu30b8u898bu51fau3057</h1>
          <article>
            <p>u672cu6587u3067u3059u3002u3053u308cu306fu30c6u30b9u30c8u7528u306eu5341u5206u306au9577u3055u306eu30b3u30f3u30c6u30f3u30c4u3067u3059u3002u30c6u30b9u30c8u304cu6b63u5e38u306bu52d5u4f5cu3059u308bu3053u3068u3092u78bau8a8du3059u308bu305fu3081u3002</p>
          </article>
        </body>
      </html>
    `);

    const result = extractPageContentLightweight();

    expect(result.h1).toBe("u30dau30fcu30b8u898bu51fau3057");
  });
});
