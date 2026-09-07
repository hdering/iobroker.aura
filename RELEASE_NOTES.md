# Release notes for the NEXT version — English only (the release linter rejects German).
# One bullet per user-facing change; these become the ioBroker changelog, then this
# file is auto-reset to this template on the next stable release. Suggested style:
#   <Widget type> - <what changed>          e.g.  Thermostat - target temperature now shown inline
#   <General / widget-independent change>    e.g.  Tabs can be hidden from the tab bar
#   Settings - <what changed>               e.g.  Settings - add hex color mode for RGB lights
# Issue reference (optional): append (#519) — or paste the full issue URL — and the
# release turns it into a changelog link. release.ps1 also asks per entry.
List - a switch row with switchStyle "slide" plus on/off labels now keeps the slide toggle and puts the label next to it, instead of silently replacing the toggle with a text pill
AI access - height measurement: the weather and status overview widgets are measured now (per forecast day, and per row once maxRows caps them) instead of answering "not measured"; a layout that only shows a summary is no longer sized as if it stacked rows, and widget options that replace the typography the measurement was made with (weather: tempFontSize, fontScale, forecastRowGap) void the verdict out loud instead of reporting "fits"
AI access - height measurement: a widget type whose content comes from an instance or from free HTML is no longer promised that nothing can overflow — it gets its own class that says to check it in the browser
AI access - aura_rendered can now measure a tab nobody has open: a live browser renders it off-screen at the real grid width and reports back, so a freshly built tab can be checked without asking anyone to open it
AI access - a section with a single tab is now told that its last grid row only exists until a second tab is added (the tab bar takes it), so a tab built to the full budget no longer breaks the day a neighbour appears
AI access - aura_tab stays readable when a group carries an embedded image: a data: URI is trimmed to its head plus its size, with images="full" and groupDefs="summary" as the switches, and a trimmed payload is refused by the write tools instead of destroying the image
AI access - aura_validate hands back a token the write tools accept in place of the payload, so a tab does not go through the conversation twice
AI access - the per-element theme colors are reported in the only form that works in a configuration, var(--light-on, var(--accent-yellow)): they are not defined in the CSS unless customized, and a bare var(--light-on) paints nothing at all — aura_validate and aura_review now report one
