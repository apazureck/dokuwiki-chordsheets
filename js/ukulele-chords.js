/**
 * ukulele-chords.js — Ukulele chord diagram renderer for the chordsheets plugin.
 *
 * Renders 4-string (GCEA standard tuning) chord diagrams using Raphael.js,
 * which is already loaded by jtab. Picks up any element with class
 * "jtab-ukulele" that has not yet been rendered.
 *
 * Chord data format (per entry):
 *   [baseFret, [gFret], [cFret], [eFret], [aFret]]
 *   Strings are ordered left-to-right: G (4th), C (3rd), E (2nd), A (1st).
 *   baseFret = 0  → open position, nut drawn as thick line.
 *   baseFret > 0  → starting fret; label shown to the right of the diagram.
 *   -1 = muted / not played, 0 = open string, positive = absolute fret number.
 *
 * All chord names follow the same normalisation as jtab / script.js:
 *   sharps: C#, F#, G#   flats: Eb, Bb   (not Db, Ab, A#, D# etc.)
 */

var ukulele = (function () {
    "use strict";

    // ── layout constants (mirror jtab proportions) ───────────────────────────
    var SS  = 16;   // string_spacing
    var FS  = 16;   // fret_spacing
    var STR = 4;    // number of strings
    var FR  = 4;    // number of frets to draw
    var MT  = 36;   // margin_top  (room for chord name + open/muted markers)
    var ML  = 16;   // margin_left
    var MR  = 18;   // margin_right (slightly wider to fit "fr" label)
    var MB  = 10;   // margin_bottom
    var NR  = 7;    // note dot radius

    var FW  = SS * (STR - 1);                     // fret board width  = 48
    var CW  = ML + FW + SS + MR;                  // canvas width      = 98
    var CH  = MT + FS * (FR + 0.5) + MB;          // canvas height     = 118

    var element_count = 0;

    // ── chord dictionary ─────────────────────────────────────────────────────
    // GCEA standard tuning — verified fret positions.
    // Only finger numbers are omitted intentionally (clean dot diagrams).
    var Chords = {
        // ── C ──────────────────────────────────────────────────────────────
        C:      [0, [0],  [0],  [0],  [3]],   // 0003
        Cm:     [0, [0],  [3],  [3],  [3]],   // 0333
        C6:     [0, [0],  [0],  [0],  [0]],   // 0000  (= Am7)
        C7:     [0, [0],  [0],  [0],  [1]],   // 0001
        Cmaj7:  [0, [0],  [0],  [0],  [2]],   // 0002
        Cm7:    [0, [3],  [3],  [3],  [3]],   // 3333 barre
        Csus2:  [0, [0],  [2],  [3],  [3]],   // 0233
        Csus4:  [0, [0],  [0],  [1],  [3]],   // 0013
        Cdim:   [0, [-1], [3],  [2],  [3]],   // x323  C Eb Gb
        Caug:   [0, [1],  [0],  [0],  [3]],   // 1003  G# C E = Caug

        // ── C# / Db ────────────────────────────────────────────────────────
        "C#":     [0, [1],  [1],  [1],  [4]],  // 1114
        "C#m":    [0, [1],  [4],  [4],  [4]],  // 1444
        "C#7":    [0, [1],  [1],  [1],  [2]],  // 1112  G# C# F B = C#7
        "C#maj7": [0, [1],  [1],  [1],  [3]],  // 1113  G# C# F C = C#maj7
        "C#m7":   [0, [4],  [4],  [4],  [4]],  // 4444 barre  C# E G# B
        "C#sus2": [0, [1],  [3],  [4],  [4]],  // 1344  G# Eb Ab C# = C#sus2
        "C#sus4": [0, [1],  [1],  [2],  [4]],  // 1124  G# C# F# C# = C#sus4

        // ── D ──────────────────────────────────────────────────────────────
        D:      [0, [2],  [2],  [2],  [0]],   // 2220
        Dm:     [0, [2],  [2],  [1],  [0]],   // 2210
        D6:     [2, [2],  [2],  [2],  [2]],   // 2222 barre (baseFret=2)
        D7:     [0, [2],  [2],  [2],  [3]],   // 2223
        Dmaj7:  [0, [2],  [2],  [2],  [4]],   // 2224
        Dm7:    [0, [2],  [2],  [1],  [3]],   // 2213  A D F C = Dm7
        Dsus2:  [0, [2],  [2],  [0],  [0]],   // 2200  A D E A = Dsus2
        Dsus4:  [0, [2],  [2],  [3],  [0]],   // 2230  A D G A = Dsus4
        Ddim:   [0, [1],  [2],  [1],  [-1]],  // 121x  G# D F = Ddim
        Daug:   [0, [3],  [2],  [2],  [-1]],  // 322x  Bb D F# = Daug

        // ── Eb / D# ────────────────────────────────────────────────────────
        Eb:     [0, [3],  [3],  [3],  [1]],   // 3331  Bb Eb G Bb = Eb
        Ebm:    [0, [3],  [3],  [2],  [1]],   // 3321  Bb Eb Gb Bb = Ebm
        Eb7:    [0, [3],  [3],  [3],  [4]],   // 3334  Bb Eb G Db = Eb7
        Ebmaj7: [0, [3],  [3],  [3],  [2]],   // 3332  Bb Eb G B = Ebmaj7
        Ebm7:   [0, [3],  [3],  [2],  [4]],   // 3324  Bb Eb Gb Db = Ebm7
        Ebsus2: [0, [3],  [3],  [1],  [1]],   // 3311  Bb Eb F Bb = Ebsus2
        Ebsus4: [0, [3],  [3],  [4],  [1]],   // 3341  Bb Eb Ab Bb = Ebsus4
        Ebdim:  [0, [3],  [1],  [0],  [1]],   // 3101  Bb Db E Bb = Ebdim

        // ── E ──────────────────────────────────────────────────────────────
        E:      [0, [4],  [4],  [4],  [2]],   // 4442
        Em:     [0, [0],  [4],  [3],  [2]],   // 0432
        E7:     [0, [1],  [2],  [0],  [2]],   // 1202  G# D E B = E7
        Emaj7:  [0, [1],  [3],  [0],  [2]],   // 1302  G# Eb E B = Emaj7
        Em7:    [0, [0],  [2],  [0],  [2]],   // 0202  G D E B = Em7
        Esus2:  [0, [4],  [4],  [2],  [2]],   // 4422  B E F# B = Esus2
        Esus4:  [0, [2],  [4],  [0],  [2]],   // 2402  A E E B — approximate
        Edim:   [0, [3],  [4],  [3],  [-1]],  // 343x  Bb E G = Edim (Bb=A#, close enharmonic)
        Eaug:   [0, [4],  [3],  [0],  [3]],   // 4303  B Eb E C = Eaug approx

        // ── F ──────────────────────────────────────────────────────────────
        F:      [0, [2],  [0],  [1],  [0]],   // 2010
        Fm:     [0, [1],  [0],  [1],  [3]],   // 1013
        F6:     [0, [2],  [2],  [1],  [3]],   // 2213  A D F C = F6 (= Dm7)
        F7:     [0, [2],  [3],  [1],  [3]],   // 2313  A Eb F C = F7
        Fmaj7:  [0, [2],  [4],  [1],  [3]],   // 2413  A E F C = Fmaj7
        Fm7:    [0, [1],  [3],  [1],  [3]],   // 1313  Ab Eb F C = Fm7
        Fsus2:  [0, [0],  [0],  [1],  [3]],   // 0013  G C F C = Fsus2 (= Csus4)
        Fsus4:  [0, [0],  [0],  [1],  [1]],   // 0011  G C F Bb = Fsus4
        Fdim:   [0, [2],  [4],  [0],  [1]],   // 2401  A E E Bb ≈ Fdim approx
        Faug:   [0, [2],  [1],  [1],  [3]],   // 2113  A C# F C = Faug approx

        // ── F# / Gb ────────────────────────────────────────────────────────
        "F#":     [0, [3],  [1],  [2],  [1]],  // 3121  Bb C# F# Bb = F#
        "F#m":    [0, [2],  [1],  [2],  [0]],  // 2120  A C# F# A = F#m
        "F#7":    [0, [3],  [1],  [0],  [2]],  // 3102  Bb C# E B = F#7
        "F#maj7": [0, [3],  [1],  [1],  [1]],  // 3111  Bb C# F Bb = F#maj7 (≈Bbm)
        "F#m7":   [0, [2],  [4],  [2],  [0]],  // 2420  A E F# A = F#m7
        "F#sus2": [0, [1],  [1],  [2],  [4]],  // 1124 = same as C#sus4 shape
        "F#sus4": [0, [3],  [4],  [2],  [2]],  // 3422  Bb E F# B = F#sus4

        // ── G ──────────────────────────────────────────────────────────────
        G:      [0, [0],  [2],  [3],  [2]],   // 0232
        Gm:     [0, [0],  [2],  [3],  [1]],   // 0231
        G6:     [0, [0],  [2],  [0],  [2]],   // 0202  G D E B = G6 (= Em7)
        G7:     [0, [0],  [2],  [1],  [2]],   // 0212
        Gmaj7:  [0, [0],  [2],  [2],  [2]],   // 0222
        Gm7:    [0, [0],  [2],  [1],  [1]],   // 0211
        Gsus2:  [0, [0],  [2],  [3],  [0]],   // 0230  G D G A = Gsus2
        Gsus4:  [0, [0],  [2],  [3],  [3]],   // 0233  G D G C = Gsus4
        Gdim:   [0, [0],  [1],  [3],  [1]],   // 0131  G Db G Bb = Gdim
        Gaug:   [0, [0],  [3],  [3],  [2]],   // 0332  G Eb G B = Gaug

        // ── G# / Ab ────────────────────────────────────────────────────────
        "G#":     [1, [1],  [3],  [4],  [3]],  // 1343 baseFret=1  Ab Eb Ab C = G#
        "G#m":    [0, [1],  [3],  [4],  [2]],  // 1342  Ab Eb Ab B = G#m
        "G#7":    [0, [1],  [3],  [2],  [3]],  // 1323  Ab Eb F# C = G#7
        "G#maj7": [0, [1],  [3],  [3],  [3]],  // 1333  Ab Eb G C = Abmaj7
        "G#m7":   [0, [1],  [3],  [2],  [2]],  // 1322  Ab Eb F# B = G#m7
        "G#sus2": [0, [1],  [3],  [4],  [1]],  // 1341  Ab Eb Ab Bb = G#sus2
        "G#sus4": [0, [1],  [1],  [4],  [1]],  // 1141  Ab C# Ab Bb — approximate

        // ── A ──────────────────────────────────────────────────────────────
        A:      [0, [2],  [1],  [0],  [0]],   // 2100
        Am:     [0, [2],  [0],  [0],  [0]],   // 2000
        A6:     [0, [2],  [1],  [2],  [0]],   // 2120  A C# F# A = A6 (no E, common voicing)
        A7:     [0, [0],  [1],  [0],  [0]],   // 0100  G C# E A = A7
        Amaj7:  [0, [1],  [1],  [0],  [0]],   // 1100
        Am7:    [0, [0],  [0],  [0],  [0]],   // 0000  G C E A = Am7 (= C6)
        Asus2:  [0, [2],  [4],  [4],  [2]],   // 2442  A E Ab B — approximate Asus2
        Asus4:  [0, [2],  [2],  [0],  [0]],   // 2200  A D E A = Asus4
        Adim:   [0, [2],  [3],  [3],  [-1]],  // 233x  A Eb G = Adim
        Aaug:   [0, [2],  [1],  [1],  [0]],   // 2110  A C# F A = Aaug

        // ── Bb / A# ────────────────────────────────────────────────────────
        Bb:     [0, [3],  [2],  [1],  [1]],   // 3211
        Bbm:    [0, [3],  [1],  [1],  [1]],   // 3111
        Bb6:    [0, [0],  [2],  [1],  [1]],   // 0211  G D F Bb = Bb6
        Bb7:    [0, [1],  [2],  [1],  [1]],   // 1211  Ab D F Bb = Bb7
        Bbmaj7: [0, [3],  [2],  [1],  [0]],   // 3210  Bb D F A = Bbmaj7
        Bbm7:   [0, [1],  [1],  [1],  [1]],   // 1111 barre  Ab Db F Bb = Bbm7
        Bbsus2: [0, [3],  [0],  [1],  [1]],   // 3011  Bb C F Bb = Bbsus2
        Bbsus4: [0, [3],  [3],  [1],  [1]],   // 3311  Bb Eb F Bb = Bbsus4
        Bbdim:  [0, [3],  [1],  [0],  [1]],   // 3101  Bb Db E Bb = Bbdim
        Bbaug:  [0, [3],  [2],  [2],  [1]],   // 3221  Bb D F# Bb = Bbaug

        // ── B ──────────────────────────────────────────────────────────────
        B:      [0, [4],  [3],  [2],  [2]],   // 4322
        Bm:     [0, [4],  [2],  [2],  [2]],   // 4222
        B6:     [0, [4],  [3],  [2],  [4]],   // 4324  B Eb F# C# = B6
        B7:     [0, [2],  [3],  [2],  [2]],   // 2322  A Eb F# B = B7
        Bmaj7:  [0, [3],  [3],  [2],  [2]],   // 3322  Bb Eb F# B = Bmaj7
        Bm7:    [0, [2],  [2],  [2],  [2]],   // 2222 barre  A D F# B = Bm7
        Bsus2:  [0, [4],  [1],  [2],  [2]],   // 4122  B C# F# B = Bsus2
        Bsus4:  [0, [4],  [4],  [2],  [2]],   // 4422  B E F# B = Bsus4
        Bdim:   [1, [4],  [2],  [1],  [2]],   // 4212 baseFret=1  B D F = Bdim
        Baug:   [0, [0],  [3],  [0],  [3]],   // 0303  G Eb E C ≈ Baug approx
    };

    // ── normalise chord name (same rules as script.js) ───────────────────────
    function normalize(name) {
        // strip extension, normalise root
        var m = name.match(/^([A-Ga-g][b#]?)(.*)/);
        if (!m) return name;
        var root = m[1].charAt(0).toUpperCase() + m[1].slice(1);
        var ext  = m[2] || "";
        if (root === "A#")  root = "Bb";
        if (root === "Db")  root = "C#";
        if (root === "Cb")  root = "B";
        if (root === "D#")  root = "Eb";
        if (root === "E#")  root = "F";
        if (root === "Gb")  root = "F#";
        if (root === "Ab")  root = "G#";
        return root + ext;
    }

    // ── draw one chord diagram ────────────────────────────────────────────────
    function render(element, rawName) {
        var chordName = normalize((rawName || "").trim());
        var chord = Chords[chordName];
        if (!chord) return;   // unknown chord — leave element as-is

        var rndID = "uku_" + (element_count++);
        var holder = document.createElement("div");
        holder.id = rndID;
        holder.style.height = CH + "px";
        element.innerHTML = "";
        element.appendChild(holder);

        var paper    = Raphael(rndID, CW, CH);
        var baseFret = chord[0];
        var fretLeft = ML;
        var color    = (window.getComputedStyle(element).color) || "#000";
        var bgColor  = window.getComputedStyle(element).backgroundColor;
        if (!bgColor || bgColor === "transparent" || bgColor === "rgba(0, 0, 0, 0)") {
            bgColor = "#fff";
        }

        // chord name label
        paper.text(fretLeft + FW / 2, MT - 22, chordName)
             .attr({ fill: color, "font-size": "16px" });

        // nut (thick) or top fret line (thin)
        paper.path("M" + fretLeft + " " + MT + "l" + FW + " 0")
             .attr({ stroke: color, "stroke-width": baseFret === 0 ? 3 : 1 });

        // fret position label (when not in open position)
        if (baseFret > 0) {
            paper.text(fretLeft + FW + SS * 0.9, MT + FS * 0.5, baseFret + "fr")
                 .attr({ stroke: color, "font-size": "10px" });
        }

        // horizontal fret lines
        for (var i = 1; i <= FR; i++) {
            paper.path("M" + fretLeft + " " + (MT + i * FS) + "l" + FW + " 0")
                 .attr({ stroke: color, "stroke-width": 0.5 });
        }

        // vertical string lines  (G=left → A=right)
        for (var s = 0; s < STR; s++) {
            paper.path("M" + (fretLeft + s * SS) + " " + MT +
                       "l0 " + (FS * (FR + 0.5)))
                 .attr({ stroke: color });
        }

        // string tuning labels at bottom
        var tuning = ["G", "C", "E", "A"];
        for (var s = 0; s < STR; s++) {
            paper.text(fretLeft + s * SS, MT + FS * (FR + 0.5) + 8, tuning[s])
                 .attr({ fill: color, "font-size": "9px" });
        }

        // note dots (chord[1..4] = strings G, C, E, A)
        for (var s = 0; s < STR; s++) {
            var note   = chord[s + 1];
            var fretNo = note[0];
            var x      = fretLeft + s * SS;

            if (fretNo < 0) {
                // muted
                paper.text(x, MT - 10, "×")
                     .attr({ stroke: color, "font-size": "11px" });
            } else if (fretNo === 0) {
                // open
                paper.circle(x, MT - 10, 4)
                     .attr({ stroke: color, fill: "none" });
            } else {
                // fretted note
                var y = MT + (fretNo - baseFret - 0.5) * FS;
                paper.circle(x, y, NR)
                     .attr({ stroke: color, fill: color });
            }
        }

        element.classList.add("rendered");
    }

    // ── render all un-rendered ukulele tooltip spans ──────────────────────────
    function renderimplicit(scope) {
        var selector = ".jtab-ukulele:not(.rendered)";
        var els = scope
            ? document.querySelectorAll(scope + " " + selector)
            : document.querySelectorAll(selector);
        Array.prototype.forEach.call(els, function (el) {
            render(el, el.textContent);
        });
    }

    return { Chords: Chords, render: render, renderimplicit: renderimplicit };
}());
