# Release notes for the NEXT version — English only (the release linter rejects German).
# One bullet per user-facing change; these become the ioBroker changelog, then this
# file is auto-reset to this template on the next stable release. Suggested style:
#   <Widget type> - <what changed>          e.g.  Thermostat - target temperature now shown inline
#   <General / widget-independent change>    e.g.  Tabs can be hidden from the tab bar
#   Settings - <what changed>               e.g.  Settings - add hex color mode for RGB lights
# Issue reference (optional): append (#519) — or paste the full issue URL — and the
# release turns it into a changelog link. release.ps1 also asks per entry.
- MCP - PIN-protected sections and tabs are now reported as protected instead of empty; without a release the AI server only sees their structure (id, type, gridPos) and cannot write, and aura_review counts them as not checked
- MCP - new per-view switch "Editable via MCP" in the editor (section/tab gear, admin login required) releases a PIN-protected view for the AI server without ever revealing the PIN; aura_write_tab stays blocked there
- PIN protection - a section's own badges and badge aggregate no longer get lost when a PIN is set on it
