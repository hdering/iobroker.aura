# Changelog (older entries)

### 0.3.94 (2026-04-14)
- Add configurable custom base URL for ioBroker overview and instance links (useful for reverse proxy setups)

### 0.3.93 (2026-04-14)
- Rename overview tiles to "Aura Frontend" and "Aura Backend"

### 0.3.92 (2026-04-14)
- Fix HTTPS: fall back to same-origin when stored ioBroker URL would cause a mixed-content block (HTTP URL on HTTPS page)

### 0.3.91 (2026-04-14)
- Fix HTTPS: upgrade stored ioBroker URL protocol to match page protocol (avoid mixed-content errors)

### 0.3.90 (2026-04-14)
- Fix HTTPS connection: use same origin for socket.io to avoid mixed-content errors
- Fix WebSocket proxy in Vite dev server for local development
- Remove PIN protection from expert settings – ioBroker URL is always visible

### 0.3.89 (2026-04-13)
- Version bump

### 0.3.88 (2026-04-13)
- Fix E1012: remove admin/ prefix from icon field

### 0.3.87 (2026-04-13)
- Version bump

### 0.3.86 (2026-04-13)
- Fix extIcon URL: use master branch ref as required by ioBroker checker

### 0.3.85 (2026-04-13)
- Fix news section: remove unpublished versions; fix extIcon URL

### 0.3.84 (2026-04-13)
- CI/CD pipeline fully operational

### 0.3.83 (2026-04-13)
- Fix CI publish: use granular npm access token

### 0.3.82 (2026-04-13)
- Fix CI publish: explicitly remove npm auth token to enable OIDC Trusted Publishing

### 0.3.81 (2026-04-13)
- Fix CI publish: remove registry-url to allow npm Trusted Publishing OIDC auth

### 0.3.80 (2026-04-13)
- Remove unpublished versions from news section; ioBroker repository compliance fixes

### 0.3.79 (2026-04-13)
- Switch npm publish to Trusted Publishing (OIDC) for secure CI/CD

### 0.3.78 (2026-04-13)
- Version bump for npm publish

### 0.3.77 (2026-04-13)
- CI/CD pipeline fully operational: npm publish via automation token

### 0.3.76 (2026-04-13)
- Fix lint: disable no-var-requires for CommonJS adapter entry point

### 0.3.75 (2026-04-13)
- Fix npm publish: use automation token for 2FA-protected CI publishing

### 0.3.74 (2026-04-13)
- ioBroker repository compliance: PNG icon, platform field, updated dependencies and workflow

### 0.3.73 (2026-04-13)
- Stable fingerprint-based client ID – no more duplicate devices on mobile

### 0.3.72
- Calendar widget: fetch via state relay instead of sendTo for reliable operation

### 0.3.63
- New widgets: fill level indicator and waste collection

### 0.1.0
- Initial release
