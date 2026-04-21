---
id: github-guidance
name: GitHub Guidance
description: GitHub でタスクに応じた情報取得経路を選ぶためのサイトスコープガイダンス
hosts:
  - github.com
version: 0.1.0
---

# Instructions

GitHub では task に応じて最適な情報取得経路を先に判断すること。
repo 分析でない限り repo-analysis 用のガイダンスを過剰適用しないこと。

## Always

GitHub の多くの情報は raw.githubusercontent.com や REST/GraphQL API から直接取れる。
DOM 経由の取得は可視範囲に限られ、ページ構造の変更で壊れやすいため、まず API や bgFetch での取得を検討する。

## Task: Repository Analysis

リポジトリ全体のコードベース俯瞰・ファイル一覧取得・コード検索のような分析タスクでは、
単一ページの DOM ではなく GitHub API を優先すること。
PR コメント閲覧や issue 読み取りなど、ページ単独で完結するタスクにはこのガイダンスを適用しないこと。
