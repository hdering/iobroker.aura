# Release notes for the NEXT version — English only (the release linter rejects German).
# One bullet per user-facing change; these become the ioBroker changelog, then this
# file is auto-reset to this template on the next stable release. Suggested style:
#   <Widget type> - <what changed>          e.g.  Thermostat - target temperature now shown inline
#   <General / widget-independent change>    e.g.  Tabs can be hidden from the tab bar
#   Settings - <what changed>               e.g.  Settings - add hex color mode for RGB lights
# Issue reference (optional): append (#519) — or paste the full issue URL — and the
# release turns it into a changelog link. release.ps1 also asks per entry.
Section title - new "framed" style that looks like a normal widget card, subtitle now shows in the compact and minimal styles too, the accent bar spans title and subtitle, and the title is no longer clipped at the top of the mobile view; the rule can now be hidden or given its own color, title and subtitle take their own color and text size, and the subtitle accepts the same value bindings as the HTML widget
Settings - deleting a connected device now removes its whole datapoint tree instead of leaving parts of it behind, works from the aura.0.clients.deleteRequest datapoint regardless of the ack flag, and a renamed or speaking client id is no longer cut after 8 characters in the object tree (#624)
Settings - the frontend notice about a new adapter version now waits for a confirmation instead of fading away after a few seconds, and comes back after a reload until it is answered; the new "Update notice has to be confirmed" option turns that off (#617)
