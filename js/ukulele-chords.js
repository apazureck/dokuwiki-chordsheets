/**
 * Ukulele chord diagrams for the DokuWiki chordsheets plugin.
 *
 * Based on the ukulele renderer contributed by Boris Juraga in PR #8
 * (commit 11d49f417cfdc69142605337500f963d3afa82e1), adapted for a
 * single, immutable public API and defensive DOM handling.
 *
 * Copyright (C) 2026 Boris Juraga and dokuwiki-chordsheets contributors
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
(function (root) {
    "use strict";

    var STRING_SPACING = 16;
    var FRET_SPACING = 16;
    var STRING_COUNT = 4;
    var FRET_COUNT = 4;
    var MARGIN_TOP = 36;
    var MARGIN_LEFT = 16;
    var MARGIN_RIGHT = 18;
    var MARGIN_BOTTOM = 16;
    var NOTE_RADIUS = 7;
    var FRETBOARD_WIDTH = STRING_SPACING * (STRING_COUNT - 1);
    var CANVAS_WIDTH =
        MARGIN_LEFT + FRETBOARD_WIDTH + STRING_SPACING + MARGIN_RIGHT;
    var CANVAS_HEIGHT =
        MARGIN_TOP +
        FRET_SPACING * (FRET_COUNT + 0.5) +
        MARGIN_BOTTOM;
    var TUNING = Object.freeze(["G", "C", "E", "A"]);
    var elementCount = 0;

    /*
     * Shape format: base fret followed by the absolute G-C-E-A frets.
     * -1 denotes a muted string and 0 an open string.
     *
     * The original contribution's explicitly approximate shapes were omitted:
     * it is safer to leave an unsupported chord untouched than draw a wrong one.
     */
    var SHAPES = {
        C: "0:0,0,0,3",
        Cm: "0:0,3,3,3",
        C6: "0:0,0,0,0",
        C7: "0:0,0,0,1",
        Cmaj7: "0:0,0,0,2",
        Cm7: "0:3,3,3,3",
        Csus2: "0:0,2,3,3",
        Csus4: "0:0,0,1,3",
        Cdim: "0:-1,3,2,3",
        Caug: "0:1,0,0,3",

        "C#": "0:1,1,1,4",
        "C#m": "0:1,4,4,4",
        "C#7": "0:1,1,1,2",
        "C#maj7": "0:1,1,1,3",
        "C#m7": "0:4,4,4,4",
        "C#sus2": "0:1,3,4,4",
        "C#sus4": "0:1,1,2,4",

        D: "0:2,2,2,0",
        Dm: "0:2,2,1,0",
        D6: "2:2,2,2,2",
        D7: "0:2,2,2,3",
        Dmaj7: "0:2,2,2,4",
        Dm7: "0:2,2,1,3",
        Dsus2: "0:2,2,0,0",
        Dsus4: "0:2,2,3,0",
        Ddim: "0:1,2,1,-1",
        Daug: "0:3,2,2,-1",

        Eb: "0:3,3,3,1",
        Ebm: "0:3,3,2,1",
        Eb7: "0:3,3,3,4",
        Ebmaj7: "0:3,3,3,2",
        Ebm7: "0:3,3,2,4",
        Ebsus2: "0:3,3,1,1",
        Ebsus4: "0:3,3,4,1",

        E: "0:4,4,4,2",
        Em: "0:0,4,3,2",
        E7: "0:1,2,0,2",
        Emaj7: "0:1,3,0,2",
        Em7: "0:0,2,0,2",
        Esus2: "0:4,4,2,2",
        Esus4: "0:2,4,0,2",
        Edim: "0:3,4,3,-1",

        F: "0:2,0,1,0",
        Fm: "0:1,0,1,3",
        F6: "0:2,2,1,3",
        F7: "0:2,3,1,3",
        Fmaj7: "0:2,4,1,3",
        Fm7: "0:1,3,1,3",
        Fsus2: "0:0,0,1,3",
        Fsus4: "0:0,0,1,1",

        "F#": "0:3,1,2,1",
        "F#m": "0:2,1,2,0",
        "F#maj7": "0:3,1,1,1",
        "F#m7": "0:2,4,2,0",
        "F#sus2": "0:1,1,2,4",
        "F#sus4": "0:3,4,2,2",

        G: "0:0,2,3,2",
        Gm: "0:0,2,3,1",
        G6: "0:0,2,0,2",
        G7: "0:0,2,1,2",
        Gmaj7: "0:0,2,2,2",
        Gm7: "0:0,2,1,1",
        Gsus2: "0:0,2,3,0",
        Gsus4: "0:0,2,3,3",
        Gdim: "0:0,1,3,1",
        Gaug: "0:0,3,3,2",

        "G#": "1:1,3,4,3",
        "G#m": "0:1,3,4,2",
        "G#7": "0:1,3,2,3",
        "G#maj7": "0:1,3,3,3",
        "G#m7": "0:1,3,2,2",
        "G#sus2": "0:1,3,4,1",

        A: "0:2,1,0,0",
        Am: "0:2,0,0,0",
        A6: "0:2,1,2,0",
        A7: "0:0,1,0,0",
        Amaj7: "0:1,1,0,0",
        Am7: "0:0,0,0,0",
        Asus4: "0:2,2,0,0",
        Adim: "0:2,3,3,-1",
        Aaug: "0:2,1,1,0",

        Bb: "0:3,2,1,1",
        Bbm: "0:3,1,1,1",
        Bb6: "0:0,2,1,1",
        Bb7: "0:1,2,1,1",
        Bbmaj7: "0:3,2,1,0",
        Bbm7: "0:1,1,1,1",
        Bbsus2: "0:3,0,1,1",
        Bbsus4: "0:3,3,1,1",
        Bbdim: "0:3,1,0,1",
        Bbaug: "0:3,2,2,1",

        B: "0:4,3,2,2",
        Bm: "0:4,2,2,2",
        B6: "0:4,3,2,4",
        B7: "0:2,3,2,2",
        Bmaj7: "0:3,3,2,2",
        Bm7: "0:2,2,2,2",
        Bsus2: "0:4,1,2,2",
        Bsus4: "0:4,4,2,2",
        Bdim: "1:4,2,1,2"
    };

    function normalize(name) {
        var match = String(name || "").trim().match(/^([A-Ga-g][b#]?)(.*)$/);
        var aliases = {
            "A#": "Bb",
            Db: "C#",
            Cb: "B",
            "D#": "Eb",
            "E#": "F",
            Gb: "F#",
            Ab: "G#"
        };
        var root;

        if (!match) {
            return "";
        }

        root =
            match[1].charAt(0).toUpperCase() +
            match[1].slice(1).toLowerCase();
        return (aliases[root] || root) + match[2];
    }

    function parseShape(name) {
        var shape = SHAPES[name];
        var parts;

        if (!shape) {
            return null;
        }

        parts = shape.split(":");
        return {
            name: name,
            baseFret: Number(parts[0]),
            tuning: "GCEA",
            frets: parts[1].split(",").map(Number)
        };
    }

    function getChord(rawName) {
        var chord = parseShape(normalize(rawName));

        if (!chord) {
            return null;
        }

        return Object.freeze({
            name: chord.name,
            baseFret: chord.baseFret,
            tuning: chord.tuning,
            frets: Object.freeze(chord.frets.slice())
        });
    }

    function drawable(element) {
        return Boolean(
            element &&
            typeof element.appendChild === "function" &&
            element.classList &&
            typeof element.classList.add === "function"
        );
    }

    function render(element, rawName) {
        var chord = getChord(rawName);
        var holder;
        var paper;
        var color;
        var stringIndex;
        var fretIndex;

        if (!chord || !drawable(element) || typeof root.Raphael !== "function") {
            return false;
        }

        holder = root.document.createElement("div");
        holder.id = "uku_" + elementCount;
        elementCount += 1;
        holder.style.height = CANVAS_HEIGHT + "px";

        element.innerHTML = "";
        element.appendChild(holder);

        paper = root.Raphael(holder.id, CANVAS_WIDTH, CANVAS_HEIGHT);
        color =
            typeof root.getComputedStyle === "function"
                ? root.getComputedStyle(element).color || "#000"
                : "#000";

        paper
            .text(
                MARGIN_LEFT + FRETBOARD_WIDTH / 2,
                MARGIN_TOP - 22,
                chord.name
            )
            .attr({ fill: color, "font-size": "16px" });
        paper
            .path(
                "M" +
                    MARGIN_LEFT +
                    " " +
                    MARGIN_TOP +
                    "l" +
                    FRETBOARD_WIDTH +
                    " 0"
            )
            .attr({
                stroke: color,
                "stroke-width": chord.baseFret === 0 ? 3 : 1
            });

        if (chord.baseFret > 0) {
            paper
                .text(
                    MARGIN_LEFT + FRETBOARD_WIDTH + STRING_SPACING * 0.9,
                    MARGIN_TOP + FRET_SPACING * 0.5,
                    chord.baseFret + "fr"
                )
                .attr({ fill: color, "font-size": "10px" });
        }

        for (fretIndex = 1; fretIndex <= FRET_COUNT; fretIndex += 1) {
            paper
                .path(
                    "M" +
                        MARGIN_LEFT +
                        " " +
                        (MARGIN_TOP + fretIndex * FRET_SPACING) +
                        "l" +
                        FRETBOARD_WIDTH +
                        " 0"
                )
                .attr({ stroke: color, "stroke-width": 0.5 });
        }

        for (
            stringIndex = 0;
            stringIndex < STRING_COUNT;
            stringIndex += 1
        ) {
            drawString(paper, color, stringIndex);
            drawNote(paper, color, chord, stringIndex);
        }

        element.classList.add("rendered");
        return true;
    }

    function drawString(paper, color, stringIndex) {
        var x = MARGIN_LEFT + stringIndex * STRING_SPACING;

        paper
            .path(
                "M" +
                    x +
                    " " +
                    MARGIN_TOP +
                    "l0 " +
                    FRET_SPACING * (FRET_COUNT + 0.5)
            )
            .attr({ stroke: color });
        paper
            .text(
                x,
                MARGIN_TOP + FRET_SPACING * (FRET_COUNT + 0.5) + 8,
                TUNING[stringIndex]
            )
            .attr({ fill: color, "font-size": "9px" });
    }

    function drawNote(paper, color, chord, stringIndex) {
        var fret = chord.frets[stringIndex];
        var x = MARGIN_LEFT + stringIndex * STRING_SPACING;
        var y;

        if (fret < 0) {
            paper
                .text(x, MARGIN_TOP - 10, "\u00d7")
                .attr({ fill: color, "font-size": "11px" });
            return;
        }

        if (fret === 0) {
            paper
                .circle(x, MARGIN_TOP - 10, 4)
                .attr({ stroke: color, fill: "none" });
            return;
        }

        y =
            MARGIN_TOP +
            (fret - chord.baseFret + 0.5) * FRET_SPACING;
        paper
            .circle(x, y, NOTE_RADIUS)
            .attr({ stroke: color, fill: color });
    }

    function renderimplicit(scope) {
        var container =
            scope && typeof scope.querySelectorAll === "function"
                ? scope
                : root.document;
        var elements;
        var renderedCount = 0;

        if (!container || typeof container.querySelectorAll !== "function") {
            return renderedCount;
        }

        elements = container.querySelectorAll(
            ".jtab-ukulele:not(.rendered)"
        );
        Array.prototype.forEach.call(elements, function (element) {
            if (render(element, element.textContent)) {
                renderedCount += 1;
            }
        });
        return renderedCount;
    }

    root.ukulele = Object.freeze({
        getChord: getChord,
        render: render,
        renderimplicit: renderimplicit
    });
}(typeof globalThis !== "undefined" ? globalThis : this));
