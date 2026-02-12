# WS Memos — Feature Specification

## Vision
Transform Memos from a flat note-taking app into a structured knowledge base with:
- Hierarchical organization (tree view, folders, notebooks)
- Rich WYSIWYG editing (Tiptap)
- Real-time multi-user collaboration (Yjs)
- API-first design (for future mobile app)

## Feature Roadmap

### Phase 1: Hierarchical Tree View + Folders 🌳
**Priority:** HIGH | **Complexity:** Medium | **Branch:** `feature/ws-tree-view`

#### 1A. New MemoRelation type: PARENT
Extend `MemoRelationType` to support explicit parent-child relationships.

**Backend changes (Go):**
- `store/memo_relation.go` — Add `MemoRelationParent MemoRelationType = "PARENT"`
- `proto/api/v1/memo_service.proto` — Add `PARENT = 3` to `MemoRelation.Type` enum
- DB migration: no schema change needed (same table, new type value)

**API:**
- `PATCH /api/v1/memos/{id}/relations` — set parent relation
- `GET /api/v1/memos?filter=parent=="memos/{id}"` — get children
- `GET /api/v1/memos?filter=!has(parent)` — get root-level memos

#### 1B. Folders (Virtual notebooks)
Folders are special memos with a "folder" property. No separate entity needed.

**Approach:** A Folder is a Memo with:
- Tag convention: `#folder`
- Or: new `type` field on Memo (MEMO, FOLDER, NOTEBOOK)
- Children linked via PARENT relation

**Simpler alternative:** Use tag hierarchy as virtual folders
- `#work/project-a/design` → folder structure in tree
- No backend changes, just frontend tree rendering

#### 1C. Frontend Tree View Component
**Location:** `web/src/components/TreeView/`

**Components:**
- `TreeView.tsx` — main tree container
- `TreeNode.tsx` — individual node (memo/folder)
- `TreeSidebar.tsx` — sidebar panel integration

**Features:**
- Collapsible tree nodes
- Drag & drop reorder/reparent
- Context menu (new child, move, delete)
- Breadcrumb navigation on memo detail page
- Search/filter within tree
- Icon differentiation (📁 folder, 📝 memo, 📌 pinned)

**Integration:**
- Add to MainLayout sidebar (alongside existing tag list)
- Toggle between "Timeline" and "Tree" view
- Persist tree open/close state in localStorage

---

### Phase 2: Tiptap Rich Editor ✏️
**Priority:** HIGH | **Complexity:** High | **Branch:** `feature/ws-tiptap-editor`

#### Current State
Editor is a plain `<textarea>` in `web/src/components/MemoEditor/Editor/index.tsx` (213 lines).
Markdown is rendered separately in `MemoContent/` via custom parser.

#### Target State
Replace `<textarea>` with Tiptap WYSIWYG editor that:
- Renders Markdown in real-time (WYSIWYG, not split-pane)
- Supports all current Markdown features (headers, lists, code, tables, images)
- Preserves Markdown as storage format (Tiptap → Markdown serialization)
- Keeps existing slash commands and tag suggestions

#### Implementation Plan

**Dependencies:**
```json
{
  "@tiptap/react": "^2.x",
  "@tiptap/starter-kit": "^2.x",
  "@tiptap/extension-image": "^2.x",
  "@tiptap/extension-table": "^2.x",
  "@tiptap/extension-task-list": "^2.x",
  "@tiptap/extension-task-item": "^2.x",
  "@tiptap/extension-code-block-lowlight": "^2.x",
  "@tiptap/extension-placeholder": "^2.x",
  "@tiptap/extension-link": "^2.x",
  "tiptap-markdown": "^0.8.x"
}
```

**Components to modify:**
1. `web/src/components/MemoEditor/Editor/index.tsx` — Replace textarea with Tiptap
2. `web/src/components/MemoEditor/Toolbar/` — Adapt toolbar for Tiptap commands
3. `web/src/components/MemoEditor/Editor/SlashCommands.tsx` — Tiptap slash extension
4. `web/src/components/MemoEditor/Editor/TagSuggestions.tsx` — Tiptap mention extension
5. `web/src/components/MemoEditor/hooks/` — New hooks for Tiptap state

**Content flow:**
```
User types → Tiptap editor → Tiptap Document (ProseMirror)
                                    ↓
                           tiptap-markdown serializer
                                    ↓
                           Markdown string → Save via API
                                    ↓
                           Load: Markdown → tiptap-markdown parser → Tiptap Document
```

**Key considerations:**
- `tiptap-markdown` package handles bidirectional Markdown ↔ Tiptap conversion
- Must preserve exact Markdown output (tags #like-this must survive roundtrip)
- Image paste/drag-drop must still work (existing upload logic)
- Mobile-friendly toolbar (floating bubble menu)

---

### Phase 3: Multi-User Live Editing 👥
**Priority:** MEDIUM | **Complexity:** Very High | **Branch:** `feature/ws-collaboration`

#### Architecture
```
Client A (Tiptap + Yjs) ←→ WebSocket Server ←→ Client B (Tiptap + Yjs)
                                  ↕
                           Persistence Layer
                                  ↕
                           Memos DB (SQLite/PG)
```

#### Yjs Integration

**Option 1: y-websocket (Node.js sidecar)**
- Run `y-websocket` server alongside Memos Go backend
- Pros: Battle-tested, well-documented
- Cons: Extra Node.js process

**Option 2: Go WebSocket in Memos backend**
- Implement Yjs sync protocol directly in Go
- Pros: Single binary, no extra process
- Cons: Complex, Yjs protocol implementation in Go is non-trivial

**Recommendation:** Option 1 (y-websocket sidecar) for reliability.

**Frontend changes:**
```tsx
// Add to Tiptap editor setup
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

const ydoc = new Y.Doc()
const provider = new WebsocketProvider('wss://docs.app.lukacin.com/ws', `memo-${memoId}`, ydoc)

const editor = useEditor({
  extensions: [
    StarterKit.configure({ history: false }), // Yjs handles undo/redo
    Collaboration.configure({ document: ydoc }),
    CollaborationCursor.configure({ provider, user: currentUser }),
  ],
})
```

**Features:**
- Real-time cursor positions (colored per user)
- Live text sync (CRDT, no conflicts)
- Awareness (who's editing what)
- Offline support (Yjs syncs when reconnected)
- Persistence: y-websocket saves to LevelDB, periodic sync to Memos DB

**Docker setup:**
```yaml
# docker-compose.yml addition
y-websocket:
  image: node:20-alpine
  command: npx y-websocket
  environment:
    HOST: 0.0.0.0
    PORT: 1234
    YPERSISTENCE: /data
  volumes:
    - yjs-data:/data
```

---

### Phase 4: Mobile App 📱
**Priority:** LOW (after web is stable) | **Separate repo:** `wsagency/memos-mobile`

#### Stack options:
- React Native + Expo (share web components)
- Flutter (native performance)
- Capacitor (wrap web app)

#### API requirements:
- All features must work via REST/gRPC API
- Offline sync (Yjs for collab, or simpler last-write-wins)
- Push notifications (WebSocket or Firebase)

**This phase starts AFTER Phases 1-3 are stable.**

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Hierarchy storage | MemoRelation PARENT type | Extends existing relation system |
| Folder model | Memo with type=FOLDER | No new DB table, reuse memo infrastructure |
| Editor | Tiptap 2.x | Best React WYSIWYG, Markdown support, collab-ready |
| Markdown roundtrip | tiptap-markdown | Bidirectional MD ↔ ProseMirror |
| Collaboration | Yjs + y-websocket | Battle-tested CRDT, Tiptap native support |
| Collab server | Node.js sidecar | Simpler than Go Yjs implementation |
| Tree view | React + dnd-kit | Lightweight, accessible drag & drop |
| Mobile | TBD (Phase 4) | React Native likely |

## File Structure (new/modified)
```
web/src/
├── components/
│   ├── TreeView/              # NEW — Phase 1
│   │   ├── TreeView.tsx
│   │   ├── TreeNode.tsx
│   │   ├── TreeSidebar.tsx
│   │   └── useTreeData.ts
│   ├── MemoEditor/
│   │   ├── Editor/
│   │   │   ├── TiptapEditor.tsx    # NEW — Phase 2
│   │   │   ├── extensions/         # NEW — Phase 2
│   │   │   │   ├── SlashCommand.ts
│   │   │   │   ├── TagMention.ts
│   │   │   │   └── ImageUpload.ts
│   │   │   └── index.tsx           # MODIFIED — swap textarea for Tiptap
│   │   └── Toolbar/                # MODIFIED — Tiptap commands
│   └── CollabCursors/             # NEW — Phase 3
│       └── index.tsx
├── hooks/
│   ├── useTree.ts                 # NEW — Phase 1
│   └── useCollaboration.ts        # NEW — Phase 3
└── layouts/
    └── MainLayout.tsx             # MODIFIED — add tree sidebar toggle

store/                             # Go backend
├── memo_relation.go               # MODIFIED — add PARENT type
proto/api/v1/
└── memo_service.proto             # MODIFIED — add PARENT enum value
```
