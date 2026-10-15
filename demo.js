// =====================================================================
// MyNotes Web-App – Demo-Modus (index.html?demo)
// Beispieldaten nur zum Ausprobieren. Es wird nichts geladen und nichts gespeichert.
// =====================================================================
(function () {
  "use strict";
  const DAY = 86_400_000, MIN = 60_000;
  const now = Date.now();

  // ---------- Zeichnungen im echten Format (siehe DrawingModel.kt) ----------
  function stroke(tool, color, width, pts, flags = "") {
    let s = tool + " " + color + " " + width + (flags ? " " + flags : "");
    let lx = 0, ly = 0;
    pts.forEach(([x, y], i) => {
      x = Math.round(x); y = Math.round(y);
      if (i === 0) s += " " + x + "," + y; else s += " " + (x - lx) + "," + (y - ly);
      lx = x; ly = y;
    });
    return s;
  }
  function wave(x0, y0, len, amp, n) {
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push([x0 + len * i / n, y0 + Math.sin(i / n * Math.PI * 3) * amp]);
    return pts;
  }
  function circle(cx, cy, r, n = 28) {
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push([cx + Math.cos(i / n * Math.PI * 2) * r, cy + Math.sin(i / n * Math.PI * 2) * r]);
    return pts;
  }
  /** Farbeimer-Füllung: Kreis als Pixel-Maske */
  function fillCircle(cx, cy, r, color) {
    const cell = 20; // Zeichnungs-Einheiten
    const left = cx - r, top = cy - r, w = Math.ceil(2 * r / cell), h = w;
    const bits = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const px = left + (x + 0.5) * cell - cx, py = top + (y + 0.5) * cell - cy;
      bits.push(px * px + py * py <= r * r);
    }
    const runs = [];
    let cur = false, run = 0;
    for (const b of bits) { if (b === cur) run++; else { runs.push(run); cur = b; run = 1; } }
    runs.push(run);
    const m = "m" + Math.round(left * 100) + ";" + Math.round(top * 100) + ";" + Math.round(cell * 100) + ";" + w + ";" + h + ";" + runs.map(v => v.toString(36)).join(".");
    return "F " + color + " 10 a70 " + m;
  }
  const esc = t => t.replace(/%/g, "%25").replace(/ /g, "%20").replace(/\n/g, "%0A");

  const orgChart = [
    "D1 1100 d",
    "C 1 3600 400 2800 1000 1E88E5 " + esc("Geschäftsführung") + " @[Team-Übersicht](note:7)",
    "C 2 600 2600 2600 900 - " + esc("Vertrieb"),
    "C 3 3700 2600 2600 900 - " + esc("Entwicklung") + " @[Arbeit](folder:1)",
    "C 4 6800 2600 2600 900 43A047 " + esc("Support"),
    "C 5 3700 4600 2600 1000 FDD835 " + esc("App-Team\n4 Personen"),
    "K 1 2 a i", "K 1 3 a i", "K 1 4 a i", "K 3 5 l 8E24AA",
    stroke("M", "FB8C00", 300, wave(700, 9300, 8600, 150, 30)),
    stroke("P", "i", 60, [[600, 6400], [2400, 6400], [2400, 7600], [600, 7600], [600, 6400]], "s g1"),
    "L 1 @[Budget Oktober](note:3)"
  ].join("\n");

  const sketch = [
    "D1 700 g",
    fillCircle(2500, 3500, 1400, "FDD835"),
    stroke("P", "i", 80, circle(2500, 3500, 1400)),
    stroke("P", "E53935", 120, wave(4600, 3500, 4600, 900, 40)),
    stroke("M", "1E88E5", 450, [[4800, 1200], [6000, 900], [7400, 1300], [9000, 900]]),
    stroke("P", "43A047", 90, [[5200, 5600], [7200, 5600], [6200, 4200], [5200, 5600]], "s f a60")
  ].join("\n");

  // ---------- Helfer ----------
  let blockId = 100;
  const B = (type, content = "", extra = {}) => ({ id: ++blockId, type, content, checked: false, position: 0, priority: 0, highlight: null, collapsed: false, page: 0, ...extra });
  const notes = [], blocks = [], folderRefs = [], labelRefs = [];
  function note(id, title, opts, blockList) {
    notes.push({
      id, title, favorite: false, archived: false, deleted: false, deletedAt: null, template: false, reminder: null,
      reminderRepeat: 0, reminderHasTime: false, color: null, createdAt: now - 40 * DAY + id * 3600_000,
      modifiedAt: now - id * 37 * MIN, sort: id, pageNames: null, ...opts
    });
    const perPage = {};
    blockList.forEach(b => { b.noteId = id; b.position = perPage[b.page] = (perPage[b.page] ?? -1) + 1; blocks.push(b); });
    (opts.folders || []).forEach(f => folderRefs.push([id, f]));
    (opts.labels || []).forEach(l => labelRefs.push([id, l]));
  }

  const folders = [
    { id: 1, name: "Arbeit", color: "#1E88E5", parentId: null, sort: 1 },
    { id: 2, name: "Meetings", color: "#4FC3F7", parentId: 1, sort: 1 },
    { id: 3, name: "Website-Relaunch", color: "#8E24AA", parentId: 1, sort: 2 },
    { id: 4, name: "Uni", color: "#43A047", parentId: null, sort: 3 },
    { id: 5, name: "Privat", color: "#FB8C00", parentId: null, sort: 5 },
    { id: 6, name: "Umzug 2026", color: "#E53935", parentId: 5, sort: 1 },
    { id: 7, name: "Rezepte", color: "#FDD835", parentId: 5, sort: 2 },
    { id: 8, name: "Finanzen", color: null, parentId: null, sort: 6 }
  ].map(f => ({ ...f, createdAt: now - 90 * DAY, modifiedAt: now - 2 * DAY }));

  // 1 Einkaufsliste
  note(1, "Einkaufsliste", { favorite: true, color: "#635D19", folders: [5], labels: [1], modifiedAt: now - 4 * MIN }, [
    B("CHECKLIST_ITEM", "Milch", { priority: 0 }), B("CHECKLIST_ITEM", "Kaffeebohnen ☕", { priority: 3 }),
    B("CHECKLIST_ITEM", "Brot", { checked: true }), B("CHECKLIST_ITEM", "Tomaten, Basilikum, Mozzarella", { priority: 2 }),
    B("CHECKLIST_ITEM", "Spülmittel", { checked: true }), B("CHECKLIST_ITEM", "Geschenk für Lena", { priority: 1 }),
    B("TEXT", "Angebot bei https://www.example.org/angebote ansehen.")
  ]);
  // 2 Meeting
  note(2, "Team-Meeting 10.10.", { folders: [2], labels: [2], modifiedAt: now - 25 * MIN, reminder: now + 2 * 3600_000, reminderHasTime: true }, [
    B("TEXT", "Teilnehmer: Anna, Ben, Chris, ich\nOrt: Raum 3.14 / Teams"),
    B("HEADING", "Ergebnisse"),
    B("TEXT", "Release wird auf den 24.10. verschoben – Details siehe @[App-Release](note:9) und @[Budget Oktober › Summe](note:3#305).", { highlight: "yellow" }),
    B("CHECKLIST_ITEM", "Ben: Testplan bis Mittwoch", { priority: 2 }),
    B("CHECKLIST_ITEM", "Ich: Kunden informieren", { priority: 3 }),
    B("CHECKLIST_ITEM", "Protokoll verschicken", { checked: true }),
    B("HEADING", "Offene Fragen"),
    B("TEXT", "Wer übernimmt die Doku? Brauchen wir ein zweites Testgerät?"),
    B("HEADING", "Alte Notizen", { collapsed: true }),
    B("TEXT", "Vorbesprechung vom 03.10. – erledigt."),
    B("DIVIDER"),
    B("TEXT", "Nächstes Meeting: Do 17.10. 10:00 – Ordner @[Meetings](folder:2)")
  ]);
  // 3 Budget
  note(3, "Budget Oktober", { folders: [8], labels: [3], color: "#345920", modifiedAt: now - 3 * 3600_000 }, [
    B("TEXT", "Monatsübersicht – Ergebnisse rechnet das Handy."),
    B("CALC", "# Einnahmen\nGehalt = 2.450 €\nNebenjob = 380 €\n\n# Ausgaben\nMiete = 820 €\nStrom 65 €\nHandy 18 €\nLebensmittel 4 × 85 €\nSumme\n\nÜbrig = Gehalt + Nebenjob - 820 € - 65 € - 18 € - 340 €"),
    B("HEADING", "Summe"),
    B("TABLE", "Kategorie|Plan|Ist\nMiete|820 €|820 €\nLebensmittel|320 €|340 €\nFreizeit|150 €|96 €\nSparen|500 €|500 €")
  ]);
  blocks.find(b => b.content === "Summe" && b.type === "HEADING").id = 305;
  // 4 Organigramm
  note(4, "Organigramm Firma", { folders: [1], modifiedAt: now - 6 * 3600_000 }, [
    B("TEXT", "Stand Oktober – Karten anklicken öffnet die verknüpften Notizen."),
    B("DRAWING", orgChart)
  ]);
  // 5 Skizze
  note(5, "Skizze Logo-Idee", { folders: [3], labels: [2], modifiedAt: now - 26 * 3600_000 }, [B("DRAWING", sketch), B("TEXT", "Sonne + Welle? Farben: Gelb/Rot/Blau")]);
  // 6 Foto
  note(6, "Urlaub Gardasee", { folders: [5], modifiedAt: now - 3 * DAY }, [B("TEXT", "Lieblingsfoto vom Sonnenuntergang:"), B("IMAGE", "img_demo1.webp"), B("TEXT", "Hotel: Villa Sole, Zimmer 12")]);
  // 7 Steckbrief
  note(7, "Team-Übersicht", { folders: [1], favorite: true, modifiedAt: now - 5 * DAY }, [
    B("PROFILE", JSON.stringify({ fields: [{ l: "Name", v: "Max Mustermann" }, { l: "Geburtstag", v: "14.03.1995" }, { l: "E-Mail", v: "max@example.org" }, { l: "Telefon", v: "+49 170 1234567" }, { l: "Anschrift", v: "Musterstraße 1\n12345 Musterstadt" }, { l: "IBAN", v: "DE00 0000 0000 0000 0000 00" }] })),
    B("TEXT", "Ansprechpartner für alles rund ums Backend.")
  ]);
  // 8 Arbeitszeit – GEÄNDERT (BC): echte Beispieldaten (die Web-App rechnet jetzt selbst), dazu ein ausgeblendeter Block
  function demoWork() {
    const t = new Date(), y = t.getFullYear(), m = t.getMonth();
    const key = d => y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    const times = [["08:02", "16:45"], ["08:15", "15:30"], ["07:50", "17:10"], ["08:30", "16:30"], ["08:00", "17:12"], ["07:45", "16:05"]];
    const entries = [];
    let n = 0;
    for (let d = 1; d < t.getDate(); d++) {
      const dow = new Date(y, m, d).getDay();
      if (dow === 0 || dow === 6) continue;
      if (n === 2) entries.push({ d: key(d), s: null, e: null, p: null, st: "VACATION" });
      else { const [s, e] = times[n % times.length]; entries.push({ d: key(d), s, e, p: null, st: "REGULAR" }); }
      n++;
    }
    entries.push({ d: key(t.getDate()), s: "08:10", e: null, p: null, st: "REGULAR" });
    return JSON.stringify({ v: 1, weekMin: 40 * 60, days: [1, 2, 3, 4, 5], pauseMin: 30, startSaldo: 150, nrw: true, entries });
  }
  note(8, "Arbeitszeit", { folders: [1], modifiedAt: now - 9 * 3600_000 }, [
    B("WORKTIME", demoWork()),
    B("TEXT", "Stundenzettel immer bis zum 5. abgeben."),
    B("TEXT", "Alte Regel aus 2024 – am Handy ausgeblendet.", { hiddenInNote: true })
  ]);
  // 9 Projekt-Notiz
  note(9, "App-Release", { folders: [1], labels: [1], modifiedAt: now - 50 * MIN }, [
    B("PROJECT", "projekt"),
    B("CHECKLIST_ITEM", "Kick-off-Termin", { checked: true }),
    B("HEADING", "Planung"),
    B("CHECKLIST_ITEM", "Anforderungen sammeln", { checked: true }), B("CHECKLIST_ITEM", "Zeitplan", { checked: true }),
    B("HEADING", "Umsetzung"),
    B("CHECKLIST_ITEM", "Login überarbeiten", { checked: true }), B("CHECKLIST_ITEM", "PC-Web-App", { priority: 3 }), B("CHECKLIST_ITEM", "Tests schreiben", { priority: 2 }),
    B("HEADING", "Veröffentlichung"),
    B("CHECKLIST_ITEM", "Store-Texte"), B("CHECKLIST_ITEM", "Screenshots")
  ]);
  // 10 Seiten
  note(10, "Lieblingsrezepte", { folders: [7], pageNames: "Frühstück\nMittag\nAbend", color: "#614A19", modifiedAt: now - 8 * DAY }, [
    B("HEADING", "Overnight Oats", { page: 0 }), B("TEXT", "50 g Haferflocken, 150 ml Milch, Beeren, Honig. Über Nacht in den Kühlschrank.", { page: 0 }),
    B("HEADING", "Pasta al Pomodoro", { page: 1 }), B("CHECKLIST_ITEM", "500 g Spaghetti", { page: 1 }), B("CHECKLIST_ITEM", "1 Dose Tomaten", { page: 1 }), B("CHECKLIST_ITEM", "Knoblauch, Basilikum", { page: 1 }),
    B("TEXT", "Tomaten mit Knoblauch 15 Min köcheln, Basilikum zum Schluss.", { page: 1 }),
    B("HEADING", "Ofengemüse", { page: 2 }), B("TEXT", "200 °C, 30 Minuten. Mit Feta bestreuen.", { page: 2 })
  ]);
  // 11 Code
  note(11, "Git-Befehle", { folders: [4], labels: [2], modifiedAt: now - 12 * DAY }, [
    B("TEXT", "Die wichtigsten Befehle für die Abgabe:"),
    B("CODE", "git checkout -b feature/web-app\ngit add .\ngit commit -m \"Web-App\"\ngit push -u origin feature/web-app"),
    B("TEXT", "Doku: https://git-scm.com/docs")
  ]);
  // 12 Vorlage
  note(12, "Meeting-Vorlage", { template: true, modifiedAt: now - 30 * DAY }, [
    B("TEXT", "Datum:\nTeilnehmer:"), B("HEADING", "Themen"), B("CHECKLIST_ITEM", ""), B("HEADING", "Aufgaben"), B("CHECKLIST_ITEM", "")
  ]);
  note(13, "Wochenplan-Vorlage", { template: true, modifiedAt: now - 31 * DAY }, [
    B("HEADING", "Montag"), B("CHECKLIST_ITEM", ""), B("HEADING", "Dienstag"), B("CHECKLIST_ITEM", ""), B("HEADING", "Mittwoch"), B("CHECKLIST_ITEM", "")
  ]);
  // Archiv / Papierkorb
  note(14, "Alte Wohnungsbesichtigungen", { archived: true, folders: [6], modifiedAt: now - 60 * DAY }, [B("TEXT", "Lindenstraße 4 – zu dunkel\nParkweg 9 – zu teuer")]);
  note(15, "Entwurf (gelöscht)", { deleted: true, deletedAt: now - 2 * DAY, modifiedAt: now - 2 * DAY }, [B("TEXT", "Wird nicht mehr gebraucht.")]);
  // Umzug (Projekt-Ordner)
  note(16, "Umzugsfirma anfragen", { folders: [6], modifiedAt: now - 2 * DAY, reminder: now - DAY, reminderHasTime: false }, [
    B("CHECKLIST_ITEM", "3 Angebote einholen", { checked: true }), B("CHECKLIST_ITEM", "Termin festlegen", { checked: true })
  ]);
  note(17, "Kartons & Material", { folders: [6], modifiedAt: now - 1 * DAY }, [
    B("CHECKLIST_ITEM", "40 Kartons", { checked: true }), B("CHECKLIST_ITEM", "Klebeband", { checked: true }), B("CHECKLIST_ITEM", "Luftpolsterfolie")
  ]);
  note(18, "Ummelden & Verträge", { folders: [6], modifiedAt: now - 20 * 3600_000, reminder: now + 3 * DAY }, [
    B("CHECKLIST_ITEM", "Bürgeramt-Termin"), B("CHECKLIST_ITEM", "Strom/Internet umziehen"), B("CHECKLIST_ITEM", "Nachsendeauftrag")
  ]);
  note(19, "Einweihungsparty", { folders: [6], modifiedAt: now - 4 * DAY }, [B("TEXT", "Samstag nach dem Umzug, Gästeliste folgt.")]);
  // Website-Relaunch (Board)
  note(20, "Design-Entwürfe", { folders: [3], modifiedAt: now - 7 * DAY }, [B("CHECKLIST_ITEM", "Startseite", { checked: true }), B("CHECKLIST_ITEM", "Unterseiten", { checked: true })]);
  note(21, "Texte schreiben", { folders: [3], modifiedAt: now - 5 * DAY }, [B("CHECKLIST_ITEM", "Über uns", { checked: true }), B("CHECKLIST_ITEM", "Leistungen"), B("CHECKLIST_ITEM", "Impressum")]);
  note(22, "Hosting umziehen", { folders: [3], modifiedAt: now - 9 * DAY }, [B("TEXT", "Neuer Anbieter ab November.")]);
  // Uni
  note(23, "Klausur Statistik", { folders: [4], reminder: now + 9 * DAY, reminderHasTime: true, labels: [1], modifiedAt: now - 14 * DAY }, [
    B("HEADING", "Themen"), B("CHECKLIST_ITEM", "Wahrscheinlichkeitsrechnung", { checked: true }), B("CHECKLIST_ITEM", "Hypothesentests", { priority: 3 }), B("CHECKLIST_ITEM", "Regression", { priority: 2 }),
    B("TABLE", "Termin|Raum|Hilfsmittel\n19.10. 10:00|HS 1|Taschenrechner, 1 Blatt")
  ]);
  note(24, "Seminar-Ideen", { folders: [4], modifiedAt: now - 16 * DAY }, [B("TEXT", "• Nachhaltige Apps\n• Datenschutz bei Notiz-Apps 😉\n• Offline-First")]);
  note(25, "Geburtstage", { reminder: now + 1 * DAY, reminderRepeat: 4, modifiedAt: now - 20 * DAY }, [B("TEXT", "Lena 12.10.\nPapa 03.11.\nOma 28.12.")]);
  note(26, "Zitat", { color: "#42275E", modifiedAt: now - 21 * DAY }, [B("TEXT", "„Die beste Zeit, einen Baum zu pflanzen, war vor 20 Jahren. Die zweitbeste ist jetzt.“")]);
  for (let i = 27; i < 48; i++) {
    note(i, ["Idee", "Notiz", "Gedanke", "Link-Sammlung", "Buchtipp", "Podcast"][i % 6] + " " + (i - 26), { folders: i % 3 ? [] : [4], modifiedAt: now - i * 1.7 * DAY }, [
      B("TEXT", "Beispieltext Nummer " + (i - 26) + ". Hier steht etwas zum Durchsuchen – z. B. Kaffee, Statistik oder Gardasee.")
    ]);
  }
  // NEU (AR): Stundenplan wie die Skizze
  note(48, "Stundenplan WiSe", { folders: [4], favorite: true, modifiedAt: now - 30 * MIN }, [
    B("TIMETABLE", JSON.stringify({
      v: 1, days: [1, 2, 3, 4, 5], ab: true, aMon: null,
      slots: [{ s: "07:45", e: "10:50", l: "Pause 09:15–09:30" }, { s: "11:00", e: "14:30", l: "Pause 12:30–13:00" }, { s: "14:35", e: "17:45", l: "Pause 16:00–16:10" }],
      entries: [
        { id: "a", t: "Arbeit", c: 0xFFA8EFEA, d: 1, s: 0, n: 2 },
        { id: "b", t: "Labor Regelung", c: 0xFFD9A0F5, d: 1, s: 2, n: 1, who: "Th. Rottpeter", room: "V7-2.15" },
        { id: "c", t: "Projekt-management", c: 0xFFFFF27A, d: 2, s: 0, n: 1, who: "Ralf Thümler", room: "V7-0.04", tag: "Projekt" },
        { id: "d", t: "Mathe 2", c: 0xFF9BA2F7, d: 2, s: 1, n: 1, who: "St. Kraft", room: "V7-0.15" },
        { id: "e", t: "Labor EMAL", c: 0xFF8A8A8A, d: 2, s: 1, n: 1, room: "V7-3.04", w: "B" },
        { id: "f", t: "Labor Nachhaltige Energiesysteme", c: 0xFF86E879, d: 2, s: 2, n: 1, who: "Richard Heinzen", room: "V7-3.04" },
        { id: "g", t: "Arbeit", c: 0xFFA8EFEA, d: 3, s: 0, n: 3 },
        { id: "h", t: "Fertigungs-planung", c: 0xFFF78B8B, d: 4, s: 1, n: 1, who: "Hr. Becker", room: "V7-3.02" },
        { id: "i", t: "Unternehmens-gründung", c: 0xFFC2A07F, d: 4, s: 1, n: 1, who: "Dan. Pfennig", room: "V3-203" },
        { id: "j", t: "Arbeit", c: 0xFFA8EFEA, d: 5, s: 0, n: 3 }
      ]
    }))
  ]);
  // NEU (AZ): Stundenplan im neuen Format – Uhrzeiten, mehrere Tage, Arbeit als Hintergrund
  note(50, "Stundenplan (neues Format)", { folders: [4], modifiedAt: now - 20 * MIN }, [
    B("TIMETABLE", JSON.stringify({
      v: 2, days: [1, 2, 3, 4, 5], ab: false, aMon: null, home: true,
      slots: [{ s: "07:45", e: "10:50", l: "", b: [["09:15", "09:30"]] }, { s: "11:00", e: "14:30", l: "", b: [["12:30", "13:00"]] }, { s: "14:35", e: "17:45", l: "", b: [["16:00", "16:10"]] }],
      entries: [
        { id: "w", t: "Arbeit", c: 0xFFA8EFEA, days: [1, 3, 5], from: "07:45", to: "14:30" },
        { id: "m", t: "Mathe", c: 0xFF9BA2F7, days: [1], from: "11:00", to: "12:30", who: "Fr. Beispiel", room: "A 1.01" },
        { id: "p", t: "Projekt", c: 0xFFFFF27A, days: [2], from: "07:45", to: "10:50", tag: "Projekt" },
        { id: "l1", t: "Labor", c: 0xFF8A8A8A, days: [2], from: "11:00", to: "14:30", room: "B 2.04" },
        { id: "l2", t: "Übung", c: 0xFF86E879, days: [2], from: "11:00", to: "12:30", room: "B 0.10" },
        { id: "s", t: "Sprachkurs", c: 0xFFD9A0F5, days: [3], from: "15:00", to: "16:30", info: "Vokabeln" }
      ]
    }))
  ]);
  // NEU (AO): Wochenplan mit Über-Überschrift
  note(49, "Wochenplan", { folders: [5], modifiedAt: now - 80 * MIN }, [
    B("HEADING", "KW 41 · 05.10.2026 – 11.10.2026", { priority: 1, collapsed: true }),
    B("HEADING", "Arbeit"), B("CHECKLIST_ITEM", "Bericht", { checked: true }),
    B("HEADING", "KW 42 · 12.10.2026 – 18.10.2026", { priority: 1 }),
    B("HEADING", "Arbeit"), B("CHECKLIST_ITEM", "E-Pläne digitalisieren", { priority: 2 }), B("CHECKLIST_ITEM", "Meeting vorbereiten"),
    B("HEADING", "Uni"), B("CHECKLIST_ITEM", "Mathe-Übung abgeben"),
    B("HEADING", "Unterlagen", { priority: 3 }), B("TEXT", "Skript Kapitel 3 lesen"),
    B("HEADING", "Privat"), B("CHECKLIST_ITEM", "Einkaufen")
  ]);
  // Wochenend-Notiz ohne Ordner mit Überschrift
  const dividers = [
    { id: 1, area: 1, parentId: null, kind: 0, title: "Beruf", sort: 0, collapsed: false },
    { id: 2, area: 1, parentId: null, kind: 0, title: "Privat", sort: 4, collapsed: false },
    { id: 3, area: 0, parentId: 6, kind: 0, title: "Erledigt", sort: 100, collapsed: false }
  ];
  notes.find(n => n.id === 19).sort = 200;
  notes.find(n => n.id === 9).pinnedAt = now - 5 * DAY;
  notes.find(n => n.id === 3).pinnedAt = now - 4 * DAY;
  folders.find(f => f.id === 6).pinnedAt = now - 6 * DAY;

  const snapshot = {
    format: "mynotes-backup", version: 1, createdAt: now - 3 * MIN, appVersion: "1.2", dbVersion: 24,
    folders, notes, blocks,
    labels: [{ id: 1, name: "Wichtig", color: "#E53935" }, { id: 2, name: "Idee", color: "#FDD835" }, { id: 3, name: "Finanzen", color: "#43A047" }],
    folderRefs, labelRefs, backlinks: [[2, 9], [2, 3], [4, 7], [4, 3]], dividers,
    folderLinks: [{ folderId: 7, parentId: null, sort: 2 }, { folderId: 2, parentId: 4, sort: 50 }],
    projects: [{ folderId: 6, board: false, createdAt: now - 30 * DAY }, { folderId: 3, board: true, createdAt: now - 20 * DAY }],
    phases: [
      { id: 1, folderId: 6, name: "Vorbereitung", position: 0, color: "#1E88E5", collapsed: false },
      { id: 2, folderId: 6, name: "Umzugstag", position: 1, color: "#FB8C00", collapsed: false },
      { id: 3, folderId: 6, name: "Danach", position: 2, color: "#43A047", collapsed: false },
      { id: 4, folderId: 3, name: "Idee", position: 0, color: "#9E9E9E", collapsed: false },
      { id: 5, folderId: 3, name: "In Arbeit", position: 1, color: "#FB8C00", collapsed: false },
      { id: 6, folderId: 3, name: "Fertig", position: 2, color: "#43A047", collapsed: false }
    ],
    projectItems: [
      { folderId: 6, noteId: 16, phaseId: 1, done: true, position: 0 }, { folderId: 6, noteId: 17, phaseId: 1, done: false, position: 1 },
      { folderId: 6, noteId: 18, phaseId: 2, done: false, position: 0 }, { folderId: 6, noteId: 19, phaseId: 3, done: false, position: 0 },
      { folderId: 3, noteId: 22, phaseId: 4, done: false, position: 0 }, { folderId: 3, noteId: 21, phaseId: 5, done: false, position: 0 },
      { folderId: 3, noteId: 5, phaseId: 5, done: false, position: 1 }, { folderId: 3, noteId: 20, phaseId: 6, done: true, position: 0 }
    ]
  };
  const calcBlock = blocks.find(b => b.type === "CALC");
  const workBlock = blocks.find(b => b.type === "WORKTIME");
  const extras = {
    settings: { auto: true },
    applied: [],
    // NEU (BC): was das (Demo-)Handy vom PC versteht – wie PcFormat.caps() in 1.4-BC2
    caps: { inbox: 3, ops: ["title", "set", "del", "add", "work", "workcfg", "profile", "tt", "ttcfg"], set: ["CALC", "CHECKLIST_ITEM", "CODE", "HEADING", "TEXT"], add: ["CALC", "CHECKLIST_ITEM", "CODE", "DIVIDER", "HEADING", "TEXT"] },
    calc: {
      [calcBlock.id]: [{ h: true }, { v: "2.450,00 €", a: false }, { v: "380,00 €", a: false }, null, { h: true }, { v: "820,00 €", a: false }, { v: "65,00 €", a: false }, { v: "18,00 €", a: false }, { v: "340,00 €", a: false }, { v: "1.243,00 €", a: true }, null, { v: "1.587,00 €", a: false }]
    },
    work: {
      [workBlock.id]: {
        summary: "⏱ Arbeitszeit · Saldo +3:45 h",
        lines: ["Oktober 2026: Soll 88:00 h · Ist 36:30 h · Monat +1:15 h", "Übertrag +2:30 h · Gesamt +3:45 h", "Noch 14 Arbeitstage (Soll 56:00 h)",
          "Do 01.10. 08:02–16:45 · 8:13 h (+0:13 h)", "Fr 02.10. 08:15–15:30 · 6:45 h (−0:15 h)", "Mo 05.10. · Urlaub", "Di 06.10. 07:50–17:10 · 8:50 h (+0:50 h)", "Mi 07.10. 08:30–16:30 · 7:30 h (−0:30 h)", "Do 08.10. 08:00–17:12 · 8:42 h (+0:42 h)"]
      }
    }
  };
  const inbox = {
    format: "mynotes-pc-inbox", v: 3, // GEÄNDERT (BB): Änderungen als Schritte („ops“)
    notes: [
      { id: "demo-pc-1", title: "Link für später", created: now - 2 * 3600_000, modified: now - 2 * 3600_000, md: "https://developer.android.com/jetpack/compose\n\n- [ ] Am Wochenende lesen", blocks: [] },
      { id: "demo-pc-2", title: "Antwort an Vermieter", created: now - DAY, modified: now - 20 * 3600_000, md: "Sehr geehrter Herr Schmidt,\n\nvielen Dank für Ihre Nachricht. Der Übergabetermin am 31.10. passt mir gut.\n\nMit freundlichen Grüßen", blocks: [] },
      { id: "demo-pc-3", title: "Todo vom Büro-PC", created: now - 3 * DAY, modified: now - 3 * DAY, md: "- [x] Drucker bestellt\n- [ ] Rechnung weiterleiten", blocks: [] },
      { id: "demo-pc-4", title: "Literatur Seminar", created: now - 40 * MIN, modified: now - 40 * MIN, md: "## Quellen\n- [ ] Buch aus der Bibliothek holen", blocks: [], folderId: 4 }
    ],
    edits: [{
      id: "demo-edit-1", noteId: 1, noteTitle: "Einkaufsliste", at: now - 10 * MIN, base: now - 4 * MIN,
      ops: [
        { op: "set", blockId: 101, from: "Milch", to: "Hafermilch (2 Packungen)", checked: false, level: null },
        { op: "add", tmp: "demoadd1", after: 106, page: 0, type: "CHECKLIST_ITEM", content: "Batterien AA", checked: false, level: null }
      ]
    }]
  };
  window.MyNotesDemo = {
    setup() {
      return { user: { name: "Jasper Beispiel", email: "demo@example.org", photo: null }, snapshot, extras, inbox, done: ["demo-pc-3"] };
    },
    async image() {
      const c = document.createElement("canvas");
      c.width = 1200; c.height = 800;
      const g = c.getContext("2d");
      const grad = g.createLinearGradient(0, 0, 0, 800);
      grad.addColorStop(0, "#ff9a5a"); grad.addColorStop(0.55, "#ffcf70"); grad.addColorStop(0.56, "#2f6f9f"); grad.addColorStop(1, "#173d5c");
      g.fillStyle = grad; g.fillRect(0, 0, 1200, 800);
      g.fillStyle = "#fff3c4"; g.beginPath(); g.arc(600, 440, 90, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(20,40,60,.85)"; g.beginPath(); g.moveTo(0, 470); g.lineTo(260, 300); g.lineTo(520, 450); g.lineTo(760, 330); g.lineTo(1200, 460); g.lineTo(1200, 520); g.lineTo(0, 520); g.fill();
      await new Promise(r => setTimeout(r, 300));
      return await new Promise(r => c.toBlob(r, "image/png"));
    }
  };
})();
