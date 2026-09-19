# StoryForge

A multi-agent narrative exploration app. Upload a long-form story and explore it from every angle — chat with a main "narrative agent", interview characters, shift perspective, diverge the plot into alternate timelines, browse a generated timeline, generate character/scene art, and manage multiple stories.

Built by **Team Zenith** (Siddharth, Jainendra, Pavan Teja).

---

## How it works

- You upload story files (`.pdf`, `.txt`, `.docx`, `.md`, or images — multiple at once).
- The backend ingests them into a vector store (Chroma) and a **context agent** builds a structured `context.md` (characters, scenes, timeline, branches, assets).
- A **Main Narrative Agent** orchestrates specialized **sub-agents** for character interviews, perspective shifts, divergence, and image generation — grounding every answer in the story.

**Hybrid model split:** the orchestrator + context build run on a stronger model; the specialized sub-agents run on a faster/cheaper model, so they can fan out concurrently.

---

## Features

- **Home** — upload stories; dashboard with files, story context, and generated assets.
- **Characters** — interview any character at a chosen timeline point (knowledge-limited to that moment).
- **Timeline** — visual event timeline; generate concept art per event.
- **Perspective Shift** — reconstruct a scene from a character's point of view.
- **Divergence Mode** — change an event and generate the alternate trajectory.
- **Generative Studio** — character design + concept art via AI image generation.
- **Data** — story library: switch between multiple stories, save/bookmark, or delete them.
- Light + dark mode throughout.

---

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Python 3.12, FastAPI, OpenAI Agents SDK |
| LLM | OpenAI (gpt-4o orchestrator + gpt-4o-mini sub-agents) — or local Ollama |
| Images | OpenAI `gpt-image-1` |
| Vector store | Chroma |
| User data | MongoDB |
| Frontend | HTML + Tailwind (CDN) + vanilla JS |

---

## Prerequisites

1. **Python + [uv](https://docs.astral.sh/uv/)**
2. **MongoDB** running locally (`mongodb://localhost:27017`)
3. **An OpenAI API key** (default) — or a local **Ollama** install if you prefer to run models yourself.

---

## Run it

### 1. Backend

```bash
cd backend
cp .env.example .env        # then set OPENAI_API_KEY
uv sync                     # install dependencies
uv run uvicorn app.main:app --port 8000
```

Backend runs at `http://localhost:8000` (health: `/health`, docs: `/docs`).

**Key `.env` settings:**

```
LLM_PROVIDER=openai            # "openai" or "ollama"
OPENAI_API_KEY=sk-...          # required for openai provider
LLM_MODEL=gpt-4o               # orchestrator + context
SUBAGENT_MODEL=gpt-4o-mini     # specialized sub-agents
EMBED_MODEL=text-embedding-3-small
MONGO_URI=mongodb://localhost:27017
MONGO_DB=storyforge
CHROMA_PATH=./data/chroma
DATA_DIR=./data
```

To run fully local instead, set `LLM_PROVIDER=ollama` and point `OLLAMA_BASE_URL` / `SUBAGENT_BASE_URL` at your Ollama instance(s) with tool-calling models (e.g. `qwen2.5:14b` + `qwen2.5:7b` + `nomic-embed-text`).

### 2. Frontend

```bash
cd frontend
python -m http.server 5500
```

Open **http://localhost:5500**. If the backend is on another host, edit `BACKEND_URL` in `frontend/js/config.js`.

> Tip: `python -m http.server` sends no cache headers — after editing frontend JS, hard-refresh (Ctrl+Shift+R) to avoid stale modules.

---

## Using it

1. On **Home**, upload one or more story files and wait for processing (`ingesting → ready`; the context build takes ~10–90s depending on the model).
2. Once ready, explore via the sidebar. Use **Data** to switch between multiple stories, and **Save Story** to bookmark the current one.

---

## API (main endpoints)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/stories` | upload story files (multipart, field `files`) |
| GET | `/api/stories` | list all stories (library) |
| GET | `/api/stories/{id}` | processing status |
| DELETE | `/api/stories/{id}` | delete a story (files + Chroma + Mongo) |
| POST | `/api/stories/{id}/save` | bookmark a story |
| POST | `/api/stories/{id}/reset` | clear chat history (keeps files/context) |
| POST | `/api/chat` | main narrative agent |
| GET | `/api/stories/{id}/characters` | character list |
| GET | `/api/stories/{id}/timeline` | timeline events |
| POST | `/api/stories/{id}/interview` | interview a character at a story point |
| POST | `/api/stories/{id}/perspective` | reconstruct a scene from a character's POV |
| POST | `/api/stories/{id}/divergence` | change an event, generate consequences |
| POST | `/api/stories/{id}/generate-image` | generate character/concept art |
| GET | `/api/stories/{id}/assets` | list generated assets |

Generated images are served under `/media/...`.

---

## Reset the database (dev)

Wipe all stories, chats, assets and Chroma data. Stop the backend first (Chroma files lock on Windows), then:

```bash
cd backend
uv run python -m app.core.reset          # asks to confirm
uv run python -m app.core.reset --yes    # skip confirmation
```

---

## Notes

- Don't leave stale servers on port 8000 — if `uvicorn` won't bind, kill the old process first.
- `.env` holds secrets and is gitignored — never commit your API key.
- This README is UTF-8. If your editor re-saves it as UTF-16 it will look garbled; keep it UTF-8.
