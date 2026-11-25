# KraftCoach – Anleitung

Dein persönlicher KI-Trainingscoach als Web-App. Läuft komplett im Browser deines Handys,
speichert alles lokal und nutzt optional die kostenlose Gemini-API für Tagespläne.

---

## 1. Online stellen mit GitHub Pages (kostenlos, ohne Terminal)

Du brauchst nur einen Browser.

1. **Konto anlegen:** Auf <https://github.com> registrieren (kostenlos), falls du noch keins hast.
2. **Neues Repository:** Oben rechts auf **+** → **New repository**.
   - Name: z. B. `kraftcoach`
   - **Public** auswählen (GitHub Pages ist für öffentliche Repositorys kostenlos.
     Es landen keine persönlichen Daten darin: Trainingsdaten und API-Schlüssel bleiben auf deinem Handy.)
   - Auf **Create repository** klicken.
3. **Dateien hochladen:** Auf der leeren Repository-Seite auf **uploading an existing file** klicken.
   Dann **den Inhalt** des Projektordners (nicht den Ordner selbst) ins Browserfenster ziehen:
   `index.html`, `manifest.webmanifest`, `sw.js`, `ANLEITUNG.md` und die Ordner `css`, `js`, `icons`, `tests`.
   Unten auf **Commit changes** klicken.
4. **Pages einschalten:** Im Repository **Settings** → links **Pages** →
   unter *Build and deployment* bei **Source** „Deploy from a branch“ wählen,
   **Branch: main** und **/ (root)** → **Save**.
5. Nach 1–2 Minuten steht oben auf der Pages-Seite deine Adresse, z. B.
   `https://DEINNAME.github.io/kraftcoach/`. Diese Adresse öffnest du auf dem Handy.

### Updates später hochladen
Im Repository **Add file → Upload files** → im Finder den Inhalt von *trainingsapp* mit ⌘A markieren
und **ins Browserfenster ziehen** (nicht „choose your files“, sonst gehen die Ordner verloren).
Gleichnamige Dateien werden automatisch überschrieben → **Commit changes**.
Nach 1–2 Minuten ist das Update online (Reiter **Actions** zeigt einen grünen Haken).

Bei Änderungen am Code muss in `sw.js` oben die Zeile `const VERSION = 'kc-…';` hochgezählt sein
(`kc-v5`, `kc-v6` …), damit das Handy die neue Version sicher lädt. Danach die App am Handy einmal
ganz schließen (vom unteren Rand hochwischen) und neu öffnen.

---

## 2. Auf dem Handy installieren

- **iPhone (Safari):** Adresse öffnen → Teilen-Symbol (Quadrat mit Pfeil) → **Zum Home-Bildschirm**.
- **Android (Chrome):** Adresse öffnen → Menü ⋮ → **App installieren** bzw. **Zum Startbildschirm hinzufügen**.

Danach startet KraftCoach wie eine normale App, im Vollbild und auch offline.

> **Wichtig auf dem iPhone:** Nutze die App immer über das Symbol auf dem Home-Bildschirm.
> Safari-Tab und Home-Bildschirm-App haben **getrennte** Speicher.

---

## 3. KI einrichten (Google Gemini, kostenlos)

1. <https://aistudio.google.com/apikey> öffnen, mit Google-Konto anmelden.
2. **API-Schlüssel erstellen** → Schlüssel kopieren (beginnt meist mit `AIza…`).
3. In KraftCoach: **Einstellungen → KI-Coach** → Schlüssel einfügen → **Speichern** → **Verbindung testen**.

- Der Schlüssel wird **nur auf deinem Handy** gespeichert, nie im Code oder Repository
  und auch nicht im Backup.
- Standardmodell: `gemini-3.6-flash` (laut Google-Doku im November 2026 stabil und in der Gratis-Stufe).
  Alternative per Tipp: `gemini-3.5-flash-lite`. Falls Google ein Modell abschaltet,
  meldet die App „Dieses Modell gibt es nicht (mehr)“. Dann einfach die Modell-ID in den Einstellungen ändern.
- Die App braucht **eine KI-Anfrage pro Training** (für den Tagesplan). Die Live-Anpassung
  Satz für Satz rechnet die App selbst, sofort und offline.
- Ist die KI nicht erreichbar (offline, Limit erreicht, falscher Schlüssel), erstellt die App
  automatisch einen lokalen Plan und zeigt dir den Grund an.
- Hinweis: In der Gratis-Stufe darf Google Eingaben zur Verbesserung seiner Dienste nutzen.
  Gesendet werden nur Trainingswerte (Übungen, Gewichte, Erholung) und dein Profiltext.

---

## 4. So benutzt du die App

**Erster Start:** Die Einrichtung fragt in 7 kurzen Schritten (vieles optional):
1. **Ziele**: Hauptziele, Leistungsziele (z. B. 100 kg Bankdrücken), wichtige Muskelgruppen, kurz- und langfristige Ziele.
2. **Körper**: Alter, Geschlecht, Größe, Gewicht, Körperfett und Muskelmasse (falls bekannt), Fitness, normaler Ruhepuls/HRV, Beschwerden.
3. **Training**: Erfahrung, Trainingsjahre, Tage pro Woche, Dauer, Split, weitere Sportarten, Studio/Homegym, allein/Partner, Intensität, Equipment.
4. **Deine Werte**: Gewicht × Wiederholungen bei den wichtigsten Übungen. Damit schlägt die App sofort passende Gewichte vor.
5. **Ernährung**: Kalorien, Makros, Mahlzeiten, Wasser, Ernährungsform, Unverträglichkeiten, Supplements.
6. **Tagesablauf**: Aufstehen, Schlafen, Schule/Arbeit, Alltagsaktivität, Trainingszeit, Weg zum Gym, Essensmöglichkeiten, Verpflichtungen.
7. **KI-Schlüssel** (optional).

Jeder Bereich lässt sich später unter *Einstellungen → Profil* einzeln bearbeiten.

**Check-in:** Vor dem Plan fragt „Wie geht's dir heute?“ nach Energie, Schlaf, Muskelkater, Schmerzen
und einem Wunsch (z. B. Fokus Oberkörper oder *Nur Regeneration*). Unter **Mehr Angaben** kommen Schlafdauer,
Stress, Ruhepuls, HRV, letzte Mahlzeit, bisher gegessen, heutige Belastung und die Trainingsuhrzeit dazu.
Daraus berechnet die App live eine **Einschätzung**: *Volle Leistung*, *Normal*, *Volumen reduzieren* oder
*Lieber regenerieren*. Bei „Lieber regenerieren“ bietet der Plan einen **Regenerationstag** an
(lockeres Cardio + Mobility). Schmerzbereiche werden komplett gemieden.

**Dein Tag:** Unter dem Plan steht der ganze Tag: Morgenroutine, Essen vor dem Training, Training,
Essen und Trinken danach, Abendroutine mit Schlafenszeit. Oben stehen das Tagesziel für Kalorien, Protein, Kohlenhydrate
und Wasser. Uhrzeiten richten sich nach deinem Tagesablauf (Trainingszeit im Check-in änderbar), Essensbeispiele nach
deiner Ernährungsform, Supplements und Koffein nach deinen Angaben (unter 18: kein Koffein, kein großes Kaloriendefizit).
Mit KI-Schlüssel schreibt die KI die Tipps individuell, in **derselben Anfrage** wie den Trainingsplan, also ohne Mehrverbrauch.
Es sind allgemeine Empfehlungen, keine medizinische oder Ernährungsberatung.

**Apple Health:** Web-Apps dürfen Apple Health nicht direkt lesen (nur App-Store-Apps). Deshalb holt ein
iPhone-**Kurzbefehl** Ruhepuls, HRV, Schlaf, Gewicht und Schritte aus Health und kopiert sie. Im Check-in tippst du auf
**❤️ Werte aus Apple Health holen**: Die Werte landen im Check-in, das Gewicht im Profil. Die Schritt-für-Schritt-Anleitung
für den Kurzbefehl steht in der App unter *Einstellungen → Apple Health*. Optional läuft der Kurzbefehl jeden Morgen automatisch.
Jeder Health-Import und jeder Check-in beim Planen wird pro Tag gespeichert (auch Gewichtsänderungen aus Profil oder Chat).
Unter *Fortschritt → Körperwerte* siehst du Ruhepuls, HRV, Schlaf, Schritte, Aktivkalorien und Gewicht als Verlauf
(30/90/365 Tage) mit Ø 7 Tage und Trend. Die Werte sind Teil der Sicherung.

**Übungsanleitungen:** Zu jeder Übung gibt es eine kurze Anleitung mit **Animation** (Strichfigur mit Hantel/Gerät),
den wichtigsten Schritten und typischen Fehlern. Die App schlägt sie von selbst vor (💡), wenn eine Übung **neu für dich** ist
oder **technisch anspruchsvoll** (z. B. Kniebeuge, Kreuzheben) und du Anfänger/Wiedereinsteiger bist. Bei einfachen Maschinen
und Fortgeschrittenen kommt kein Vorschlag. Öffnen: im Plan auf den Übungsnamen tippen, im Training auf ⓘ.
„Kann ich schon“ blendet den Vorschlag für diese Übung aus; zurücksetzen oder ganz abschalten unter *Einstellungen → Training*.
Die Animation stoppt per Antippen.

**Coach-Chat:** Der kleine runde 💬-Knopf unten rechts öffnet auf jeder Seite (auch mitten im Training) einen Chat mit dem
KI-Coach. Frag ihn alles zu Training, Technik, Ernährung oder Supplements – er kennt dein Profil und das laufende Training.
Sagst du ihm, dass er etwas ändern soll (z. B. „Pause auf 2 Minuten“, „heute nur 40 Minuten“, „tausch Bankdrücken gegen
Kurzhanteln“, „streich die Kniebeugen“, „Ton aus“, „ich trainiere jetzt um 18 Uhr“), macht er das direkt. Unter seiner Antwort
steht mit ✓, was geändert wurde, und ein Knopf **↶ Rückgängig**. Der Chat darf nur eine feste Liste von Dingen ändern
(Pausen, Zeiten, Sätze/Wdh., Übungen tauschen/streichen/hinzufügen, Ton/Vibration, Gewicht, Supplements, Profilhinweise) –
nie Daten löschen oder den Schlüssel sehen. Ohne KI-Schlüssel (oder offline) versteht er einfache Befehle trotzdem.
Der Verlauf bleibt nur auf deinem Handy; „Leeren“ löscht ihn. Knopf ausblenden: *Einstellungen → KI*.
Jede Chat-Nachricht ist eine KI-Anfrage aus dem Gratis-Kontingent (dieselbe Bremse wie beim Tagesplan).

**Heute:** Verfügbare Zeit wählen (Standard 50 Min) → **Plan erstellen**. Jede Übung zeigt die geschätzte Dauer.
Mit ⇄ tauschst du eine Übung (z. B. Gerät belegt), mit ✕ entfernst du sie. Dann **Training starten**.

**Training:**
1. Oben steht der Vorschlag (Gewicht × Wiederholungen). Mit − / + anpassen, oder antippen und tippen.
2. Nach dem Satz einfach auf deinen **RIR** tippen (wie viele Wiederholungen noch gegangen wären:
   0 = Versagen … 4+ = locker). **Das speichert den Satz sofort**, also nur 1 Tipp, wenn der Vorschlag passte.
3. Der Pausentimer startet automatisch (Ton am Ende; Vibration nur bei Android).
4. Der nächste Vorschlag erscheint sofort: zu leicht → mehr Gewicht, zu schwer → weniger.
5. Oben siehst du die Zeit und die Prognose. Wirst du zu langsam, schlägt die App vor,
   einen Satz oder eine Übung zu streichen (Übernehmen / Ignorieren).

**Kalibrierung:** Bei neuen Übungen startet die App bewusst leicht. Gib den RIR ehrlich an,
dann steigert sie schnell (bei „4+“ um bis zu 25 % pro Satz). Nach 2–3 Einheiten sitzen die Gewichte.

**Fortschritt:** Kalender und Wochen-Serie, Wochenvolumen je Muskelgruppe, Rekorde 🏆,
und pro Übung ein Diagramm des geschätzten 1RM (Punkt antippen zeigt den Wert).

**Backup:** Einstellungen → **Backup exportieren**. Am iPhone öffnet sich das Teilen-Menü →
„In Dateien sichern“. Mach das regelmäßig, denn die Daten liegen nur auf dem Gerät.

---

## 5. Auf dem Mac ausprobieren (optional)

Im Terminal in den Projektordner wechseln und einen kleinen Webserver starten
(Ruby ist auf dem Mac schon vorhanden):

```bash
ruby -run -e httpd . -p 8123
```

Dann im Browser <http://localhost:8123> öffnen. Mit `Ctrl + C` im Terminal wieder beenden.

**Automatische Tests der Rechenlogik** (ohne Installation, nutzt die JavaScript-Engine von macOS):

```bash
/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc -m tests/logic.test.js
```

---

## Aufbau (für Neugierige)

| Ordner / Datei | Inhalt |
|---|---|
| `index.html`, `css/app.css` | Grundgerüst und Design (Dark Mode, große Tasten) |
| `js/data/exercises.js` | Übungskatalog (≈ 60 Übungen) – die KI darf nur diese wählen |
| `js/data/goals.js` | Ziele, Check-in-Optionen, Tagesform-Bewertung, Startwert-Übungen |
| `js/data/profile.js` | Erweitertes Profil (Körper, Ernährung, Tagesablauf …) |
| `js/data/guides.js` | Übungsanleitungen (Schritte, Fehler, Schwierigkeit) und wann sie vorgeschlagen werden |
| `js/logic/` | Rechenlogik: 1RM, Satzvorschläge, Zeitplanung, Erholung, lokaler Planer, Tages-Coach, Statistik, Körperwerte-Tagebuch |
| `js/ai/` | Gemini-Anbindung, JSON-Schema-Prüfung, Prompt; `chat.js`/`chatactions.js` = Coach-Chat und was er ändern darf |
| `js/views/` | Bildschirme: Heute, Training, Fortschritt, Übung, Einstellungen; `anim.js` = Übungsanimationen, `chat.js` = Chatfenster |
| `js/store.js` | Speicherung im Browser (IndexedDB), Backup |
| `sw.js`, `manifest.webmanifest` | Installation als App, Offline-Betrieb |
| `tests/logic.test.js` | 184 automatische Tests |
