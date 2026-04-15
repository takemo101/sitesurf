---
id: youtube
name: YouTube
description: YouTube動画ページの情報抽出
hosts:
  - youtube.com
  - youtu.be
paths:
  - /watch
signals:
  - ytd-watch-metadata
---

## videoInfo

タイトル、チャンネル名、説明文、再生回数を取得

```js
const title = document
  .querySelector("h1.ytd-watch-metadata yt-formatted-string")
  ?.textContent?.trim();
const channel = document
  .querySelector("ytd-channel-name yt-formatted-string a")
  ?.textContent?.trim();
const description = document
  .querySelector("#description-inline-expander yt-attributed-string")
  ?.textContent?.trim();
const viewCount = document.querySelector("ytd-watch-info-text .bold")?.textContent?.trim();
return { title, channel, description, viewCount };
```

## comments

上位5件のコメントを取得

```js
return Array.from(document.querySelectorAll("ytd-comment-renderer"))
  .slice(0, 5)
  .map((c) => ({
    author: c.querySelector("#author-text")?.textContent?.trim(),
    text: c.querySelector("#content-text")?.textContent?.trim(),
    likes: c.querySelector("#vote-count-middle")?.textContent?.trim(),
  }));
```
