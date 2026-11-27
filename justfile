[default]
_default:
    @just --list

# Install dependencies
install:
    bun install

# Run the dev server
dev date:
    INCOMING_HOOK_BODY={{ date }} bun run dev

# Generate story images (see image-gen/README.md)
images *args:
    bun image-gen/generate.ts {{ args }}
