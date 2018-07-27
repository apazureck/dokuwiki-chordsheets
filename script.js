function ready() {
    "use strict";
    runSongHighlighter();
}

var songBlockSelector = "song-with-chords";
var songChordSelector = "song-chord";
var songSectionSelector = "song-section";
var songSectionHeadingSelector = "song-section-heading";
var chordLineSelector = "song-chordLine";
var songTextLineSelector = "song-textLine";

function parseSong(song, transpose) {
    "use strict";
    transpose = transpose || 0;

    var coloredSong = "";
    var currentSection = "";

    function run() {
        addClass(song, transpose);
        displayColoredSong(coloredSong);
    }

    function addClass(song, transpose) {
        var text = song.innerHTML;
        var lines = text.split(/\n/g);

        try {
            transpose = Number(transpose);
        } catch (error) {
            transpose = 0;
        }
        findChords(lines, transpose);

        coloredSong = lines.join("\n");
    };

    function findChords(lines, transpose) {
        for (var i = 0; i < lines.length; i++) {
            var ln = parseLine(lines[i], transpose);
            lines[i] = ln.text;
        }
        if (currentSection != "") {
            lines.push("</div>");
        }
    };

    function displayColoredSong(coloredSong) {
        song.innerHTML = coloredSong;
    };

    function parseLine(lineText, transpose) {

        var isChord = false;
        var isSection = false;

        var chordRegEx = new RegExp("(\\s*)([a-g]{1}[b#]?(?:no|add|sus|dim|maj|min|m|13|11|9|7|6|5|4|3|2)*(?:\\s*\\/\\s*[a-g]{1}[b#]?)?)", "iy");

        var sectionRegex = new RegExp("^\\s*(\\[(.+)\\])", "i");

        var chordRep = lineText.replace(new RegExp("[a-g]{1}[b#]?(no|add|sus|dim|maj|min|m|13|11|9|7|6|5|4|3|2)*", "gi"), "");
        var hasText = new RegExp("[a-z]", "i");
        if (hasText.test(chordRep) == false)
            isChord = true;

        if (isChord) {
            var newLine = "";
            var chordMatch;
            while ((chordMatch = chordRegEx.exec(lineText)) != null) {
                var subchords = chordMatch[2].split("/");

                for (var i2 = 0; i2 < subchords.length; i2++) {
                    var chordRootRegEx = new RegExp("([a-g]{1}[b#]?)(.*)","i");
                    var chordRootMatch = chordRootRegEx.exec(subchords[i2]);
                    var transposed = substChord(chordRootMatch[1], transpose);
                    subchords[i2] = transposed + chordRootMatch[2] || "";
                }
                var newChord = subchords.join("/");
                newLine += chordMatch[0].replace(chordMatch[2], '<span class="' + songChordSelector + '">' + newChord + '</span>');
            }
            lineText = '<p class="' + chordLineSelector + '">' + newLine + '</p>';
        }
        else if (sectionRegex.test(lineText)) {
            var match = sectionRegex.exec(lineText);
            var sectionText = "";
            if (currentSection != "") {
                sectionText += "</div>\n"
            }
            currentSection = match[2].toLowerCase();
            sectionText += '<div class="' + songSectionSelector + ' ' + currentSection + '">\n';
            sectionText += '<h3 class="' + songSectionHeadingSelector + ' ' + currentSection + '">' + match[1] + '</h3>';
            lineText = sectionText;
            isSection = true;
        } else {
            lineText = '<p class="' + songTextLineSelector + '">' + lineText + '</p>';
        }

        return {
            'isChord': isChord,
            'isSection': isSection,
            'text': lineText
        };
    };

    function substChord(chord, transp) {
        chord = normalizeChord(chord);
        var notes = ["A", "Bb", "B", "C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#"];

        var x = notes.indexOf(chord);
        x = (x + transp) % 12;
        if (x < 0) x += 12;
        return notes[x];
    };

    function normalizeChord(chord) {

        chord = chord.charAt(0).toUpperCase() + chord.slice(1);

        if (chord == "A#") chord = "Bb";
        else if (chord == "Db") chord = "C#";
        else if (chord == "Cb") chord = "B";
        else if (chord == "D#") chord = "Eb";
        else if (chord == "E#") chord = "F";
        else if (chord == "Gb") chord = "F#";
        else if (chord == "Ab") chord = "G#";
        return chord;
    }

    run();
}

function runSongHighlighter() {
    var songs = document.querySelectorAll('.' + songBlockSelector);
    for (var i = 0; i < songs.length; i++) {
        var transpose = songs[i].dataset.transpose;
        parseSong(songs[i], transpose);
    }
};

document.addEventListener("DOMContentLoaded", ready);