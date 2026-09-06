# Einstellungen

Allgemeine Einstellungen: Frontend, Grid, Sicherheit und Backup.

![](./assets/einstellungen.png)

| Karte | |
| --- | --- |
| Sprache | Deutsch / Englisch |
| Editor | Automatisch speichern + Intervall (`Strg+S` speichert sofort) |
| Admin-PIN | PIN für den Adminbereich setzen (min. 4 Zeichen) |
| Super-Admin-Schlüssel | Schützt Standard-Views vor Löschen; aktiviert über `/admin/popups?key=…` |
| Admin-Basis-URL | Relative Bildpfade in JSON-Tabellen-Widgets auflösen |
| Verbundene Geräte | Liste der Clients; umbenennen, feste ID vergeben, entfernen |
| Backup & Restore | Manuelles Backup laden/importieren; Auto-Backups (Anzahl, Wiederherstellen) |
| Alles zurücksetzen | Löscht Dashboards, Widgets, Themes und Einstellungen — nicht rückgängig |

## Client-ID

Jedes Gerät bekommt eine ID; darüber wird es einzeln angesprochen:
`aura.0.clients.<ID>.navigate.url`, `.navigate.target`, `.popup.open`, `.messages.send`.

Die ID wird beim ersten Kontakt vergeben und dann im Browser gespeichert. Sie bleibt
danach unverändert — Browser-Updates, Auflösungs- oder Skalierungswechsel ändern sie nicht.

| Feste ID vergeben | |
| --- | --- |
| Einstellungen → Verbundene Geräte | Beim eigenen Gerät auf ✎, Feld **Feste ID für dieses Gerät** |
| Beim Aufruf | `http://<host>:8095/?client=wohnzimmer-tablet` |
| Erlaubt | `a–z`, `0–9`, `-`, `_`, max. 40 Zeichen; `register`, `resolution`, `deleteRequest` sind belegt |

Beides legt `aura.0.clients.<ID>` neu an und entfernt den bisherigen Eintrag des Geräts.
Skripte, die noch die alte ID verwenden, laufen danach ins Leere.

::: tip
Wird der Browser eines Geräts gewechselt (Chrome → Edge), meldet sich das Gerät als
neuer Client. Mit einer festen ID über `?client=` bekommen beide dieselbe ID.
:::
