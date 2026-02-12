# CLAUDE.md — WS Memos (fork of usememos/memos)

## Project Overview
Fork of [usememos/memos](https://github.com/usememos/memos) with WS customizations.
Upstream: https://github.com/usememos/memos
Our fork: https://github.com/wsagency/memos
Production: https://docs.app.lukacin.com
Server: dev.lukacin.com (Docker: neosmemo/memos:stable)

## Architecture

### Backend (Go)
- Entry: `cmd/` → `server/`
- API: REST + gRPC (protobuf definitions in `proto/api/v1/`)
- Store: `store/` (DB abstraction for SQLite/MySQL/PostgreSQL)
- Key files:
  - `store/memo.go` — Memo CRUD
  - `store/memo_relation.go` — MemoRelation (REFERENCE, COMMENT types)
  - `server/` — HTTP/gRPC server setup
  - `proto/api/v1/memo_service.proto` — API definitions

### Frontend (React + TypeScript)
- Location: `web/`
- Build: Vite
- Router: react-router-dom (`web/src/router/`)
- Pages: `web/src/pages/` (Home, MemoDetail, Archived, Setting, etc.)
- Layouts: `web/src/layouts/` (MainLayout, RootLayout)
- Components: `web/src/components/`
  - `MemoEditor/` — Main editor (currently plain <textarea>!)
  - `MemoEditor/Editor/` — Editor component with slash commands, tag suggestions
  - `MemoContent/` — Rendered memo display (markdown → React)
  - `MasonryView/` — Grid layout for memos
- 295 TSX/TS files total

### Key Data Model
```
Memo {
  name: string           // "memos/{id}"
  content: string        // Markdown
  tags: string[]         // extracted from content (#tag)
  relations: MemoRelation[]
  parent?: string        // OUTPUT_ONLY, from COMMENT relations
  visibility: PRIVATE|PROTECTED|PUBLIC
  pinned: bool
  attachments: Attachment[]
}

MemoRelation {
  memo_id: int32
  related_memo_id: int32
  type: REFERENCE|COMMENT
}
```

### MemoRelation Types
- **REFERENCE** — memo A references memo B (bidirectional link)
- **COMMENT** — memo A is a comment on memo B (creates parent-child)

## Development

### Prerequisites
- Go 1.25+
- Node.js 20+
- Docker (for local DB)

### Local Dev
```bash
# Backend
go run ./cmd/memos --mode dev

# Frontend
cd web && npm install && npm run dev
```

### Build
```bash
# Frontend build (outputs to web/dist/)
cd web && npm run build

# Full Docker build
docker build -t wsagency/memos .
```

## Coding Conventions
- Go: standard gofmt, no external linters
- TypeScript: ESLint + Prettier (check web/.eslintrc)
- Proto: follow existing patterns in proto/api/v1/
- DB migrations: store/migration/
- Keep backward compatibility with upstream where possible

## Git Workflow
- `main` branch tracks upstream
- Feature branches: `feature/ws-<name>`
- `git fetch upstream && git merge upstream/main` to sync

## IMPORTANT
- Editor is plain <textarea>, NOT CodeMirror — easier to replace with Tiptap
- MemoRelation already supports REFERENCE type — can be extended for PARENT
- Nested tags (#a/b/c) are supported in content parsing
- API is well-documented via protobuf definitions
