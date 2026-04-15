---
id: google-search
name: Google Search
description: Google検索結果ページの情報抽出
hosts:
  - google.com
  - google.co.jp
paths:
  - /search
---

## searchResults

検索結果の順位、タイトル、URL、スニペットを取得

```js
return Array.from(document.querySelectorAll("#search .g"))
  .map((el, i) => ({
    position: i + 1,
    title: el.querySelector("h3")?.textContent?.trim(),
    url: el.querySelector("a")?.href,
    snippet: el.querySelector("[data-sncf], .VwiC3b")?.textContent?.trim(),
  }))
  .filter((r) => r.title);
```
