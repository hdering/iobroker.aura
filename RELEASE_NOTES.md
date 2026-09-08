# Release notes for the NEXT version — English only (the release linter rejects German).
# One bullet per user-facing change; these become the ioBroker changelog, then this
# file is auto-reset to this template on the next stable release. Suggested style:
#   <Widget type> - <what changed>          e.g.  Thermostat - target temperature now shown inline
#   <General / widget-independent change>    e.g.  Tabs can be hidden from the tab bar
#   Settings - <what changed>               e.g.  Settings - add hex color mode for RGB lights
# Issue reference (optional): append (#519) — or paste the full issue URL — and the
# release turns it into a changelog link. release.ps1 also asks per entry.
List - a switch row with switchStyle "slide" plus on/off labels now keeps the slide toggle and puts the label next to it, instead of silently replacing the toggle with a text pill
AI access - broad round of improvements for the MCP tools that let an AI read and build dashboards: more widget types report an honest height (weather and status overview are measured now, content from an instance or free HTML is flagged as "check it in the browser"), options that void a measurement say so instead of reporting "fits", aura_rendered can measure a tab nobody has open by rendering it off-screen at the real grid width, a section with a single tab is warned that its last grid row disappears once a second tab is added, aura_tab keeps embedded images readable via trimming plus images/groupDefs switches (and write tools refuse a trimmed payload), aura_validate hands back a token the write tools accept instead of sending a tab through the conversation twice, and theme colors are reported in the only form a configuration accepts, var(--light-on, var(--accent-yellow))
