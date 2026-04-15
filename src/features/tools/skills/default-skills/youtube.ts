import type { Skill } from "@/shared/skill-types";

/**
 * YouTubeスキル - YouTube動画の情報抽出、字幕取得などを行う
 */
export const youtubeSkill: Skill = {
  id: "youtube",
  version: "1.0.0",
  name: "YouTube Video Operations",
  description: "YouTube動画の情報抽出、字幕取得、基本的な操作",
  matchers: {
    hosts: ["youtube.com", "youtu.be", "www.youtube.com", "m.youtube.com"],
    paths: ["/watch", "/shorts"],
  },
  extractors: [
    {
      id: "getVideoInfo",
      name: "動画情報取得",
      description: "タイトル、説明、視聴回数、高評価数、チャンネル情報を取得",
      selector: "h1.title.style-scope.ytd-video-primary-info-renderer",
      code: `function() {
        const titleEl = document.querySelector('h1.title.style-scope.ytd-video-primary-info-renderer');
        const descriptionEl = document.querySelector('#description-inline-expander .yt-core-attributed-string');
        const viewCountEl = document.querySelector('.ytd-video-view-count-renderer');
        const channelEl = document.querySelector('#channel-name a.yt-formatted-string');
        const likeButton = document.querySelector('button[aria-label*="like"]');
        
        return {
          title: titleEl?.textContent?.trim() || null,
          description: descriptionEl?.textContent?.trim() || null,
          views: viewCountEl?.textContent?.trim() || null,
          channel: channelEl?.textContent?.trim() || null,
          url: window.location.href,
          videoId: new URLSearchParams(window.location.search).get('v')
        };
      }`,
      outputSchema:
        "{ title: string | null, description: string | null, views: string | null, channel: string | null, url: string, videoId: string | null }",
    },
    {
      id: "getTranscript",
      name: "トランスクリプト取得",
      description: "動画の字幕テキストを取得（開いていない場合は自動的に開く）",
      code: `async function() {
        // すでに開いているトランスクリプトパネルを探す
        let segments = document.querySelectorAll('ytd-transcript-segment-renderer');
        
        // 開いていない場合は開く
        if (segments.length === 0) {
          // 「...more」ボタンをクリックして詳細を表示
          const moreButton = document.querySelector('tp-yt-paper-button#expand');
          if (moreButton) moreButton.click();
          
          await new Promise(r => setTimeout(r, 300));
          
          // トランスクリプトボタンを探す
          const transcriptBtn = document.querySelector('button[aria-label*="transcript" i], button[aria-label*="トランスクリプト" i]');
          if (transcriptBtn) {
            transcriptBtn.click();
            await new Promise(r => setTimeout(r, 800));
            segments = document.querySelectorAll('ytd-transcript-segment-renderer');
          }
        }
        
        return Array.from(segments).map(s => ({
          time: s.querySelector('.segment-timestamp')?.textContent?.trim() || null,
          text: s.querySelector('.segment-text')?.textContent?.trim() || null
        })).filter(item => item.text);
      }`,
      outputSchema: "Array<{ time: string | null, text: string | null }>",
    },
    {
      id: "getComments",
      name: "コメント取得",
      description: "トップレベルコメントを最大20件取得",
      selector: "#comments #contents > ytd-comment-thread-renderer",
      code: `function() {
        const comments = document.querySelectorAll('#comments #contents > ytd-comment-thread-renderer');
        return Array.from(comments).slice(0, 20).map(comment => {
          const authorEl = comment.querySelector('#author-text');
          const textEl = comment.querySelector('#content-text');
          const likesEl = comment.querySelector('#vote-count-middle');
          const timeEl = comment.querySelector('.published-time-text');
          
          return {
            author: authorEl?.textContent?.trim() || null,
            text: textEl?.textContent?.trim() || null,
            likes: likesEl?.textContent?.trim() || null,
            time: timeEl?.textContent?.trim() || null
          };
        });
      }`,
      outputSchema:
        "Array<{ author: string | null, text: string | null, likes: string | null, time: string | null }>",
    },
  ],
};
