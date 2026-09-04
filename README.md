# Cyber-X-Hub

Kuratiertes Informationsportal zum Cyberversicherungsmarkt DACH mit globalem Kontext — für Versicherer, Makler und Investoren. Ein Herausgeber, keine Redaktion, kein Server, keine Datenbank: Die Datenbasis liegt als Dateien in diesem Repository, die Seite wird daraus statisch gebaut.

Fachkonzept: [`docs/fachkonzept.html`](docs/fachkonzept.html)

## Aufbau

```
data/               eine JSON-Datei je Entität (die Datenbasis)
  akteure.json      Akteure mit Rollen, Beziehungen, Quellen, Prüfdatum
  kennzahlen.json   Kennzahlen mit Wert, Periode, Stichtag, Qualitätsstufe, Quelle
  rechtsakte.json   Rechtsakte mit Fristenkette und Versicherungsrelevanz
  meldungen.json    kuratierte Meldungen (Nachricht, Transaktion, Regulierungsschritt)
  vorfaelle.json    Cybervorfälle Deutschland mit Koordinaten (Karte)
  boerse.json       börsennotierte Marktteilnehmer
  gruppen.json      Akteursgruppen mit Rangfolge und Bedeutung
  themen.json       Dossiers des Herausgebers
  quellen.json      Quellenverzeichnis mit Lizenzstatus
  glossar.json · leitthema.json · herausgeber.json · aenderungslog.json · stand.json
  eingang/          Feed-Vorschläge (automatisch, nicht veröffentlicht)
  kurse/            Tagesschlusskurse (automatisch)
geo/deutschland.json   Bundesländergrenzen als SVG-Pfade (© GeoBasis-DE / BKG, dl-de/by-2-0)
assets/hero.jpg        Titelbild
src/template.html      Seite (HTML, CSS, JS) mit Platzhaltern für Daten und Bild
scripts/build.mjs      validiert die Daten und erzeugt dist/index.html
scripts/feeds.mjs      holt RSS-Quellen und schreibt Vorschläge nach data/eingang/
scripts/kurse.mjs      holt Wochenschlusskurse (Yahoo Finance, ohne Schlüssel) nach data/kurse/
workflows-vorlage/     GitHub-Actions-Workflows (Build & Deploy, nächtliche Feeds & Kurse) – nach .github/workflows/ verschieben, sobald das Token das Recht „workflow“ hat
```

## Arbeiten mit der Datenbasis

```bash
node scripts/build.mjs        # Validierung + Build nach dist/
node scripts/feeds.mjs        # Feed-Vorschläge einsammeln
node scripts/kurse.mjs        # Kurse aktualisieren
python3 -m http.server 8080 -d dist   # lokal ansehen
```

Der Build bricht ab, wenn eine Regel des Fachkonzepts verletzt ist: jede Kennzahl braucht Quelle, Periode und Stichtag; jede Meldung braucht eine Quelle und mindestens einen verknüpften Akteur oder Rechtsakt; jeder Akteur braucht Quelle und Prüfdatum; jede Beziehung muss auf einen bekannten Akteur zeigen.

**Redaktionsablauf (eine Person):**
1. Nächtlich landen neue Feed-Einträge als Vorschläge in `data/eingang/<Datum>.json` — mit vorgeschlagener Domäne, Akteuren und Rechtsakten.
2. Der Herausgeber prüft die Primärquelle, formuliert Zusammenfassung und Einordnung und überträgt die Meldung nach `data/meldungen.json`. Nicht übernommene Vorschläge bekommen `"status": "verworfen"`.
3. Commit auf `main` → Build → Veröffentlichung. Jede Änderung ist im Git-Verlauf nachvollziehbar; sichtbare Korrekturen stehen zusätzlich in `data/aenderungslog.json`.

**Qualitätsstufen** (`qual`): `ok` Primärquelle geprüft · `abg` Sekundärquelle oder Schätzung · `ind` indikativ, ohne belastbare Quelle.

## Veröffentlichung

Live: **https://professororbach.github.io/cyber-x-hub/** — GitHub Pages liefert den Zweig `gh-pages` aus.

```bash
bash scripts/deploy-pages.sh    # Build + Push von dist/ nach gh-pages
```

Sobald das Token das Recht „workflow“ hat (`gh auth refresh -h github.com -s workflow`), die Dateien aus `workflows-vorlage/` nach `.github/workflows/` verschieben: Dann baut GitHub bei jedem Push auf `main` automatisch und holt nächtlich Feeds und Kurse. Für EU-Hosting mit Auftragsverarbeitung kann derselbe `dist/`-Ordner auf Cloudflare Pages oder einen deutschen Anbieter (z. B. Hetzner) gelegt werden.

## Datenherkunft und Lizenzen

- Karte: Verwaltungsgrenzen des Bundesamts für Kartographie und Geodäsie (© GeoBasis-DE / BKG, Datenlizenz Deutschland – Namensnennung 2.0), vereinfacht über das Projekt deutschlandGeoJSON.
- Kurse: Wochenschlusskurse der letzten 52 Wochen über die öffentliche Chart-Schnittstelle von Yahoo Finance (inoffiziell, kein Schlüssel, keine Echtzeit). Vor dem öffentlichen Betrieb die Nutzungsbedingungen prüfen; als lizenzierte Alternative mit kostenlosem Kontingent ist Twelve Data vorbereitet (Secret `TWELVEDATA_KEY` setzen). Stooq wurde verworfen, weil der Dienst Skriptabrufe mit einer Browser-Prüfung blockt.
- Markt- und Verbandszahlen: Einzelwerte mit Quellenangabe (Zitat); keine Übernahme ganzer Tabellen.
- Schriften: Playfair Display, DM Sans, DM Mono (SIL Open Font License) — für den Betrieb selbst hosten statt von Google laden.

## Stand

Prototyp mit Beispieldaten aus der Vorrecherche (September 2026). Vor dem Go-live: Werte gegen Primärquellen prüfen und Qualitätsstufe auf `ok` setzen, Herausgeber-Kurzprofil in `data/herausgeber.json` ergänzen, Impressum und Datenschutzerklärung anlegen.
