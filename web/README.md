# `@creva-zk/web`

Owns the installable PWA shell: `index.html`, the placeholder mount point it renders into, and a
service worker registration that reports install status in the UI. It does not own proof
generation, wallet integration, or any call into the contract, anchoring, or advisor workspaces —
today it renders static copy and an install-status banner, nothing else.

## Dev

```bash
npm run dev --workspace web
npm run build --workspace web
```
