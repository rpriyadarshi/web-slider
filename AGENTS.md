# Agents

Read [docs/agents.md](docs/agents.md) before you write or edit a file.

A talk is [prompts/generate-deck.md](prompts/generate-deck.md). A theme, a config, or a sample install is [prompts/admin-theme.md](prompts/admin-theme.md). Presenter behavior is software under `src/`. The app enforces [src/model/schema.ts](src/model/schema.ts) for a deck and [src/model/install.ts](src/model/install.ts) for a config and a manifest. If a doc and the schema disagree, the schema is what the presenter runs. Update the schema first, then the chapter that describes it.
