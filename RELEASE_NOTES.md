# Release notes for the NEXT version — English only (the release linter rejects German).
# One bullet per user-facing change; these become the ioBroker changelog, then this
# file is auto-reset to this template on the next stable release. Suggested style:
#   <Widget type> - <what changed>          e.g.  Thermostat - target temperature now shown inline
#   <General / widget-independent change>    e.g.  Tabs can be hidden from the tab bar
#   Settings - <what changed>               e.g.  Settings - add hex color mode for RGB lights
# Issue reference (optional): append (#519) — or paste the full issue URL — and the
# release turns it into a changelog link. release.ps1 also asks per entry.
- Section title - the "Framed" style is now part of the AI widget schema, so the MCP accepts what the editor writes
- Layout styles come from one list for the editor, the AI schema and the documentation - styles no widget ever rendered are gone, and the light, camera and knob now show their real styles everywhere
- Editor - a stored layout the widget type does not know is now named instead of silently falling back to the default
- AI review - aura_review now checks the stored dashboard against the widget schema and reports values a write would refuse
- PIN protection - section and tab PINs are now enforced server-side: the PIN and the protected widgets stay in the adapter and only reach the browser after the code is verified (scrypt hash + rate limit against guessing), so the gate holds up even against the dev tools
- Admin login - now verified server-side instead of in the browser; please set the admin password once after this update (the previous one does not carry over)
