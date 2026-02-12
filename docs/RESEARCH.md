# Memos — Istraživanje hijerarhijske strukture

**Datum:** 2026-02-12
**Instanca:** docs.app.lukacin.com (Docker na dev.lukacin.com, image: `neosmemo/memos:stable`)
**Verzija:** v0.25.x (stable tag)

## 1. Što Memos već ima

### ✅ MemoRelation API (postoji!)
Memos ima ugrađeni sustav relacija između memo-a:

```protobuf
message MemoRelation {
  Memo memo = 1;           // izvorni memo
  Memo related_memo = 2;   // povezani memo
  Type type = 3;           // tip relacije
  
  enum Type {
    TYPE_UNSPECIFIED = 0;
    REFERENCE = 1;         // referenca (link)
    COMMENT = 2;           // komentar
  }
}
```

### ✅ Parent polje na Memo objektu
```protobuf
message Memo {
  // ...
  optional string parent = 16;  // OUTPUT_ONLY — ime parent memo-a
  // Format: memos/{memo}
}
```

**Ključno:** Parent polje postoji ali je **OUTPUT_ONLY** — automatski se popunjava iz COMMENT relacija. Kad napraviš komentar na memo, taj komentar dobije `parent` = originalni memo.

### ✅ Nested/hijerarhijski tagovi
Memos podržava tagove s `/` separatorom: `#project/frontend/components`
- Bug u v0.22 (popravljen u kasnijim verzijama)
- Tagovi se grupiraju u sidebar-u hijerarhijski

### ❌ Što NEMA
- **Nema tree view** — nema hijerarhijski pregled memo-a (parent→children)
- **Nema folder/notebook** strukturu
- **Nema drag & drop** za organizaciju
- **Nema breadcrumb** navigaciju (memo → parent → grandparent)
- Parent relacija je samo za komentare, ne za opću hijerarhiju

## 2. API endpoints (REST)

```
GET    /api/v1/memos                          — lista svih memo-a
GET    /api/v1/memos/{id}                     — dohvat jednog memo-a
POST   /api/v1/memos                          — kreiranje memo-a
PATCH  /api/v1/memos/{id}                     — update memo-a
DELETE /api/v1/memos/{id}                     — brisanje memo-a
GET    /api/v1/memos/{id}/relations            — lista relacija
PATCH  /api/v1/memos/{id}/relations            — set relacija
POST   /api/v1/memos/{id}/comments             — kreiraj komentar (child memo)
GET    /api/v1/memos/{id}/comments             — lista komentara
```

## 3. Tehnološki stack

| Komponenta | Tehnologija |
|-----------|-------------|
| Backend | Go |
| Frontend | React + TypeScript |
| Router | react-router-dom |
| State | Custom stores |
| DB | SQLite (default), MySQL, PostgreSQL |
| API | REST + gRPC (protobuf) |
| Build | Vite |

## 4. Opcije za dodavanje hijerarhije

### Opcija A: Frontend-only plugin (preporučeno ⭐)
**Što:** Standalone web app koja se spaja na Memos API i prikazuje tree view.

**Prednosti:**
- Ne dira Memos source code — nema fork maintenance
- Koristi postojeći API (relations, tags, parent)
- Može se deployati kao zasebna stranica ili embed
- Update Memos-a ne ruši ništa

**Kako funkcionira:**
1. Dohvati sve memo-e s API-ja
2. Parsa tag hijerarhiju (`#project/frontend/...`)
3. Koristi MemoRelation REFERENCE za parent-child veze
4. Prikazuje tree/outline view
5. Drag & drop za reorganizaciju (setuje relacije preko API)

**Stack:** React + TypeScript + Memos API

**Estimacija:** 2-3 dana dev

---

### Opcija B: Fork Memos + native tree view
**Što:** Fork usememos/memos repo i dodaj tree view komponentu u frontend.

**Prednosti:**
- Native look & feel
- Potpuna kontrola nad UX-om
- Može dodati pravi parent_id field u DB

**Mane:**
- Fork maintenance — svaki Memos update treba merge
- Kompleksnije (Go backend + React frontend)
- Duže za implementirati

**Estimacija:** 5-7 dana dev

---

### Opcija C: Browser extension / userscript
**Što:** Tampermonkey/browser extension koji dodaje sidebar s tree viewom.

**Prednosti:**
- Zero server changes
- Instant deploy

**Mane:**
- Fragile (ovisi o DOM strukturi)
- Samo za jednog korisnika
- Održavanje kad se UI promijeni

**Estimacija:** 1-2 dana dev

---

### Opcija D: Hybrid — Custom page u Memos
**Što:** Iskoristi Memos custom CSS/JS injection (ako postoji) za dodavanje tree view panela.

**Status:** Memos nema native plugin system za custom JS injection. Ovo bi zahtijevalo mount custom JS file-a u Docker volume.

## 5. Preporuka: Opcija A — Frontend companion app

### Zašto:
1. **Nema fork maintenance** — Memos se može updateati slobodno
2. **API je stabilan** — REST/gRPC s protobuf definicijama
3. **Brzo za napraviti** — 2-3 dana s Claude Code teamom
4. **Može biti standalone ili iframe embed**
5. **Dodaje vrijednost** — tree view, breadcrumbs, drag & drop, search within hierarchy

### Predložena arhitektura:

```
┌─────────────────────────────────────────────┐
│  docs.app.lukacin.com (Memos)               │
│  ┌─────────────────────────────────────────┐ │
│  │  Memos UI (native)                      │ │
│  │  - Timeline view (existing)             │ │
│  │  - Tag sidebar (existing)               │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
         ↕ REST API (/api/v1/*)
┌─────────────────────────────────────────────┐
│  tree.docs.app.lukacin.com (NEW)            │
│  ┌─────────────────────────────────────────┐ │
│  │  Memos Tree View                        │ │
│  │  - Hierarchical navigator (tag-based)   │ │
│  │  - Parent-child memo tree               │ │
│  │  - Drag & drop reorg                    │ │
│  │  - Quick search + filter                │ │
│  │  - Breadcrumb navigation                │ │
│  │  - Click → opens memo in Memos UI       │ │
│  └─────────────────────────────────────────┘ │
│  React + TypeScript + Vite                   │
│  Static files served by Caddy                │
└─────────────────────────────────────────────┘
```

### Hijerarhija se gradi iz:
1. **Tag tree** — `#project/frontend/components` → tree po tag segmentima
2. **REFERENCE relations** — memo A referira memo B → A je child od B
3. **Komentari** — automatski parent-child (već postoji)
4. **Manual parent** — custom property ili tag konvencija (`#parent:memo-id`)

### Key features:
- 🌳 **Tree View** — collapsible, indented, drag & drop
- 🔍 **Search** — filter tree u realnom vremenu
- 📂 **Virtual folders** — bazirano na tag hijerarhiji
- 🔗 **Deep links** — klik na memo otvara u Memos UI
- 📱 **Responsive** — radi na mobitelu
- 🌙 **Dark mode** — prati Memos temu

## 6. Alternativa: Upstream contribution

Moglo bi se predložiti Memos maintainerima kao feature request:
- "Hierarchical memo view" s tree navigator
- Koristilo bi MemoRelation infrastructure
- Ali to ovisi o maintaineru (može biti odbijeno ili dugo čekanje)

## Zaključak

**Preporučam Opciju A** — standalone companion app. Brzo, sigurno, ne dira Memos core. Može se raditi paralelno i odmah koristiti.

Ako to prihvatiš, kreiram SPEC.md s detaljnim tehničkim planom i pokrećem team za development.
