// =====================================================================
// Blockdorf – Ton und Musik (Etappe 7)
//   Alles wird im Browser synthetisiert (Web Audio), es gibt keine Klangdateien:
//     Effekte      kurze Töne und Rauschen (Abbauen, Bauen, Schaden, Truhen …), Schritte je nach Untergrund
//     Ambiente     Regen als Rauschen, dunkles Brummen in tiefen Höhlen, Donner mit Verzögerung nach Entfernung
//     Musik        ruhige, zufällig komponierte Stücke je nach Stimmung (Tag, Nacht, Höhle, Regen, Nether, Ende, Boss)
//   Reiner Teil (Node-testbar): SFX-Rezepte, stepMaterial, musicMood, planPhrase, nextGap.
//   createAudio({ ctor }) bekommt den AudioContext von außen (im Test ein Attrappen-Objekt).
// =====================================================================
import { BLOCKS } from "./sandbox-data.js?v=8";

// ---------- Effekte: Liste von [Frequenz, Dauer, Wellenform, Lautstärke, Gleiten, Verzögerung in ms] ----------
export const SFX = {
  break: [[180, 0.09, "square", 0.05, -80, 0]], place: [[300, 0.06, "triangle", 0.06, 60, 0]], hurt: [[160, 0.22, "sawtooth", 0.06, -90, 0]],
  craft: [[520, 0.08, "triangle", 0.06, 0, 0], [780, 0.1, "triangle", 0.06, 0, 70]], pick: [[130, 0.04, "square", 0.025, 0, 0]],
  kill: [[420, 0.14, "square", 0.05, -250, 0]], jump: [[250, 0.07, "triangle", 0.03, 90, 0]], door: [[200, 0.08, "square", 0.04, -60, 0]],
  eat: [[300, 0.05, "square", 0.04, 0, 0], [260, 0.05, "square", 0.04, 0, 80]], hiss: [[700, 0.18, "sawtooth", 0.025, -450, 0]],
  boom: [[70, 0.55, "sawtooth", 0.09, -40, 0], [120, 0.4, "square", 0.06, -80, 0]], shoot: [[520, 0.12, "triangle", 0.05, -380, 0]],
  thunk: [[150, 0.06, "square", 0.04, -60, 0]], block: [[900, 0.05, "square", 0.04, 0, 0], [600, 0.07, "square", 0.03, 0, 0]],
  tame: [[660, 0.08, "triangle", 0.05, 0, 0], [880, 0.12, "triangle", 0.05, 0, 90]], tp: [[900, 0.2, "sine", 0.04, -700, 0]],
  splash: [[300, 0.2, "sawtooth", 0.025, 200, 0]], adv: [[523, 0.12, "triangle", 0.06, 0, 0], [659, 0.12, "triangle", 0.06, 0, 120], [784, 0.25, "triangle", 0.06, 0, 240]],
  xp: [[1050, 0.06, "sine", 0.03, 0, 0]], click: [[420, 0.03, "square", 0.02, 0, 0]], portal: [[150, 0.7, "sine", 0.06, 260, 0], [230, 0.6, "triangle", 0.04, 200, 120]],
  roar: [[80, 0.7, "sawtooth", 0.09, -30, 0], [130, 0.5, "square", 0.04, -60, 0]], gcharge: [[420, 0.7, "sine", 0.04, 520, 0]], gshoot: [[240, 0.3, "sawtooth", 0.07, -170, 0]],
  // neu in Etappe 7
  mode: [[392, 0.1, "triangle", 0.05, 0, 0], [587, 0.16, "triangle", 0.05, 0, 90]], chat: [[660, 0.04, "sine", 0.03, 0, 0]],
  error: [[200, 0.12, "square", 0.04, -60, 0], [150, 0.16, "square", 0.04, -40, 110]], land: [[110, 0.07, "sine", 0.05, -40, 0]],
  rain_on: [[900, 0.03, "sine", 0.01, -300, 0]], world: [[330, 0.1, "triangle", 0.05, 0, 0], [440, 0.1, "triangle", 0.05, 0, 100], [660, 0.2, "triangle", 0.05, 0, 200]]
};

// ---------- Schritte ----------
/** Untergrund eines Blocks: soft (Gras, Erde, Laub), hard (Stein), wood, grit (Sand, Kies), cloth, snow, water */
export function stepMaterial(id) {
  const b = BLOCKS[id];
  if (!b) return "hard";
  if (b.fluid) return "water";
  const k = String(b.key || "");
  if (/snow|ice/.test(k)) return "snow";
  if (/sand|gravel|soul/.test(k)) return "grit";
  if (/grass|dirt|leaves|farmland|mud|moss|litter|bush|mushroom|podzol|mycel/.test(k)) return "soft";
  if (/plank|log|wood|door|chest|bench|barrel|ladder|fence|bed|lectern|composter|carto|bookshelf|crafting|table|sign|trapdoor/.test(k)) return "wood";
  if (/wool|hay|cushion|carpet/.test(k)) return "cloth";
  return "hard";
}
export const STEP = {
  soft: { f: 95, d: 0.05, type: "triangle", v: 0.022, noise: 0.5 }, hard: { f: 150, d: 0.04, type: "square", v: 0.016, noise: 0.15 },
  wood: { f: 120, d: 0.055, type: "square", v: 0.02, noise: 0.2 }, grit: { f: 70, d: 0.07, type: "sawtooth", v: 0.012, noise: 1 },
  cloth: { f: 80, d: 0.05, type: "sine", v: 0.015, noise: 0.3 }, snow: { f: 60, d: 0.08, type: "sine", v: 0.012, noise: 0.9 },
  water: { f: 260, d: 0.1, type: "sine", v: 0.014, noise: 0.6 }
};

// ---------- Musik ----------
const D = 12;
/** Tonleitern als Halbtonschritte, Grundton (MIDI), Tempo (Sekunden je Zählzeit), Notenzahl, Klang */
export const MOODS = {
  day:    { scale: [0, 2, 4, 7, 9], root: 60, beat: 0.9, notes: [6, 10], type: "triangle", vol: 0.05, gap: [25, 70] },
  dusk:   { scale: [0, 2, 4, 7, 9], root: 55, beat: 1.1, notes: [5, 8], type: "triangle", vol: 0.045, gap: [30, 80] },
  night:  { scale: [0, 3, 5, 7, 10], root: 52, beat: 1.4, notes: [4, 7], type: "sine", vol: 0.05, gap: [35, 90] },
  rain:   { scale: [0, 4, 7, 11, 14], root: 57, beat: 1.2, notes: [6, 9], type: "sine", vol: 0.04, gap: [20, 50] },
  cave:   { scale: [0, 1, 5, 7, 8], root: 40, beat: 2.0, notes: [3, 5], type: "sine", vol: 0.05, gap: [30, 70] },
  nether: { scale: [0, 1, 4, 6, 7], root: 41, beat: 1.8, notes: [4, 6], type: "sawtooth", vol: 0.022, gap: [25, 60] },
  end:    { scale: [0, 2, 4, 6, 8, 10], root: 67, beat: 2.2, notes: [4, 6], type: "sine", vol: 0.045, gap: [20, 50] },
  boss:   { scale: [0, 3, 5, 6, 7, 10], root: 45, beat: 0.45, notes: [10, 16], type: "sawtooth", vol: 0.03, gap: [0.5, 2] }
};
export const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

/** Welche Stimmung passt gerade? Der Aufruf bekommt nur einfache Werte (gut testbar). */
export function musicMood({ dim = 0, boss = false, depth = 0, raining = false, time = 0.5 } = {}) {
  if (boss) return "boss";
  if (dim === 1) return "nether";
  if (dim === 2) return "end";
  if (depth > 18) return "cave";
  if (raining) return "rain";
  if (time >= 0.7 || time < 0.2) return "night";
  if (time >= 0.6 || time < 0.27) return "dusk";
  return "day";
}

/** Ein kurzes Stück: [{ t, f, d, v, type }] mit t in Sekunden ab Beginn (rng liefert 0…1) */
export function planPhrase(mood, rng) {
  const M = MOODS[mood] || MOODS.day;
  const n = M.notes[0] + Math.floor(rng() * (M.notes[1] - M.notes[0] + 1));
  const out = [];
  let deg = Math.floor(rng() * M.scale.length), t = 0;
  for (let i = 0; i < n; i++) {
    const step = rng() < 0.55 ? (rng() < 0.5 ? 1 : -1) : Math.floor(rng() * 5) - 2;
    deg = Math.max(-M.scale.length, Math.min(M.scale.length * 2 - 1, deg + step));
    const oct = Math.floor(deg / M.scale.length), idx = ((deg % M.scale.length) + M.scale.length) % M.scale.length;
    const midi = M.root + M.scale[idx] + oct * D;
    const len = M.beat * (rng() < 0.3 ? 2 : 1) * (0.8 + rng() * 0.4);
    out.push({ t: +t.toFixed(3), f: +midiHz(midi).toFixed(2), d: +(len * 1.8).toFixed(3), v: +(M.vol * (0.7 + rng() * 0.3)).toFixed(4), type: M.type });
    t += len * (rng() < 0.2 ? 1.5 : 1);
    if (mood === "boss" && rng() < 0.3) out.push({ t: +t.toFixed(3), f: +midiHz(M.root - 12).toFixed(2), d: 0.25, v: M.vol, type: "square" });
  }
  return out;
}
export function phraseLength(notes) { return notes.reduce((m, n) => Math.max(m, n.t + n.d), 0); }
/** Pause bis zum nächsten Stück in Sekunden */
export function nextGap(mood, rng) { const g = (MOODS[mood] || MOODS.day).gap; return g[0] + rng() * (g[1] - g[0]); }

// ---------- Web Audio ----------
export function createAudio({ ctor = (typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null), rng = Math.random } = {}) {
  let ac = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null, rainSrc = null, rainGain = null, rainFilter = null, caveGain = null, caveOsc = null;
  let cfg = { sound: false, sfx: 0.7, music: 0.35 };
  let musicT = 6, curMood = "day", queue = 0;

  function ensure() {
    if (!ac && ctor) {
      try {
        ac = new ctor();
        master = ac.createGain(); master.connect(ac.destination);
        sfxBus = ac.createGain(); sfxBus.connect(master);
        musicBus = ac.createGain(); musicBus.connect(master);
        noiseBuf = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * 2)), ac.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rng() * 2 - 1;
        applyVolumes();
      } catch (_) { ac = null; }
    }
    if (ac && ac.state === "suspended" && ac.resume) { try { ac.resume(); } catch (_) {} }
    return !!ac;
  }
  function applyVolumes() {
    if (!ac) return;
    const t = ac.currentTime;
    master.gain.setValueAtTime(cfg.sound ? 1 : 0, t);
    sfxBus.gain.setValueAtTime(cfg.sfx, t);
    musicBus.gain.setValueAtTime(cfg.music, t);
  }
  function apply(s) {
    cfg = { sound: !!s.sound, sfx: +s.sfx, music: +s.music };
    applyVolumes();
    if (!cfg.sound) { setAmbient({ rain: 0, cave: 0 }); }
  }
  const live = () => ac && cfg.sound;

  function tone(f, d, type = "square", v = 0.04, slide = 0, bus = sfxBus, at = 0) {
    if (!live()) return;
    const o = ac.createOscillator(), gn = ac.createGain(), t = ac.currentTime + at;
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(gn); gn.connect(bus); o.start(t); o.stop(t + d + 0.02);
  }
  function noise(d, v, freq, q = 1, at = 0, kind = "lowpass", bus = sfxBus) {
    if (!live() || !noiseBuf) return;
    const src = ac.createBufferSource(), fl = ac.createBiquadFilter(), gn = ac.createGain(), t = ac.currentTime + at;
    src.buffer = noiseBuf; fl.type = kind; fl.frequency.setValueAtTime(freq, t); fl.Q.setValueAtTime(q, t);
    gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(fl); fl.connect(gn); gn.connect(bus); src.start(t); src.stop(t + d + 0.02);
  }
  function sfx(name) {
    const r = SFX[name];
    if (!r || !live()) return;
    for (const [f, d, type, v, slide, delay] of r) {
      const f2 = name === "pick" ? f + rng() * 40 : name === "xp" ? f + (rng() - 0.5) * 600 : f;
      tone(f2, d, type, v, slide, sfxBus, delay / 1000);
    }
    if (name === "break" || name === "boom") noise(name === "boom" ? 0.5 : 0.12, name === "boom" ? 0.1 : 0.05, name === "boom" ? 400 : 1800);
  }
  function step(material, speed = 1) {
    const m = STEP[material] || STEP.hard;
    if (!live()) return;
    const k = 0.85 + rng() * 0.3;
    tone(m.f * k, m.d, m.type, m.v * Math.min(1.2, 0.6 + speed * 0.4), -m.f * 0.3, sfxBus);
    noise(m.d * 1.4, m.v * m.noise * 2, material === "grit" || material === "snow" ? 2500 : 900, 0.7);
  }
  /** Donner kommt je nach Entfernung (Blöcke) später und leiser */
  function thunder(dist = 20) {
    if (!live()) return;
    const at = Math.min(2.5, dist / 40), v = Math.max(0.05, 0.28 - dist * 0.003);
    noise(2.4, v, 220, 0.8, at); noise(1.2, v * 0.8, 900, 0.5, at); tone(55, 1.8, "sawtooth", v * 0.4, -20, sfxBus, at);
  }
  function setAmbient({ rain = 0, cave = 0 } = {}) {
    if (!ac || !noiseBuf) return;
    const t = ac.currentTime;
    if (rain > 0.02 && cfg.sound) {
      if (!rainSrc) {
        rainSrc = ac.createBufferSource(); rainSrc.buffer = noiseBuf; rainSrc.loop = true;
        rainFilter = ac.createBiquadFilter(); rainFilter.type = "bandpass"; rainFilter.frequency.value = 3000; rainFilter.Q.value = 0.5;
        rainGain = ac.createGain(); rainGain.gain.value = 0;
        rainSrc.connect(rainFilter); rainFilter.connect(rainGain); rainGain.connect(sfxBus); rainSrc.start();
      }
      rainGain.gain.setTargetAtTime(Math.min(1, rain) * 0.09, t, 0.6);
    } else if (rainGain) rainGain.gain.setTargetAtTime(0, t, 0.4);
    if (cave > 0.02 && cfg.sound) {
      if (!caveOsc) {
        caveOsc = ac.createOscillator(); caveOsc.type = "sine"; caveOsc.frequency.value = 46;
        caveGain = ac.createGain(); caveGain.gain.value = 0; caveOsc.connect(caveGain); caveGain.connect(musicBus); caveOsc.start();
      }
      caveGain.gain.setTargetAtTime(Math.min(1, cave) * 0.035, t, 1.5);
    } else if (caveGain) caveGain.gain.setTargetAtTime(0, t, 1);
  }
  /** Jede Bildzeit aufrufen: startet in Pausen ein neues Stück passend zur Stimmung */
  function music(dt, mood) {
    if (!live() || cfg.music <= 0.001) return;
    if (mood !== curMood) { curMood = mood; musicT = Math.min(musicT, 4 + rng() * 6); }
    musicT -= dt;
    if (musicT > 0 || !MOODS[mood]) return;
    const notes = planPhrase(mood, rng);
    for (const n of notes) {
      if (!live()) break;
      // sanfter Anschlag, langes Ausklingen, zweite leicht verstimmte Stimme
      tone(n.f, n.d, n.type, n.v, 0, musicBus, n.t);
      tone(n.f * 1.004, n.d * 0.8, "sine", n.v * 0.5, 0, musicBus, n.t);
    }
    queue++;
    musicT = phraseLength(notes) + nextGap(mood, rng);
  }
  function destroy() {
    try { if (rainSrc) rainSrc.stop(); if (caveOsc) caveOsc.stop(); } catch (_) {}
    try { if (ac && ac.close) ac.close(); } catch (_) {}
    ac = null; rainSrc = caveOsc = null;
  }
  return { ensure, apply, sfx, step, thunder, ambient: setAmbient, music, destroy, get ready() { return !!ac; }, get phrases() { return queue; }, tone };
}
