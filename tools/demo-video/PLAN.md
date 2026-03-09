# OpenCastle Demo Video — Production Plan

## Goal

A ~65-second tutorial video showing:
1. **Init** — Running `npx opencastle init` with MCP tools configured
2. **Explore** — Showing the generated agents, skills, workflows, MCP config
3. **Dashboard** — Running the observability dashboard (terminal + browser)

---

## Toolchain

| Step | Tool | Purpose |
|------|------|---------|
| Voiceover | **edge-tts** (`en-US-AvaNeural`) | Free neural TTS, female voice |
| Terminal recording | **VHS** (Charmbracelet) | Scripted `.tape` files, synced to audio |
| Browser recording | **Playwright** | Records dashboard UI as video |
| Composition | **FFmpeg** | Per-scene merge + final concatenation |
| Background music | **Suno** (optional) | Lo-fi ambient, mixed at low volume |

## Audio-First Sync Approach

1. Generate audio per scene → measure exact duration
2. Generate VHS tapes with `Sleep` values calibrated to audio length
3. Record terminal + browser → each clip matches its audio
4. Per-scene merge (video + audio) → concat into final video
5. Optionally mix in background music

## Pipeline

```bash
./build.sh tts       # 1. Generate voiceover (5 scenes)
./build.sh tapes     # 2. Generate VHS tape files synced to audio durations
./build.sh vhs       # 3. Record terminal segments
./build.sh browser   # 4. Record dashboard browser via Playwright
./build.sh compose   # 5. Compose final video
# — OR —
./build.sh all       # Run everything
```

## Adding Background Music

1. Generate in Suno with the prompt from `script.md` (bottom of file)
2. Export as MP3, place at `assets/bg-music.mp3`
3. Re-run `./build.sh compose` — it auto-mixes at 12% volume
