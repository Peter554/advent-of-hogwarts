[default]
_default:
    @just --list

# Install dependencies
install:
    bun install

# Run the dev server
dev date:
    INCOMING_HOOK_BODY={{ date }} bun run dev
