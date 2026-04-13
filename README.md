# ioBroker.aura

**Aura** is a modern visualization dashboard for [ioBroker](https://www.iobroker.net/).

> **Beta** – The project is under active development. Bugs and breaking changes are possible.

---

## Features

- **Flexible grid layout** with drag & drop
- **Multiple tabs / pages** per dashboard
- **Themes:** Dark, Light, Catppuccin (Latte, Frappé, Macchiato, Mocha), Apple Liquid Glass and more
- **Full admin interface** – no YAML, no JSON editing required
- **Responsive** – works on tablet, smartphone and desktop

### Widgets

| Widget | Description |
|--------|-------------|
| Switch | On/Off toggle |
| Dimmer | Brightness slider |
| Thermostat | Target / actual temperature |
| Gauge | Round gauge with color zones |
| Fill level | Tank / water / gas level – vertical or horizontal |
| Chart | Line, bar, pie chart (ECharts) |
| Calendar | iCal / Google Calendar |
| Weather | Current weather data |
| Clock | Analog or digital |
| iFrame / Camera | Embed any URL |
| EVCC | Wallbox, solar, battery storage |
| Waste collection | Which bin needs to go out? |
| Group | Nested widgets |

---

## Installation

Aura is **not yet** in the official ioBroker repository. Install manually via GitHub URL.

### Step 1 – Install adapter

1. Open ioBroker Admin
2. **Adapters** → click the **GitHub icon** (Install from URL) in the top right
3. Enter the following URL and install:

```
https://github.com/hdering/ioBroker.aura
```

### Step 2 – Create instance

After installation, create a new **Aura** instance (if not done automatically).

### Step 3 – Open dashboard

The dashboard is available at:

```
http://<iobroker-ip>:8082/aura/
```

The admin interface at:

```
http://<iobroker-ip>:8082/aura/#/admin
```

---

## Updates

Since Aura is installed from an external URL, updates are **not applied automatically**.

Connect to the ioBroker server via SSH, navigate to the ioBroker directory (usually `/opt/iobroker`) and run:

```bash
npm install iobroker.aura@latest --force && iobroker upload aura && iobroker restart aura
```

Current version and changelog: [Releases](https://github.com/hdering/ioBroker.aura/releases)

---

## Bugs & Feature Requests

Please report directly as a GitHub issue:

👉 **[github.com/hdering/ioBroker.aura/issues](https://github.com/hdering/ioBroker.aura/issues)**

---

## Development

```bash
# Install dependencies
npm install

# Start dev server (connects to ioBroker via proxy)
npm run dev

# Production build
npm run build:adapter
```

---

## License

MIT

---

---

# ioBroker.aura (Deutsch)

**Aura** ist ein modernes Visualisierungs-Dashboard für [ioBroker](https://www.iobroker.net/).

> **Beta** – Das Projekt ist noch in aktiver Entwicklung. Bugs und Breaking Changes sind möglich.

---

## Features

- **Flexibles Grid-Layout** mit Drag & Drop
- **Mehrere Tabs / Seiten** pro Dashboard
- **Themes:** Dark, Light, Catppuccin (Latte, Frappé, Macchiato, Mocha), Apple Liquid Glass u.v.m.
- **Vollständige Admin-Oberfläche** – keine YAML, kein JSON-Editieren
- **Responsive** – funktioniert auf Tablet, Smartphone und Desktop

### Widgets

| Widget | Beschreibung |
|--------|-------------|
| Schalter | Ein/Aus, Toggle |
| Dimmer | Helligkeit mit Slider |
| Thermostat | Soll-/Ist-Temperatur |
| Gauge | Rundes Messgerät mit Farbzonen |
| Füllstandsanzeige | Tank/Wasser/Gas – vertikal oder horizontal |
| Diagramm | Linien-, Balken-, Tortendiagramm (ECharts) |
| Kalender | iCal / Google Calendar |
| Wetter | Aktuelle Wetterdaten |
| Uhr | Analog oder Digital |
| iFrame / Kamera | Einbettung beliebiger URLs |
| EVCC | Wallbox, Solar, Batteriespeicher |
| Müllabfuhr | Welche Tonne muss raus? |
| Gruppe | Verschachtelte Widgets |

---

## Installation

Aura ist noch **nicht** im offiziellen ioBroker-Repository. Die Installation erfolgt manuell über eine GitHub-URL.

### Schritt 1 – Adapter installieren

1. ioBroker Admin öffnen
2. **Adapter** → oben rechts auf das **GitHub-Icon** (Von URL installieren) klicken
3. Folgende URL eingeben und installieren:

```
https://github.com/hdering/ioBroker.aura
```

### Schritt 2 – Instanz anlegen

Nach der Installation eine neue Instanz von **Aura** anlegen (falls nicht automatisch geschehen).

### Schritt 3 – Dashboard öffnen

Das Dashboard ist erreichbar unter:

```
http://<iobroker-ip>:8082/aura/
```

Die Admin-Oberfläche unter:

```
http://<iobroker-ip>:8082/aura/#/admin
```

---

## Updates

Da Aura von einer externen URL installiert wird, werden Updates **nicht automatisch** eingespielt.

Per SSH auf den ioBroker-Server verbinden, ins ioBroker-Verzeichnis wechseln (meist `/opt/iobroker`) und folgenden Befehl ausführen:

```bash
npm install iobroker.aura@latest --force && iobroker upload aura && iobroker restart aura
```

Den aktuellen Versionsstand und alle Änderungen gibt es unter [Releases](https://github.com/hdering/ioBroker.aura/releases).

---

## Bugs & Feature-Wünsche

Bitte direkt als GitHub Issue melden:

👉 **[github.com/hdering/ioBroker.aura/issues](https://github.com/hdering/ioBroker.aura/issues)**

---

## Lizenz

MIT
