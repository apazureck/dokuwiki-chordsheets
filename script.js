/* DOKUWIKI:include_once js/raphael.js */
/* DOKUWIKI:include_once js/jtab.min.js */
/* DOKUWIKI:include_once js/ukulele-chords.js */
/* DOKUWIKI:include_once js/abcjs-basic.min.js */

function ready() {
    "use strict";
    initializeChordSheets(document);
    initializeChordSheetColorSettings(document);
}

var songBlockSelector = "song-with-chords";
var songChordSelector = "song-chord";
var songSectionSelector = "song-section";
var songSectionHeadingSelector = "song-section-heading";
var chordLineSelector = "song-chordLine";
var songTextLineSelector = "song-textLine";

function calculateChordTooltipPosition(chordRect, tooltipRect, viewport, options) {
    "use strict";
    options = options || {};

    var gap = options.gap || 8;
    var gutter = options.gutter || 8;
    var preferredTop = chordRect.top - tooltipRect.height - gap;
    var placement = preferredTop < gutter ? "bottom" : "top";
    var top = placement === "bottom" ? chordRect.bottom + gap : preferredTop;
    var centeredLeft = chordRect.left + (chordRect.width / 2) - (tooltipRect.width / 2);
    var maximumLeft = Math.max(gutter, viewport.width - tooltipRect.width - gutter);
    var maximumTop = Math.max(gutter, viewport.height - tooltipRect.height - gutter);
    var left = Math.min(Math.max(centeredLeft, gutter), maximumLeft);
    var chordCenter = chordRect.left + (chordRect.width / 2);
    var arrowLeft = Math.min(Math.max(chordCenter - left, 0), tooltipRect.width);

    return {
        left: left,
        top: Math.min(Math.max(top, gutter), maximumTop),
        placement: placement,
        arrowLeft: arrowLeft
    };
}

function positionChordTooltip(chord) {
    "use strict";
    var tooltip = chord.querySelector(".tooltiptext");
    if (!tooltip) {
        return;
    }

    var position = calculateChordTooltipPosition(
        chord.getBoundingClientRect(),
        tooltip.getBoundingClientRect(),
        {
            width: document.documentElement.clientWidth,
            height: document.documentElement.clientHeight
        }
    );

    tooltip.style.left = position.left + "px";
    tooltip.style.top = position.top + "px";
    if (tooltip.style.setProperty) {
        tooltip.style.setProperty("--cs-tooltip-arrow-left", position.arrowLeft + "px");
    }
    if (tooltip.dataset) {
        tooltip.dataset.placement = position.placement;
    } else {
        tooltip.setAttribute("data-placement", position.placement);
    }
}

var chordTooltipWindowListenersBound = false;

function getScopedElements(scope, selector) {
    "use strict";
    var root = scope || document;
    var elements = [];
    var matches = root.matches || root.msMatchesSelector || root.webkitMatchesSelector;
    var found;
    var i;

    if (scope && matches && matches.call(root, selector)) {
        elements.push(root);
    }
    if (!root.querySelectorAll) {
        return elements;
    }
    found = root.querySelectorAll(selector);
    for (i = 0; i < found.length; i++) {
        elements.push(found[i]);
    }
    return elements;
}

function normalizeChordSheetConfigColor(value) {
    "use strict";
    var color = String(value || "").toLowerCase();
    var shorthand = color.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);

    if (shorthand) {
        return "#" +
            shorthand[1] + shorthand[1] +
            shorthand[2] + shorthand[2] +
            shorthand[3] + shorthand[3];
    }
    return /^#[0-9a-f]{6}$/.test(color) ? color : null;
}

function bindChordSheetColorSetting(input) {
    "use strict";
    if (!input || input._chordSheetColorPickerBound || !input.ownerDocument || !input.parentNode) {
        return false;
    }

    var picker = input.ownerDocument.createElement("input");
    var label = input.labels && input.labels.length ?
        String(input.labels[0].textContent || "").replace(/\s+/g, " ").trim() :
        "Color";
    var initialColor = normalizeChordSheetConfigColor(input.value) || "#000000";

    picker.setAttribute("type", "color");
    picker.setAttribute("class", "chordsheets-color-picker");
    picker.setAttribute("aria-label", "Choose " + label);
    picker.setAttribute("title", "Choose " + label);
    picker.value = initialColor;

    function updateTextInput() {
        input.value = picker.value;
    }

    function updatePicker() {
        var color = normalizeChordSheetConfigColor(input.value);
        if (color) {
            picker.value = color;
        }
    }

    picker.addEventListener("input", updateTextInput);
    picker.addEventListener("change", updateTextInput);
    input.addEventListener("input", updatePicker);
    input.addEventListener("change", updatePicker);

    input.parentNode.insertBefore(picker, input);
    input._chordSheetColorPickerBound = true;
    return true;
}

function initializeChordSheetColorSettings(scope) {
    "use strict";
    var selector = [
        "#config___plugin____chordsheets____chord_color",
        "#config___plugin____chordsheets____lyric_color",
        "#config___plugin____chordsheets____section_color",
        "#config___plugin____chordsheets____section_background"
    ].join(", ");
    var inputs = getScopedElements(scope, selector);
    var initialized = 0;
    var i;

    for (i = 0; i < inputs.length; i++) {
        if (bindChordSheetColorSetting(inputs[i])) {
            initialized++;
        }
    }
    return initialized;

}
function bindChordTooltips(scope) {
    "use strict";
    var chords = getScopedElements(scope, "." + songChordSelector + ".tooltip");

    for (var i = 0; i < chords.length; i++) {
        if (chords[i]._chordSheetTooltipBound) {
            continue;
        }
        chords[i]._chordSheetTooltipBound = true;
        chords[i].addEventListener("mouseenter", function (event) {
            positionChordTooltip(event.currentTarget);
        });
        chords[i].addEventListener("focus", function (event) {
            positionChordTooltip(event.currentTarget);
        });
    }

    function repositionVisibleTooltip() {
        var activeChord = document.querySelector(
            "." + songChordSelector + ".tooltip:hover, ." + songChordSelector + ".tooltip:focus"
        );
        if (activeChord) {
            positionChordTooltip(activeChord);
        }
    }

    if (!chordTooltipWindowListenersBound && typeof window !== "undefined") {
        window.addEventListener("resize", repositionVisibleTooltip);
        window.addEventListener("scroll", repositionVisibleTooltip, true);
        chordTooltipWindowListenersBound = true;
    }
}

function findVoicingTooltip(control) {
    "use strict";
    var current;
    var className;
    if (!control) return null;
    if (control.closest) return control.closest(".tooltiptext");
    current = control.parentNode;
    while (current) {
        if (current.classList && current.classList.contains && current.classList.contains("tooltiptext")) return current;
        className = typeof current.className === "string" ? current.className : "";
        if ((" " + className.replace(/\s+/g, " ") + " ").indexOf(" tooltiptext ") >= 0) return current;
        current = current.parentNode;
    }
    return null;
}

function renderChordDiagram(diagram, token, view, tooltip) {
    "use strict";
    var chordElement = tooltip && tooltip.parentNode;
    if (!diagram || !token || (view !== "fretboard" && view !== "tab")) return false;
    diagram.textContent = token;
    if (diagram.setAttribute) diagram.setAttribute("data-diagram-view", view);
    if (diagram.classList && diagram.classList.remove && diagram.classList.add) {
        diagram.classList.remove("rendered");
        diagram.classList.remove("is-fretboard");
        diagram.classList.remove("is-tab");
        diagram.classList.add(view === "tab" ? "is-tab" : "is-fretboard");
    }
    if (typeof jtab !== "undefined" && jtab.render) jtab.render(diagram, token);
    else if (typeof jtab !== "undefined" && jtab.renderimplicit) jtab.renderimplicit(tooltip);
    if (chordElement && chordElement.getBoundingClientRect) positionChordTooltip(chordElement);
    return true;
}

function selectChordVoicing(control) {
    "use strict";
    var tooltip = findVoicingTooltip(control);
    var diagram = tooltip && tooltip.querySelector ? tooltip.querySelector(".song-diagram") : null;
    var fretboardToken = control.getAttribute ? control.getAttribute("data-voicing-token") : control.value;
    var tabToken = control.getAttribute ? control.getAttribute("data-tab-token") : "";
    var view = diagram && diagram.getAttribute ? diagram.getAttribute("data-diagram-view") : "fretboard";
    var options = tooltip && tooltip.querySelectorAll ? tooltip.querySelectorAll(".voicing-option") : [];
    var activeToken;
    var i;
    if (!diagram || !fretboardToken) return false;
    view = view === "tab" ? "tab" : "fretboard";
    activeToken = view === "tab" && tabToken ? tabToken : fretboardToken;
    for (i = 0; i < options.length; i++) {
        if (options[i].setAttribute) options[i].setAttribute("aria-pressed", options[i] === control ? "true" : "false");
        if (options[i].classList && options[i].classList.add && options[i].classList.remove) {
            if (options[i] === control) options[i].classList.add("is-selected");
            else options[i].classList.remove("is-selected");
        }
    }
    if (diagram.setAttribute) {
        diagram.setAttribute("data-fretboard-token", fretboardToken);
        diagram.setAttribute("data-tab-token", tabToken);
    }
    return renderChordDiagram(diagram, activeToken, view, tooltip);
}

function selectChordDiagramView(control) {
    "use strict";
    var tooltip = findVoicingTooltip(control);
    var view = control && control.getAttribute ? control.getAttribute("data-diagram-view") : "";
    var buttons = tooltip && tooltip.querySelectorAll ? tooltip.querySelectorAll(".voicing-view-option") : [];
    var diagram = tooltip && tooltip.querySelector ? tooltip.querySelector(".song-diagram") : null;
    var tokenAttribute = view === "tab" ? "data-tab-token" : "data-fretboard-token";
    var token = diagram && diagram.getAttribute ? diagram.getAttribute(tokenAttribute) : "";
    var i;
    if (!diagram || !token || (view !== "fretboard" && view !== "tab")) return false;
    for (i = 0; i < buttons.length; i++) {
        if (buttons[i].setAttribute) buttons[i].setAttribute("aria-pressed", buttons[i] === control ? "true" : "false");
    }
    return renderChordDiagram(diagram, token, view, tooltip);
}

function bindChordVoicingSelectors(scope) {
    "use strict";
    var selectors = getScopedElements(scope, ".voicing-option");
    var i;
    var viewSelectors = getScopedElements(scope, ".voicing-view-option");
    for (i = 0; i < selectors.length; i++) {
        if (selectors[i]._chordSheetVoicingBound) continue;
        selectors[i]._chordSheetVoicingBound = true;
        selectors[i].addEventListener("click", function (event) {
            selectChordVoicing(event.currentTarget);
        });
    }
    for (i = 0; i < viewSelectors.length; i++) {
        if (viewSelectors[i]._chordSheetViewBound) continue;
        viewSelectors[i]._chordSheetViewBound = true;
        viewSelectors[i].addEventListener("click", function (event) {
            selectChordDiagramView(event.currentTarget);
        });
    }
}

function escapeChordSheetHtml(value) {
    "use strict";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function normalizeChordNote(note) {
    "use strict";
    var normalized = note.charAt(0).toUpperCase() + note.slice(1);
    var aliases = { "A#": "Bb", "Db": "C#", "Cb": "B", "D#": "Eb", "E#": "F", "Gb": "F#", "Ab": "G#" };
    return aliases[normalized] || normalized;
}

function normalizeTranspose(transpose) {
    "use strict";
    var amount = Number(transpose);
    return isFinite(amount) ? Math.round(amount) : 0;
}

function transposeChordNote(note, transpose) {
    "use strict";
    var notes = ["A", "Bb", "B", "C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#"];
    var index = notes.indexOf(normalizeChordNote(note));
    if (index < 0) return normalizeChordNote(note);
    index = (index + normalizeTranspose(transpose)) % notes.length;
    if (index < 0) index += notes.length;
    return notes[index];
}

function parsePinnedVoicing(value) {
    "use strict";
    var entries = String(value || "").split(",");
    var strings = [];
    var soundingStrings = 0;
    var match;
    var fret;
    var i;
    if (entries.length !== 6) return null;
    for (i = 0; i < entries.length; i++) {
        entries[i] = entries[i].replace(/^\s+|\s+$/g, "");
        if (/^x$/i.test(entries[i])) {
            strings.push({ fret: null, finger: null });
            continue;
        }
        match = /^(\d{1,2})(?:\/([1-4]))?$/.exec(entries[i]);
        if (!match) return null;
        fret = Number(match[1]);
        if (fret > 24 || (fret === 0 && match[2])) return null;
        strings.push({ fret: fret, finger: match[2] ? Number(match[2]) : null });
        soundingStrings++;
    }
    return soundingStrings > 0 ? strings : null;
}

function serializePinnedVoicing(voicing) {
    "use strict";
    var entries = [];
    var i;
    for (i = 0; i < voicing.length; i++) {
        if (voicing[i].fret === null) entries.push("x");
        else entries.push(String(voicing[i].fret) + (voicing[i].finger ? "/" + voicing[i].finger : ""));
    }
    return entries.join(",");
}

function transposePinnedVoicing(voicing, transpose) {
    "use strict";
    var amount = normalizeTranspose(transpose);
    var selectedShift = null;
    var octave;
    var shift;
    var valid;
    var fret;
    var result = [];
    var i;
    if (!voicing) return null;
    for (octave = 0; octave <= 4 && selectedShift === null; octave++) {
        for (shift = octave === 0 ? 0 : -octave; shift <= octave; shift += octave === 0 ? 1 : octave * 2) {
            valid = true;
            for (i = 0; i < voicing.length; i++) {
                if (voicing[i].fret === null) continue;
                fret = voicing[i].fret + amount + (shift * 12);
                if (fret < 0 || fret > 24) {
                    valid = false;
                    break;
                }
            }
            if (valid) {
                selectedShift = amount + (shift * 12);
                break;
            }
            if (octave === 0) break;
        }
    }
    if (selectedShift === null) return null;
    for (i = 0; i < voicing.length; i++) {
        result.push({
            fret: voicing[i].fret === null ? null : voicing[i].fret + selectedShift,
            finger: amount === 0 ? voicing[i].finger : null
        });
    }
    return result;
}

function pinnedVoicingToJtabToken(voicing, chordName) {
    "use strict";
    var entries = [];
    var i;
    for (i = 0; i < voicing.length; i++) {
        if (voicing[i].fret === null) {
            entries.push("X/X");
        } else if (voicing[i].finger) {
            entries.push(String(voicing[i].fret) + "/" + voicing[i].finger);
        } else {
            entries.push(String(voicing[i].fret) + (voicing[i].fret > 0 ? "/" : ""));
        }
    }
    return "%" + entries.join(".%") + "[" + chordName + "]";
}

function parseChordSymbol(symbol) {
    "use strict";
    var voicingMatch = /^(.*?)@\{([^{}]+)\}$/.exec(symbol);
    var chordText = voicingMatch ? voicingMatch[1] : symbol;
    var voicing = voicingMatch ? parsePinnedVoicing(voicingMatch[2]) : null;
    var match = /^([A-Ga-g])([#b]?)([^\/\s]*)(?:\s*\/\s*([A-Ga-g])([#b]?))?$/.exec(chordText);
    var suffixPattern = /^(?:(?:maj|min|dim|aug|sus|add|no|m)?[0-9]*(?:[#b][0-9]+)*(?:(?:sus|add|maj|min|dim|no)[0-9]+|[+#-][0-9]+)*(?:\([#b0-9,+\/-]+\))?|[???][0-9]*)$/;
    if (!match || !suffixPattern.test(match[3]) || (voicingMatch && !voicing)) return null;
    return { root: normalizeChordNote(match[1] + match[2]), suffix: match[3], bass: match[4] ? normalizeChordNote(match[4] + match[5]) : null, voicing: voicing };
}

function transposeChordSymbol(chord, transpose) {
    "use strict";
    return { root: transposeChordNote(chord.root, transpose), suffix: chord.suffix, bass: chord.bass ? transposeChordNote(chord.bass, transpose) : null, voicing: transposePinnedVoicing(chord.voicing, transpose) };
}

function fretPositionFromStrings(strings) {
    "use strict";
    var hasOpenString = false;
    var lowestFret = null;
    var entry;
    var fret;
    var i;
    if (!strings) return null;
    for (i = 0; i < strings.length; i++) {
        entry = strings[i];
        if (entry && typeof entry.fret !== "undefined") fret = entry.fret;
        else if (entry && typeof entry.length !== "undefined") fret = Number(entry[0]);
        else continue;
        if (fret === null || !isFinite(fret) || fret < 0) continue;
        if (fret === 0) hasOpenString = true;
        else if (lowestFret === null || fret < lowestFret) lowestFret = fret;
    }
    if (hasOpenString) return { label: "Open", fret: 0, open: true };
    if (lowestFret !== null) return { label: String(lowestFret), fret: lowestFret, open: false };
    return null;
}

function chordVoicingStrings(token, pinnedVoicing) {
    "use strict";
    var renderedChord;
    if (pinnedVoicing) return pinnedVoicing.slice ? pinnedVoicing.slice(0) : pinnedVoicing;
    if (typeof jtabChord === "undefined") return null;
    try {
        renderedChord = new jtabChord(token);
        if (renderedChord.isValid && renderedChord.chordArray && renderedChord.chordArray.length === 7) {
            return renderedChord.chordArray.slice(1);
        }
    } catch (error) {
        return null;
    }
    return null;
}

function voicingToJtabTabToken(strings) {
    "use strict";
    var entries = [];
    var entry;
    var fret;
    var i;
    if (!strings || strings.length !== 6) return "";
    for (i = 0; i < strings.length; i++) {
        entry = strings[i];
        if (entry && typeof entry.fret !== "undefined") fret = entry.fret;
        else if (entry && typeof entry.length !== "undefined") fret = Number(entry[0]);
        else return "";
        if (fret === null || !isFinite(fret) || fret < 0) entries.push("X");
        else entries.push(String(fret));
    }
    return entries.join(".");
}

function fallbackCagedFretPosition(token) {
    "use strict";
    var match = /^([A-G](?:#|b)?)[^:]*(?::([1-5]))?$/.exec(token);
    var baseNotes = {
        C: [0, 0], "C#": [0, 1], D: [4, 0], Eb: [4, 1], E: [3, 0],
        F: [3, 1], "F#": [3, 2], G: [2, 0], "G#": [2, 1], A: [1, 0], Bb: [1, 1], B: [1, 2]
    };
    var transitions = [3, 2, 3, 2, 2];
    var position;
    var base;
    var shapeIndex;
    var fret;
    var step;
    if (!match) return null;
    base = baseNotes[normalizeChordNote(match[1])];
    if (!base) return null;
    position = Number(match[2] || 1);
    shapeIndex = base[0];
    fret = base[1];
    for (step = 1; step < position; step++) {
        fret += transitions[shapeIndex];
        shapeIndex = (shapeIndex + 1) % transitions.length;
    }
    return fret === 0 ? { label: "Open", fret: 0, open: true } : { label: String(fret), fret: fret, open: false };
}

function chordVoicingFretPosition(token, pinnedVoicing) {
    "use strict";
    var strings = chordVoicingStrings(token, pinnedVoicing);
    var position = fretPositionFromStrings(strings);
    if (position) return position;
    return fallbackCagedFretPosition(token) || { label: "?", fret: null, open: false };
}

function voicingOptionAriaLabel(position, pinned, chordName) {
    "use strict";
    var prefix = pinned ? "Use pinned " : "Use ";
    if (position.open) return prefix + "open-position shape for " + chordName;
    return prefix + "shape at fret " + position.label + " for " + chordName;
}

function chordVoicingOptions(chordName, instrument) {
    "use strict";
    var options = [chordName];
    var position;
    if (instrument === "ukulele") return options;
    for (position = 2; position <= 5; position++) options.push(chordName + ":" + position);
    return options;
}

function chordDiagramViewIcon(view) {
    "use strict";
    var design = view === "tab" ? "horizontal-tab" : "guitar-headstock";
    var drawing = view === "tab"
        ? '<text class="tab-label" x="3.2" y="6.8">T</text><text class="tab-label" x="3.2" y="13.8">A</text><text class="tab-label" x="3.2" y="20.8">B</text>' +
            '<line class="tab-string-line" x1="7" y1="5" x2="22" y2="5"></line><line class="tab-string-line" x1="7" y1="12" x2="22" y2="12"></line>' +
            '<line class="tab-string-line" x1="7" y1="19" x2="22" y2="19"></line>' +
            '<path class="tab-marker" d="M9.5 3.5l3 3m0-3-3 3"></path>' +
            '<path class="tab-marker" d="M13.5 10.5l3 3m0-3-3 3"></path>' +
            '<path class="tab-marker" d="M17.5 17.5l3 3m0-3-3 3"></path>'
        : '<g class="headstock-outline" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M9 22V9L7 5l2-3h6l2 3-2 4v13"></path><path d="M9 9h6M9 14h6M12 4v18M7 6H4M17 6h3M7 11H4M17 11h3"></path></g>' +
            '<g class="headstock-tuners"><circle cx="4" cy="6" r="1.2"></circle><circle cx="20" cy="6" r="1.2"></circle><circle cx="4" cy="11" r="1.2"></circle><circle cx="20" cy="11" r="1.2"></circle></g>';
    return '<svg class="voicing-view-icon" viewBox="0 0 24 24" focusable="false" aria-hidden="true" data-icon-source="custom" data-view-icon="' + view + '" data-icon-design="' + design + '">' +
        drawing +
        '</svg>';
}

function renderChordSymbol(chord, showToolTips, instrument, tooltipBehavior) {
    "use strict";
    var mainChord = chord.root + chord.suffix;
    var displayChordName = mainChord + (chord.bass ? "/" + chord.bass : "");
    var displayMarkup = escapeChordSheetHtml(mainChord);
    var pinnedVoicing = instrument !== "ukulele" ? chord.voicing : null;
    var pinnedToken = pinnedVoicing ? pinnedVoicingToJtabToken(pinnedVoicing, displayChordName) : null;
    var attributes = ' data-chord="' + escapeChordSheetHtml(mainChord) + '"' +
        ' data-chord-root="' + escapeChordSheetHtml(chord.root) + '"' +
        ' data-chord-suffix="' + escapeChordSheetHtml(chord.suffix) + '"';
    var diagramClass = instrument === "ukulele" ? "song-diagram jtab-ukulele" : "song-diagram jtab";
    var options = chordVoicingOptions(mainChord, instrument);
    var selectedToken = pinnedToken || options[0];
    var hoverOnly = tooltipBehavior === "hover";
    var selectedStrings = chordVoicingStrings(selectedToken, pinnedVoicing);
    var selectedTabToken = voicingToJtabTabToken(selectedStrings);
    var viewControls = "";
    var focusAttribute = hoverOnly ? "" : ' tabindex="0"';
    var controls = "";
    var diagramMarkup;
    var diagramLayout;
    var index;
    var optionPosition;
    var pinnedOption;
    var optionText;
    var optionAriaLabel;
    var optionStrings;
    var optionTabToken;
    if (chord.bass) {
        attributes += ' data-bass-note="' + escapeChordSheetHtml(chord.bass) + '"';
        displayMarkup += '<span class="song-chord-bass">/<span class="song-bass-note">' + escapeChordSheetHtml(chord.bass) + '</span></span>';
    }
    if (pinnedVoicing) {
        attributes += ' data-voicing="' + escapeChordSheetHtml(serializePinnedVoicing(pinnedVoicing)) + '" data-voicing-pinned="true"';
        options.unshift(pinnedToken);
    }
    if (!showToolTips) return '<span class="' + songChordSelector + '"' + attributes + '>' + displayMarkup + '</span>';
    if (options.length > 1) {
        controls = '<span class="voicing-controls" role="group" aria-label="Chord voicing by fret for ' + escapeChordSheetHtml(displayChordName) + '">' +
            '<span class="voicing-label" aria-hidden="true">Fret</span><span class="voicing-options">';
        for (index = 0; index < options.length; index++) {
            pinnedOption = Boolean(pinnedVoicing && index === 0);
            optionStrings = chordVoicingStrings(options[index], pinnedOption ? pinnedVoicing : null);
            optionTabToken = voicingToJtabTabToken(optionStrings);
            optionPosition = fretPositionFromStrings(optionStrings) || fallbackCagedFretPosition(options[index]) || { label: "?", fret: null, open: false };
            optionText = (pinnedOption ? 'Pin ' : '') + optionPosition.label;
            optionAriaLabel = voicingOptionAriaLabel(optionPosition, pinnedOption, displayChordName);
            controls += '<button type="button" class="voicing-option' + (index === 0 ? ' is-selected' : '') + (pinnedVoicing && index === 0 ? ' is-pinned' : '') + '"' +
                ' data-voicing-token="' + escapeChordSheetHtml(options[index]) + '"' +
                ' data-tab-token="' + escapeChordSheetHtml(optionTabToken) + '"' +
                ' aria-pressed="' + (index === 0 ? 'true' : 'false') + '"' +
                ' aria-label="' + escapeChordSheetHtml(optionAriaLabel) + '">' + escapeChordSheetHtml(optionText) + '</button>';
        }
        controls += '</span></span>';
    }
    if (instrument !== "ukulele" && selectedTabToken) {
        viewControls = '<span class="voicing-view-controls" role="group" aria-label="Diagram view for ' + escapeChordSheetHtml(displayChordName) + '">' +
            '<button type="button" class="voicing-view-option" data-diagram-view="fretboard" aria-pressed="true" aria-label="Show fretboard diagram for ' + escapeChordSheetHtml(displayChordName) + '" title="Fretboard">' +
            chordDiagramViewIcon("fretboard") + '</button>' +
            '<button type="button" class="voicing-view-option" data-diagram-view="tab" aria-pressed="false" aria-label="Show tablature diagram for ' + escapeChordSheetHtml(displayChordName) + '" title="Tab">' +
            chordDiagramViewIcon("tab") + '</button></span>';
    }
    diagramMarkup = '<span class="' + diagramClass + ' is-fretboard" data-diagram-view="fretboard" data-fretboard-token="' + escapeChordSheetHtml(selectedToken) + '" data-tab-token="' + escapeChordSheetHtml(selectedTabToken) + '" aria-hidden="true">' + escapeChordSheetHtml(selectedToken) + '</span>';
    diagramLayout = viewControls ? '<span class="voicing-diagram-layout">' + viewControls + diagramMarkup + '</span>' : diagramMarkup;
    return '<span class="' + songChordSelector + ' tooltip' + (hoverOnly ? ' tooltip-hover-only' : '') + '"' + focusAttribute + attributes + '>' +
        displayMarkup + '<span class="tooltiptext" data-instrument="' + instrument + '">' +
        '<span class="voicing-header"><strong class="voicing-chord-name">' + escapeChordSheetHtml(displayChordName) + '</strong>' + controls + '</span>' +
        diagramLayout + '</span></span>';
}

function tokenizeChordLine(lineText) {
    "use strict";
    var pattern = /(\s+|\([^)]*\)|[|:]+|[^\s|:]+)/g;
    var tokens = [];
    var match;
    var chord;
    while ((match = pattern.exec(lineText)) !== null) {
        chord = parseChordSymbol(match[0]);
        if (/^\s+$/.test(match[0])) tokens.push({ type: "space", value: match[0] });
        else if (chord) tokens.push({ type: "chord", value: match[0], chord: chord });
        else if (/^\([^)]*\)$/.test(match[0])) tokens.push({ type: "annotation", value: match[0] });
        else if (/^[|:]+$/.test(match[0])) tokens.push({ type: "separator", value: match[0] });
        else tokens.push({ type: "unknown", value: match[0] });
    }
    return tokens;
}

function analyzeChordLine(tokens) {
    "use strict";
    var chordCount = 0;
    var unknownCount = 0;
    var hasSeparator = false;
    var i;
    for (i = 0; i < tokens.length; i++) {
        if (tokens[i].type === "chord") chordCount++;
        else if (tokens[i].type === "unknown") unknownCount++;
        else if (tokens[i].type === "separator") hasSeparator = true;
    }
    return chordCount > 0 && (unknownCount === 0 || hasSeparator);
}

function renderChordLine(tokens, transpose, showToolTips, instrument, tooltipBehavior) {
    "use strict";
    var output = "";
    var i;
    for (i = 0; i < tokens.length; i++) {
        if (tokens[i].type === "chord") output += renderChordSymbol(transposeChordSymbol(tokens[i].chord, transpose), showToolTips, instrument, tooltipBehavior);
        else if (tokens[i].type === "annotation") output += '<span class="song-annotation">' + escapeChordSheetHtml(tokens[i].value) + '</span>';
        else if (tokens[i].type === "space") output += escapeChordSheetHtml(tokens[i].value);
        else output += '<span class="song-chord-text">' + escapeChordSheetHtml(tokens[i].value) + '</span>';
    }
    return output;
}

function renderInlineChords(lineText, transpose, showToolTips, instrument, tooltipBehavior) {
    "use strict";
    var output = "";
    var index = 0;
    var closingIndex;
    var closingCharacter;
    var candidate;
    var chord;
    var character;
    while (index < lineText.length) {
        character = lineText.charAt(index);
        if (character === "\\" && (lineText.charAt(index + 1) === "[" || lineText.charAt(index + 1) === "(")) {
            closingCharacter = lineText.charAt(index + 1) === "[" ? "]" : ")";
            closingIndex = lineText.indexOf(closingCharacter, index + 2);
            if (closingIndex >= 0) {
                output += escapeChordSheetHtml(
                    lineText.slice(index + 1, lineText.charAt(closingIndex - 1) === "\\" ? closingIndex - 1 : closingIndex) + closingCharacter
                );
                index = closingIndex + 1;
                continue;
            }
            output += escapeChordSheetHtml(lineText.charAt(index + 1));
            index += 2;
            continue;
        }
        if (character === "[" || character === "(") {
            closingCharacter = character === "[" ? "]" : ")";
            closingIndex = lineText.indexOf(closingCharacter, index + 1);
            if (closingIndex >= 0) {
                candidate = lineText.slice(index + 1, closingIndex);
                chord = parseChordSymbol(candidate);
                if (chord) {
                    output += renderChordSymbol(transposeChordSymbol(chord, transpose), showToolTips, instrument, tooltipBehavior);
                    index = closingIndex + 1;
                    continue;
                }
            }
        }
        if (character === "\\" && "[]()\\".indexOf(lineText.charAt(index + 1)) >= 0) {
            output += escapeChordSheetHtml(lineText.charAt(index + 1));
            index += 2;
        } else {
            output += escapeChordSheetHtml(character);
            index++;
        }
    }
    return output;
}

function isValidTabNotation(notation) {
    "use strict";
    return notation.length > 0 && notation.length <= 20000 && !/[<>{}]/.test(notation) &&
        (/\$[1-6EADGBe]/.test(notation) || /(?:^|\s)[xX0-9.]{6,}(?:\s|$)/.test(notation));
}

function isValidAbcNotation(notation) {
    "use strict";
    return notation.length > 0 && notation.length <= 20000 && !/[<>]/.test(notation) &&
        /^\s*X:\s*\d+/m.test(notation) &&
        /^\s*K:\s*[A-Ga-g]/m.test(notation) &&
        /(?:^|\n)\s*[\^_=]?[A-Ga-gzZxX][,']*\d*\/?\d*/m.test(notation);
}

function parseCustomJtabChordToken(value) {
    "use strict";
    var token = String(value || "").replace(/^\s+|\s+$/g, "");
    var match;
    var chord;
    if (token.length > 512) return null;
    match = /^%[0-9TXtx.\/-]{11,400}\[([A-Ga-g][#b]?[^\]\r\n]{0,30})\]$/.exec(token);
    if (!match) return null;
    chord = parseChordSymbol(match[1]);
    if (!chord) return null;
    return { token: token, label: match[1], chord: chord };
}

function renderNotationBlocks(scope) {
    "use strict";
    var blocks = getScopedElements(scope, ".song-staff:not([data-notation-rendered])");
    var rendered = 0;
    var source;
    var notation;
    var i;
    for (i = 0; i < blocks.length; i++) {
        source = blocks[i].querySelector(".song-notation-source");
        notation = source ? source.textContent : "";
        blocks[i].setAttribute("data-notation-rendered", "true");
        if (!isValidAbcNotation(notation) || typeof ABCJS === "undefined" || !ABCJS.renderAbc) {
            blocks[i].className += " song-notation-error";
            blocks[i].setAttribute("role", "alert");
            blocks[i].textContent = "Notation could not be rendered.";
            continue;
        }
        try {
            blocks[i].innerHTML = "";
            blocks[i].setAttribute("role", "img");
            blocks[i].setAttribute("aria-label", "Rendered musical notation");
            ABCJS.renderAbc(blocks[i], notation, {
                add_classes: true,
                responsive: "resize",
                oneSvgPerLine: true
            });
            rendered++;
        } catch (error) {
            blocks[i].className += " song-notation-error";
            blocks[i].setAttribute("role", "alert");
            blocks[i].textContent = "Notation could not be rendered.";
        }
    }
    return rendered;
}

function parseSong(songText, transpose, showToolTips, instrument, tooltipBehavior) {
    "use strict";
    var lines = String(songText == null ? "" : songText).split(/\r?\n/g);
    var output = [];
    var selectedTooltipBehavior = tooltipBehavior === "hover" ? "hover" : "hover_focus";
    var currentSection = "";
    var transposition = normalizeTranspose(transpose);
    var tooltipsEnabled = showToolTips !== false;
    var selectedInstrument = instrument === "ukulele" ? "ukulele" : "guitar";
    var sectionMatch;
    var sectionName;
    var sectionClass;
    var tokens;
    var closingIndex;
    var notation;
    var customChord;
    var i;
    for (i = 0; i < lines.length; i++) {
        if (/^\s*\{\{tab\}\}\s*$/.test(lines[i])) {
            closingIndex = i + 1;
            while (closingIndex < lines.length && !/^\s*\{\{\/tab\}\}\s*$/.test(lines[closingIndex])) closingIndex++;
            if (closingIndex < lines.length) {
                notation = lines.slice(i + 1, closingIndex).join(" ").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
                if (isValidTabNotation(notation)) output.push('<div class="song-tab"><div class="jtab chord-sheet-tab">' + escapeChordSheetHtml(notation) + '</div></div>');
                else output.push('<div class="chord-sheet-tab-error">' + escapeChordSheetHtml(notation) + '</div>');
                i = closingIndex;
                continue;
            }
        }
        if (/^\s*\{\{notation\}\}\s*$/.test(lines[i])) {
            closingIndex = i + 1;
            while (closingIndex < lines.length && !/^\s*\{\{\/notation\}\}\s*$/.test(lines[closingIndex])) closingIndex++;
            if (closingIndex < lines.length) {
                notation = lines.slice(i + 1, closingIndex).join("\n").replace(/^\s+|\s+$/g, "");
                if (isValidAbcNotation(notation)) {
                    output.push('<div class="song-staff"><pre class="song-notation-source" hidden>' + escapeChordSheetHtml(notation) + '</pre></div>');
                } else {
                    output.push('<div class="song-notation-error" role="alert">Invalid ABC notation.</div>');
                }
                i = closingIndex;
                continue;
            }
        }
        customChord = parseCustomJtabChordToken(lines[i]);
        if (customChord) {
            if (tooltipsEnabled) {
                output.push('<div class="song-custom-chord"><span class="jtab">' + escapeChordSheetHtml(customChord.token) + '</span></div>');
            } else {
                output.push('<p class="' + chordLineSelector + '">' + renderChordSymbol(customChord.chord, false, selectedInstrument, selectedTooltipBehavior) + '</p>');
            }
            continue;
        }
        if (/^\s*$/.test(lines[i])) { output.push(""); continue; }
        sectionMatch = /^\s*\[([^\]\r\n]+)\]\s*$/.exec(lines[i]);
        if (sectionMatch) {
            if (currentSection !== "") output.push("</div>");
            sectionName = sectionMatch[1];
            sectionClass = sectionName.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "section";
            currentSection = sectionClass;
            output.push('<div class="' + songSectionSelector + ' ' + sectionClass + '">');
            output.push('<h3 class="' + songSectionHeadingSelector + ' ' + sectionClass + '">[' + escapeChordSheetHtml(sectionName) + ']</h3>');
            continue;
        }
        tokens = tokenizeChordLine(lines[i]);
        if (analyzeChordLine(tokens)) {
            output.push('<p class="' + chordLineSelector + '">' + renderChordLine(tokens, transposition, tooltipsEnabled, selectedInstrument, selectedTooltipBehavior) + '</p>');
        } else {
            output.push('<p class="' + songTextLineSelector + '">' + renderInlineChords(lines[i], transposition, tooltipsEnabled, selectedInstrument, selectedTooltipBehavior) + '</p>');
        }
    }
    if (currentSection !== "") output.push("</div>");
    return output.join("\n");
}function getSongData(song, name) {
    "use strict";
    if (song.dataset && song.dataset[name] !== undefined) return song.dataset[name];
    var attributeName = name.replace(/([A-Z])/g, function (match) { return "-" + match.toLowerCase(); });
    return song.getAttribute ? song.getAttribute("data-" + attributeName) : null;
}

function runSongHighlighter(scope) {
    "use strict";
    var songs = getScopedElements(scope, "." + songBlockSelector);
    var initializedCount = 0;
    var i;
    var transpose;
    var instrument;
    var tooltipBehavior;
    var showTooltips;
    var rawText;
    for (i = 0; i < songs.length; i++) {
        if (songs[i]._chordSheetInitialized || getSongData(songs[i], "chordsheetsInitialized") === "true") continue;
        transpose = getSongData(songs[i], "transpose");
        instrument = getSongData(songs[i], "instrument");
        tooltipBehavior = getSongData(songs[i], "tooltipBehavior");
        showTooltips = getSongData(songs[i], "tooltips") !== "0";
        rawText = typeof songs[i].textContent === "string" ? songs[i].textContent : songs[i].innerHTML;
        songs[i].rawText = rawText || "";
        songs[i].innerHTML = parseSong(songs[i].rawText, transpose, showTooltips, instrument, tooltipBehavior);
        songs[i]._chordSheetInitialized = true;
        if (songs[i].dataset) songs[i].dataset.chordsheetsInitialized = "true";
        else if (songs[i].setAttribute) songs[i].setAttribute("data-chordsheets-initialized", "true");
        initializedCount++;
    }
    return initializedCount;
}

function findChordSheetSourcePanel(tablist, panelId, ownerDocument) {
    "use strict";
    var wrapper = tablist.closest ? tablist.closest(".chord-sheet-example") : null;
    var panels;
    var i;

    if (wrapper) {
        panels = wrapper.querySelectorAll('[role="tabpanel"]');
        for (i = 0; i < panels.length; i++) {
            if (panels[i].id === panelId) return panels[i];
        }
        return null;
    }
    return ownerDocument.getElementById ? ownerDocument.getElementById(panelId) : null;
}

function selectChordSheetSourceTab(tablist, selectedTab, moveFocus) {
    "use strict";
    var tabs = tablist.querySelectorAll('[role="tab"]');
    var ownerDocument = selectedTab.ownerDocument || document;
    var panel;
    var selected;
    var i;

    for (i = 0; i < tabs.length; i++) {
        selected = tabs[i] === selectedTab;
        tabs[i].setAttribute("aria-selected", selected ? "true" : "false");
        tabs[i].setAttribute("tabindex", selected ? "0" : "-1");
        panel = findChordSheetSourcePanel(tablist, tabs[i].getAttribute("aria-controls"), ownerDocument);
        if (panel) panel.hidden = !selected;
    }
    if (moveFocus && selectedTab.focus) selectedTab.focus();
}

function handleChordSheetSourceTabClick(event) {
    "use strict";
    selectChordSheetSourceTab(this, event.currentTarget, false);
}

function handleChordSheetSourceTabKeydown(event) {
    "use strict";
    var tablist = this;
    var tabs = tablist.querySelectorAll('[role="tab"]');
    var currentIndex = -1;
    var nextIndex;
    var i;

    for (i = 0; i < tabs.length; i++) {
        if (tabs[i] === event.currentTarget) currentIndex = i;
    }
    if (currentIndex < 0) return;

    if (event.key === "ArrowRight") {
        nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
        nextIndex = 0;
    } else if (event.key === "End") {
        nextIndex = tabs.length - 1;
    } else {
        return;
    }

    event.preventDefault();
    selectChordSheetSourceTab(tablist, tabs[nextIndex], true);
}

function initializeChordSheetSourceTabs(scope) {
    "use strict";
    var tablists = getScopedElements(scope, ".chord-sheet-example-tabs");
    var initializedCount = 0;
    var tabs;
    var selectedTab;
    var i;
    var j;

    for (i = 0; i < tablists.length; i++) {
        tabs = tablists[i].querySelectorAll('[role="tab"]');
        if (tabs.length < 2) continue;
        if (tablists[i]._chordSheetSourceTabsBound) {
            selectedTab = null;
            for (j = 0; j < tabs.length; j++) {
                if (tabs[j].getAttribute("aria-selected") === "true") {
                    selectedTab = tabs[j];
                }
            }
            selectChordSheetSourceTab(tablists[i], selectedTab || tabs[0], false);
            tablists[i].hidden = false;
            continue;
        }
        for (j = 0; j < tabs.length; j++) {
            tabs[j].addEventListener("click", handleChordSheetSourceTabClick.bind(tablists[i]));
            tabs[j].addEventListener("keydown", handleChordSheetSourceTabKeydown.bind(tablists[i]));
        }
        tablists[i].hidden = false;
        tablists[i]._chordSheetSourceTabsBound = true;
        initializedCount++;
    }
    return initializedCount;
}

function initializeChordSheets(scope) {
    "use strict";
    var root = scope || document;
    var renderedSongs = runSongHighlighter(root);
    initializeChordSheetSourceTabs(root);
    if (renderedSongs < 1) return;
    if (typeof jtab !== "undefined" && jtab.renderimplicit) jtab.renderimplicit(root);
    if (typeof ukulele !== "undefined" && ukulele.renderimplicit) ukulele.renderimplicit(root);
    renderNotationBlocks(root);
    bindChordVoicingSelectors(root);
    bindChordTooltips(root);
}

function initializeUpdatedChordSheets(event) {
    "use strict";
    var root = event && event.detail && event.detail.root ? event.detail.root : document;
    initializeChordSheets(root);
    initializeChordSheetColorSettings(root);
}

function restoreChordSheetHashTarget() {
    "use strict";
    var hash;
    var targetId;
    var target;

    if (typeof window === "undefined" || !window.location) return false;
    if (getScopedElements(document, ".chord-sheet-example-tabs").length < 1) return false;
    hash = window.location.hash || "";
    if (hash.charAt(0) !== "#" || hash.length < 2) return false;
    try {
        targetId = decodeURIComponent(hash.slice(1));
    } catch (error) {
        return false;
    }
    target = document.getElementById ? document.getElementById(targetId) : null;
    if (!target || !target.scrollIntoView) return false;
    target.scrollIntoView({ block: "start" });
    return true;
}

function initializeRestoredChordSheetPage(event) {
    "use strict";
    if (!event || !event.persisted) return false;
    ready();
    restoreChordSheetHashTarget();
    return true;
}

function registerDokuWikiContentInitializer() {
    "use strict";
    document.addEventListener("dw_page_loaded", initializeUpdatedChordSheets);
    if (typeof window !== "undefined" && window.addEventListener) {
        window.addEventListener("pageshow", initializeRestoredChordSheetPage);
        window.addEventListener("load", restoreChordSheetHashTarget);
    }
    if (typeof window !== "undefined" && window.jQuery) {
        window.jQuery(document).on("dw_page_content.chordsheets", function (event, data) {
            var content = data && data.$content;
            var root = content && content[0] ? content[0] : document;
            initializeChordSheets(root);
            initializeChordSheetColorSettings(root);
        });
    }
}

function createChordSheetExportNode(song) {
    "use strict";
    var ownerDocument = song.ownerDocument || document;
    var exportNode = ownerDocument.createElement("div");
    var contentNode = ownerDocument.createElement("div");
    var sheet = song.parentNode;
    var metadata = sheet && sheet.querySelector ? sheet.querySelector(".song-metadata") : null;
    var exportFontFamily = song.style && typeof song.style.getPropertyValue === "function"
        ? song.style.getPropertyValue("--cs-export-font-family").trim()
        : "";
    exportNode.className = "chord-sheet-export";
    if (exportFontFamily && exportNode.style) {
        exportNode.style.fontFamily = exportFontFamily;
    }

    if (getSongData(song, "exportMetadata") === "1" && metadata && metadata.cloneNode) {
        exportNode.appendChild(metadata.cloneNode(true));
    }
    contentNode.innerHTML = parseSong(
        song.rawText || song.textContent || "",
        getSongData(song, "transpose"),
        false,
        getSongData(song, "instrument")
    );
    exportNode.appendChild(contentNode);
    return exportNode;
}

function renderChordSheetExportVisuals(scope) {
    "use strict";
    if (typeof jtab !== "undefined" && jtab.renderimplicit) {
        jtab.renderimplicit(scope);
    }
    renderNotationBlocks(scope);
}

function replaceExportSvgsWithImages(scope) {
    "use strict";
    var svgs = getScopedElements(scope, ".song-tab svg, .song-staff svg");
    var serializer;
    var markup;
    var ownerDocument;
    var image;
    var label;
    var width;
    var height;
    var rect;
    var replaced = 0;
    var i;
    if (typeof XMLSerializer === "undefined") {
        throw new Error("SVG export is not supported by this browser.");
    }
    serializer = new XMLSerializer();
    for (i = 0; i < svgs.length; i++) {
        markup = serializer.serializeToString(svgs[i]);
        if (!/\sxmlns=/.test(markup)) {
            markup = markup.replace(/^<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        ownerDocument = svgs[i].ownerDocument || document;
        image = ownerDocument.createElement("img");
        label = svgs[i].getAttribute("aria-label") || "Rendered tablature or notation";
        rect = svgs[i].getBoundingClientRect ? svgs[i].getBoundingClientRect() : null;
        width = rect && rect.width > 0 ? Math.round(rect.width) : svgs[i].getAttribute("width");
        height = rect && rect.height > 0 ? Math.round(rect.height) : svgs[i].getAttribute("height");
        image.setAttribute("class", "chord-sheet-export-image");
        image.setAttribute("alt", label);
        if (width) image.setAttribute("width", width);
        if (height) image.setAttribute("height", height);
        image.setAttribute("src", "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup));
        svgs[i].parentNode.replaceChild(image, svgs[i]);
        replaced++;
    }
    return replaced;
}

function rasterizeExportSvg(svg) {
    "use strict";
    return new Promise(function (resolve, reject) {
        var ownerDocument = svg.ownerDocument || document;
        var serializer = new XMLSerializer();
        var markup = serializer.serializeToString(svg);
        var image = ownerDocument.createElement("img");
        var canvas = ownerDocument.createElement("canvas");
        var context = canvas.getContext("2d");
        var rect = svg.getBoundingClientRect ? svg.getBoundingClientRect() : null;
        var width = rect && rect.width > 0 ? Math.round(rect.width) : parseFloat(svg.getAttribute("width"));
        var height = rect && rect.height > 0 ? Math.round(rect.height) : parseFloat(svg.getAttribute("height"));
        var label = svg.getAttribute("aria-label") || "Rendered tablature or notation";
        var scale = 2;
        if (!/\sxmlns=/.test(markup)) {
            markup = markup.replace(/^<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        width = isFinite(width) && width > 0 ? width : 640;
        height = isFinite(height) && height > 0 ? height : 180;
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        image.onload = function () {
            try {
                image.onload = null;
                image.onerror = null;
                context.fillStyle = "#ffffff";
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                image.setAttribute("class", "chord-sheet-export-image");
                image.setAttribute("alt", label);
                image.setAttribute("width", width);
                image.setAttribute("height", height);
                image.setAttribute("src", canvas.toDataURL("image/png"));
                svg.parentNode.replaceChild(image, svg);
                resolve(1);
            } catch (error) {
                reject(error);
            }
        };
        image.onerror = function () {
            reject(new Error("SVG could not be rasterized for export."));
        };
        image.setAttribute("src", "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup));
    });
}

function replaceExportSvgsWithPngImages(scope) {
    "use strict";
    var svgs = getScopedElements(scope, ".song-tab svg, .song-staff svg");
    var jobs = [];
    var i;
    if (svgs.length === 0) return Promise.resolve(0);
    if (typeof XMLSerializer === "undefined" || typeof Promise === "undefined") {
        return Promise.reject(new Error("PNG export is not supported by this browser."));
    }
    for (i = 0; i < svgs.length; i++) {
        jobs.push(rasterizeExportSvg(svgs[i]));
    }
    return Promise.all(jobs).then(function (results) {
        return results.length;
    });
}

function canUseWordClipboard() {
    "use strict";
    return typeof navigator !== "undefined" &&
        navigator.clipboard &&
        typeof navigator.clipboard.write === "function" &&
        typeof ClipboardItem !== "undefined" &&
        typeof Blob !== "undefined";
}

function writeWordExportToClipboard(node) {
    "use strict";
    var prepared = replaceExportSvgsWithPngImages(node).then(function () {
        return {
            html: node.outerHTML,
            text: node.innerText || node.textContent || ""
        };
    });
    var item = new ClipboardItem({
        "text/html": prepared.then(function (content) {
            return new Blob([content.html], { type: "text/html" });
        }),
        "text/plain": prepared.then(function (content) {
            return new Blob([content.text], { type: "text/plain" });
        })
    });
    return {
        preparation: prepared,
        write: Promise.resolve(navigator.clipboard.write([item]))
    };
}

function cleanupChordSheetExport(song, node) {
    "use strict";
    if (node.parentNode === song) song.removeChild(node);
    window.getSelection().removeAllRanges();
}

function copyPreparedChordSheetExport(song, node) {
    "use strict";
    try {
        var range = document.createRange();
        range.selectNode(node);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        var successful = document.execCommand("copy");
        var message = successful ? "successfully" : "unsuccessfully";
        alert(message + " copied song to clipboard. Use CTRL + V to paste it in your word document.");
        return successful;
    } catch (error) {
        alert("Oops, unable to copy");
        return false;
    } finally {
        cleanupChordSheetExport(song, node);
    }
}

function copyChordSheetExportWithSvgFallback(song, node) {
    "use strict";
    try {
        replaceExportSvgsWithImages(node);
        return copyPreparedChordSheetExport(song, node);
    } catch (error) {
        cleanupChordSheetExport(song, node);
        alert("Oops, unable to prepare song for copying");
        return false;
    }
}

function copyChordSheetExportWithClipboard(song, node) {
    "use strict";
    var clipboardJob;
    try {
        renderChordSheetExportVisuals(node);
        clipboardJob = writeWordExportToClipboard(node);
    } catch (error) {
        cleanupChordSheetExport(song, node);
        alert("Oops, unable to prepare song for copying");
        return false;
    }
    clipboardJob.write.then(
        function () {
            alert("Successfully copied song to clipboard. Use CTRL + V to paste it in your word document.");
            cleanupChordSheetExport(song, node);
        },
        function () {
            clipboardJob.preparation.then(
                function () { copyPreparedChordSheetExport(song, node); },
                function () { copyChordSheetExportWithSvgFallback(song, node); }
            );
        }
    );
    return true;
}

function cSheetExportToWord(id) {
    var song = document.getElementById(id);

    if (!song) return false;

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

    window.getSelection().removeAllRanges();
    if (song.rawText) {
        var node = createChordSheetExportNode(song);
        song.appendChild(node);
        if (canUseWordClipboard()) {
            return copyChordSheetExportWithClipboard(song, node);
        }
        try {
            renderChordSheetExportVisuals(node);
            replaceExportSvgsWithImages(node);
            var range = document.createRange();
            range.selectNode(node);
            window.getSelection().addRange(range);
            copy();
        } catch (error) {
            alert("Oops, unable to prepare song for copying");
        } finally {
            song.removeChild(node);
        }
    } else {
        var range = document.createRange();
        range.selectNode(song);
        window.getSelection().addRange(range);
        copy();
    }

    // Remove the selections - NOTE: Should use
    // removeRange(range) when it is supported  
    window.getSelection().removeAllRanges();
    return true;
}

registerDokuWikiContentInitializer();
if (document.readyState === "loading" || typeof document.readyState === "undefined") {
    document.addEventListener("DOMContentLoaded", ready);
} else {
    ready();
}
