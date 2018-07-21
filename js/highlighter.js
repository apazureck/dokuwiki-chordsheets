var songBlockSelector = 'song-with-chords';
var songTitleSelector = 'song-title';
var songComposerSelector = 'song-composer';
var songChordSelector = 'song-chord';
var songChordLineSelector = 'song-chords';

function Singer(song, transpose) {
    transpose = transpose || 0;
    "use strict";

    var notChordsFilter = (/[I-Z]|[А-Я]|[а-я]|c|[e-h]|k|l|[n-r]|t|[v-z]|'|\.|\?|!|:|;|\-/g);
    var coloredSong = "";

    this.init = function () {
        addClass(song, transpose);
        displayColoredSong(coloredSong);
    };

    function addClass(song, transpose) {
        var text = song.innerHTML;
        var lines = text.split(/\n/g);

        if (song.classList.contains('song-has-title')) {
            findTitle(lines);
        }
        if (song.classList.contains('song-has-composer')) {
            findComposer(lines);
        }

        try {
            transpose = Number(transpose);   
        } catch (error) {
            transpose = 0;
        }
        findChords(lines, transpose);

        coloredSong = lines.join("\n");
    }

    function findTitle(lines) {
        if (lines[0].match(notChordsFilter) !== null) {
            lines[0] = "<span class='" + songTitleSelector + "'>" + lines[0] + "</span>";
        }
    }

    function findComposer(lines) {
        if (lines[1] !== "" && lines[0].search(songTitleSelector) !== -1) {
            lines[1] = "<span class='" + songComposerSelector + "'>" + lines[1] + "</span>";
        }
    }

    function findChords(lines, transpose) {
        for (var i = 0; i < lines.length; i++) {
            var ln = parseLine(lines[i], transpose);
            lines[i] = ln.text;
            if (ln.isChord) {

                var singleChords = lines[i].split(" ");
                for (var i2 = 0; i2 < singleChords.length; i2++) {
                    if (singleChords[i2]) {
                        singleChords[i2] = '<span class="' + songChordSelector + '">' + singleChords[i2] + '</span>';
                    }
                }

                lines[i] = singleChords.join(" ");
                lines[i] = "<span class='" + songChordLineSelector + "'>" + lines[i] + "</span>";
            }
        }
    }

    function displayColoredSong(coloredSong) {
        song.innerHTML = coloredSong;
    }
}

function runSongHighlighter() {
    var songs = document.querySelectorAll('.' + songBlockSelector);
    for (var i = 0; i < songs.length; i++) {
        var transpose = songs[i].dataset.transpose;
        var singer = new Singer(songs[i], transpose);
        singer.init();
    }
};

function parseLine(lineText, transpose) {

    var isChord = false;

    var chordRegEx = new RegExp("[a-g]{1}[b#]?(no|add|sus|dim|maj|min|m|13|11|9|7|6|5|4|3|2)*", "i");
    var chordRootRegEx = new RegExp("[a-g]{1}[b#]?", "i");

    var chordRep = lineText.replace(/[a-g]{1}[b#]?(no|add|sus|dim|maj|min|m|13|11|9|7|6|5|4|3|2)*/gi, "");
    var hasText = /[a-z]/i;
    if (hasText.test(chordRep) == false)
        isChord = true;

    if (isChord) {
        var words = lineText.split(/[\s//]+/);
        var ltmp = lineText;
        for (var i = 0; i < words.length; i++) {
            var chordMatch = chordRegEx.exec(words[i]);
            if (chordMatch != null) {
                var chordRootMatch = chordRootRegEx.exec(words[i]);
                var newChord = substChord(chordRootMatch[0], transpose);
                newChord = chordMatch[0].replace(chordRootMatch[0], newChord);
                var wIndex = ltmp.indexOf(chordMatch[0]);
                ltmp = ltmp.substr(wIndex + chordMatch[0].length);
                var start = lineText.substr(0, lineText.length - ltmp.length);
                lineText = start.substr(0, start.length - chordMatch[0].length) + newChord + ltmp;
            }
        }
    }

    return {
        'isChord': isChord,
        'text': lineText
    };
}

function substChord(chord, transp) {
    chord = normalizeChord(chord);	
    var notes = ["A", "Bb", "B", "C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#"];

    var x = notes.indexOf(chord);
    x = (x + transp) % 12;
    if (x < 0) x += 12;
    return notes[x];
}

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