# WS Memos — Project Memory

## Project Info
- **Repo:** https://github.com/wsagency/memos (fork of usememos/memos)
- **Production:** https://docs.app.lukacin.com
- **Server:** dev.lukacin.com (Docker: neosmemo/memos:stable)
- **Created:** 2026-02-12

## Phases
1. 🌳 Hierarchical Tree View + Folders — TODO
2. ✏️ Tiptap Rich Editor — TODO
3. 👥 Multi-User Live Editing (Yjs) — TODO
4. 📱 Mobile App (separate repo) — FUTURE

## Key Findings (2026-02-12)
- Memos editor is plain <textarea> (not CodeMirror!) — easy to replace
- MemoRelation already exists (REFERENCE, COMMENT types) — extend with PARENT
- Memo has `parent` field (OUTPUT_ONLY, from COMMENT relations)
- Nested tags work (#a/b/c) but UI grouping was buggy in v0.22 (fixed later)
- 295 TSX/TS files in frontend, Go backend
- API: REST + gRPC with protobuf definitions
- All features MUST be API-accessible (for future mobile app)
- Auth: same-domain approach (companion on /tree/ subpath shares session cookies)

## Decisions
- Fork approach (not companion app) — Kristijan wants multiple deep changes
- Tiptap for editor (not CodeMirror) — WYSIWYG, collab-ready, Markdown roundtrip
- Yjs + y-websocket sidecar for collaboration — battle-tested, not custom Go impl
- MemoRelation PARENT type for hierarchy — extends existing system
- Folders = Memos with type=FOLDER — no new DB table
