/* DOKUWIKI:include_once js/raphael.js */
/* DOKUWIKI:include_once js/jtab.min.js */

function ready() {
    "use strict";
    runSongHighlighter();
    jtab.renderimplicit(null);
}

var songBlockSelector = "song-with-chords";
var songChordSelector = "song-chord";
var songSectionSelector = "song-section";
var songSectionHeadingSelector = "song-section-heading";
var chordLineSelector = "song-chordLine";
var songTextLineSelector = "song-textLine";

function parseSong(songText, transpose, showToolTips) {
    "use strict";
    transpose = transpose || 0;

    var currentSection = "";

    function parseText(text, transpose, showToolTips) {
        var lines = text.split(/\n/g);

        try {
            transpose = Number(transpose);
        } catch (error) {
            transpose = 0;
        }
        findChords(lines, transpose, showToolTips);
        return lines.join("\n");
    }

    function findChords(lines, transpose, showToolTips) {
        for (var i = 0; i < lines.length; i++) {
            var ln = parseLine(lines[i], transpose, showToolTips);
            lines[i] = ln.text;
        }
        if (currentSection != "") {
            lines.push("</div>");
        }
    };

    function parseLine(lineText, transpose, addTooltip) {
        addTooltip = addTooltip || true;
        /* ignore empty lines, will be controlled by paragraphs */
        if (isNullOrWhiteSpace(lineText)) {
            return {
                'isChord': false,
                'isSection': false,
                'text': ""
            };
        }

        var isChord = false;
        var isSection = false;

        var chordRegEx = /(?:(\s*)([a-g]{1}[b#]?(?:no|add|sus|dim|maj|min|m|13|11|9|7|6|5|4|3|2)*(?:\s*\/\s*[a-g]{1}[b#]?)?)|\s*(\().*\))/iy;

        var sectionRegex = new RegExp("^\\s*(\\[(.+)\\])", "i");

        var chordRep = lineText.replace(new RegExp("[a-g]{1}[b#]?(no|add|sus|dim|maj|min|m|13|11|9|7|6|5|4|3|2)*", "gi"), "");
        var hasTextRegExp = new RegExp("[a-z](?![^\\(]*\\))", "i");
        var isChord = hasTextRegExp.test(chordRep) == false;

        if (isChord) {
            var newLine = "";
            var chordMatch;

            while ((chordMatch = chordRegEx.exec(lineText)) != null) {
                if (chordMatch[3] === "(") {
                    newLine += '<span style="color:black;">' + chordMatch[0] + '</span>';
                    continue;
                }
                try {
                    var subchords = chordMatch[2].split("/");
                } catch (error) {
                    var i = 0;
                }

                for (var i2 = 0; i2 < subchords.length; i2++) {
                    var chordRootRegEx = new RegExp("([a-g]{1}[b#]?)(.*)", "i");
                    var chordRootMatch = chordRootRegEx.exec(subchords[i2]);
                    var transposed = substChord(chordRootMatch[1], transpose);
                    subchords[i2] = transposed + chordRootMatch[2] || "";
                }
                var newChord = subchords.join("/");
                if (addTooltip)
                    newLine += chordMatch[0].replace(chordMatch[2], '<span class="' + songChordSelector + ' tooltip">' + newChord + '<span class="tooltiptext jtab">' + subchords[0] + '</span></span>');
                else
                    newLine += chordMatch[0].replace(chordMatch[2], '<span class="' + songChordSelector + '">' + newChord + '</span>');
            }
            lineText = '<p style="white-space: pre;color: #d73a49;font-family: \'Courier New\', Courier, monospace;margin:0;" class="' + chordLineSelector + '">' + newLine + '</p>';
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
            lineText = '<p style="white-space: pre;font-family: \'Courier New\', Courier, monospace;margin:0;" class="' + songTextLineSelector + '">' + lineText + '</p>';
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

    function isNullOrWhiteSpace(str) {
        return str == null || str.replace(/\s/g, '').length < 1;
    }

    return parseText(songText, transpose, showToolTips);
}

function runSongHighlighter() {
    var songs = document.querySelectorAll('.' + songBlockSelector);
    for (var i = 0; i < songs.length; i++) {
        var transpose = songs[i].dataset.transpose;
        songs[i].rawText = songs[i].innerHTML;
        songs[i].innerHTML = parseSong(songs[i].rawText, transpose);
    }
};

function cSheetExportToWord(id) {
    var song = document.getElementById(id);

    function copy() {
        try {
            // Now that we've selected the anchor text, execute the copy command  
            var successful = document.execCommand('copy');
            var msg = successful ? 'successfully' : 'unsuccessfully';
            alert(msg + " copied song to clipboard. Use CTRL + V to paste it in your word document.");
        } catch (err) {
            alert('Oops, unable to copy');
        }
    }

    if (song.rawText) {
        var node = document.createElement("div");
        node.innerHTML = parseSong(song.rawText, song.dataset.transpose, false);
        song.appendChild(node);
        var range = document.createRange();
        range.selectNode(node);
        window.getSelection().addRange(range);
        copy();
        song.removeChild(node);
    } else {
        var range = document.createRange();
        range.selectNode(song);
        window.getSelection().addRange(range);
        copy();
    }

    // Remove the selections - NOTE: Should use
    // removeRange(range) when it is supported  
    window.getSelection().removeAllRanges();
}

document.addEventListener("DOMContentLoaded", ready);