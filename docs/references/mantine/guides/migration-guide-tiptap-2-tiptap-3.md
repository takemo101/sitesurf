# Migration guide Tiptap 2 → Tiptap 3

This guide will help you update [TipTap](https://tiptap.dev/docs) from version 2 to version 3.

## [shouldRerenderOnTransaction](#shouldrerenderontransaction)

Set `shouldRerenderOnTransaction: true` in `useEditor`. It is required to have active control highlight.

## [immediatelyRender](#immediatelyrender)

Set `immediatelyRender: false` if you use Next.js or other framework with server-side rendering. It is required to prevent hydration mismatches.

## [StarterKit changes](#starterkit-changes)

`StarterKit` now includes underline and link extensions out of the box:

- You no longer need to add underline extension manually
- You must disable the default link extension to use extension provided by Mantine

## [Import paths](#import-paths)

Change import paths for floating and bubble menu components:
