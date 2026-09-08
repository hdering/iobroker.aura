# Release notes for the NEXT version — English only (the release linter rejects German).
# One bullet per user-facing change; these become the ioBroker changelog, then this
# file is auto-reset to this template on the next stable release. Suggested style:
#   <Widget type> - <what changed>          e.g.  Thermostat - target temperature now shown inline
#   <General / widget-independent change>    e.g.  Tabs can be hidden from the tab bar
#   Settings - <what changed>               e.g.  Settings - add hex color mode for RGB lights
# Issue reference (optional): append (#519) — or paste the full issue URL — and the
# release turns it into a changelog link. release.ps1 also asks per entry.
- PIN protection - the "Editable via MCP" release now shows up as soon as a PIN is typed, instead of only after saving and reloading
- PIN protection - the PIN settings of a section or tab no longer vanish after saving
- PIN protection - sections and tabs got a "Remove PIN" button; a PIN kept server-side could not be taken back at all, because its input field is always empty. The adapter puts the protected content back into the configuration and forgets the vault entry in one step
