[default]
_default:
    @just --list

# Run the dev server
dev date:
    INCOMING_HOOK_BODY={{date}} bun --bun run dev
