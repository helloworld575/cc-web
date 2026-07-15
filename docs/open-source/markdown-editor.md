# Markdown Editor Open Source Reference

This project uses `@toast-ui/editor` as the shared Markdown editor for blog posts, diary entries, and Markdown todo notes.

## Upstream References

- Product site: https://ui.toast.com/tui-editor/
- API docs: https://nhn.github.io/tui.editor/latest/
- Core API docs: https://nhn.github.io/tui.editor/latest/ToastUIEditorCore/
- Source repository: https://github.com/nhn/tui.editor
- npm package: https://www.npmjs.com/package/@toast-ui/editor

## Local Integration

- Shared component: `components/MarkdownEditor.tsx`
- Upload API: `app/api/files/route.ts`
- Public image serving: `app/api/uploads/[...path]/route.ts`
- Root CSS import: `app/layout.tsx`

## Supported By Upstream

| Need | TUI Editor API used locally |
| --- | --- |
| Markdown-first editing | `initialEditType: 'markdown'` |
| Split editor/preview | `previewStyle: 'vertical'` |
| Markdown value sync | `getMarkdown()` / `setMarkdown()` |
| Toolbar commands | `toolbarItems` |
| Image upload insertion | `hooks.addImageBlobHook(blob, callback)` |
| Chinese UI strings | `@toast-ui/editor/dist/i18n/zh-cn` |
| Disable telemetry | `usageStatistics: false` |
| Make plain HTTP(S) references clickable in preview | `extendedAutolinks: true` |

The public blog renderer enables `remark-gfm` and uses the same `.toastui-editor-contents`
presentation class. This keeps server-rendered article HTML while matching the editor preview
for tables, task lists, strikethrough, and extended autolinks.

## Change Rule

Before changing Markdown editing behavior, check the upstream docs and package types first. Prefer TUI Editor configuration, hooks, plugins, or public instance methods over local reimplementation.

Do not rebuild editor capabilities locally, including toolbar commands, selection wrapping, keyboard shortcuts, Markdown preview switching, paste/drop image handling, or WYSIWYG/Markdown mode behavior. Local code should only adapt TUI Editor to the app's state, uploads, layout, and tests.

## Image Upload Contract

The editor upload hook posts `multipart/form-data` to `/api/files` with field `file`. A successful response includes:

```json
{ "ok": true, "filename": "<uuid>.png", "url": "/uploads/<uuid>.png" }
```

The hook passes `url` to TUI Editor's image callback, so the editor inserts Markdown image syntax using the uploaded file URL.
