# Release notes for the NEXT version — English only (the release linter rejects German).
# One bullet per user-facing change; these become the ioBroker changelog, then this
# file is auto-reset to this template on the next stable release. Suggested style:
#   <Widget type> - <what changed>          e.g.  Thermostat - target temperature now shown inline
#   <General / widget-independent change>    e.g.  Tabs can be hidden from the tab bar
#   Settings - <what changed>               e.g.  Settings - add hex color mode for RGB lights
# Issue reference (optional): append (#519) — or paste the full issue URL — and the
# release turns it into a changelog link. release.ps1 also asks per entry.
Universal Widget - the select cell can now take its entries from a JSON datapoint, and shows icons, images and HTML inside the dropdown, just like the standalone select widget (#615)
MCP server - aura_rendered now lists every widget of the tab, including the ones that draw nothing, and prints the content height next to the rendered one; a card that is simply larger than it needs to be is no longer reported as a deviation
Calendar - the calendar name, the event title, the date, the location and the coloured marker each carry their own CSS class now; the coloured dot/bar can be switched off, the calendar name aligned and the calendar icon resized in the editor (#618)
