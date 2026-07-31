const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const scriptSource = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");

function loadScript(overrides = {}) {
    const context = {
        console,
        document: { addEventListener() {} },
        ...overrides
    };
    vm.createContext(context);
    vm.runInContext(scriptSource, context);
    return context;
}

const parserContext = loadScript();
const calculatePosition = parserContext.calculateChordTooltipPosition;
const parseSong = parserContext.parseSong;
const position = (...args) => ({ ...calculatePosition(...args) });
const count = (text, fragment) => text.split(fragment).length - 1;

test("places a chord tooltip above the chord when enough space exists", () => {
    assert.equal(typeof calculatePosition, "function");
    assert.deepEqual(
        position(
            { left: 200, right: 240, top: 200, bottom: 220, width: 40 },
            { width: 120, height: 100 },
            { width: 640, height: 800 }
        ),
        { left: 160, top: 92, placement: "top", arrowLeft: 60 }
    );
});

test("flips a chord tooltip below the chord near the viewport top", () => {
    assert.deepEqual(
        position(
            { left: 200, right: 240, top: 50, bottom: 70, width: 40 },
            { width: 120, height: 100 },
            { width: 640, height: 800 }
        ),
        { left: 160, top: 78, placement: "bottom", arrowLeft: 60 }
    );
});

test("keeps a chord tooltip inside the horizontal viewport gutter", () => {
    assert.deepEqual(
        position(
            { left: 600, right: 620, top: 200, bottom: 220, width: 20 },
            { width: 150, height: 100 },
            { width: 640, height: 800 }
        ),
        { left: 482, top: 92, placement: "top", arrowLeft: 128 }
    );
    assert.equal(
        position(
            { left: 0, right: 20, top: 200, bottom: 220, width: 20 },
            { width: 150, height: 100 },
            { width: 640, height: 800 }
        ).left,
        8
    );
});

test("keeps the tooltip arrow aimed at a chord when the popover is clamped to the viewport edge", () => {
    const result = position(
        { left: 0, right: 20, top: 200, bottom: 220, width: 20 },
        { width: 150, height: 100 },
        { width: 640, height: 800 }
    );

    assert.deepEqual(result, {
        left: 8,
        top: 92,
        placement: "top",
        arrowLeft: 2
    });
    assert.notEqual(result.arrowLeft, 75);
    assert.equal(result.left + result.arrowLeft, 10);
});

test("keeps the tooltip arrow aimed at a chord when the popover is clamped to the right viewport edge", () => {
    const result = position(
        { left: 620, right: 640, top: 200, bottom: 220, width: 20 },
        { width: 150, height: 100 },
        { width: 640, height: 800 }
    );

    assert.deepEqual(result, {
        left: 482,
        top: 92,
        placement: "top",
        arrowLeft: 148
    });
    assert.notEqual(result.arrowLeft, 75);
    assert.equal(result.left + result.arrowLeft, 630);
});

test("applies the calculated edge-aware arrow offset to the tooltip", () => {
    const style = {
        setProperty(name, value) {
            this[name] = value;
        }
    };
    const tooltip = {
        style,
        dataset: {},
        getBoundingClientRect() {
            return { width: 150, height: 100 };
        }
    };
    const chord = {
        querySelector(selector) {
            assert.equal(selector, ".tooltiptext");
            return tooltip;
        },
        getBoundingClientRect() {
            return { left: 0, right: 20, top: 200, bottom: 220, width: 20 };
        }
    };
    const context = loadScript({
        document: {
            addEventListener() {},
            documentElement: { clientWidth: 640, clientHeight: 800 }
        }
    });

    context.positionChordTooltip(chord);

    assert.equal(style["--cs-tooltip-arrow-left"], "2px");
    assert.equal(tooltip.dataset.placement, "top");
});

test("honors the explicit tooltip flag for page and export rendering", () => {
    const interactive = parseSong("C", 0, true);
    const exported = parseSong("C", 0, false);

    assert.match(interactive, /class="song-chord tooltip"/);
    assert.match(interactive, /class="song-diagram jtab is-fretboard"/);
    assert.doesNotMatch(exported, /\btooltip(?:text)?\b|\bjtab\b/);
    assert.match(exported, /class="song-chord"/);
});

test("keeps altered and extended chord symbols as complete tokens", () => {
    const output = parseSong("C7b5 Cmaj7 Am7 Fadd9 G/B", 2, false);

    assert.equal(count(output, 'class="song-chord"'), 5);
    assert.match(output, />D7b5<\/span>/);
    assert.match(output, />Dmaj7<\/span>/);
    assert.match(output, />Bm7<\/span>/);
    assert.match(output, />Gadd9<\/span>/);
    assert.match(output, />A<span class="song-chord-bass">\/<span class="song-bass-note">C#<\/span><\/span><\/span>/);
});

test("preserves bars, annotations, unknown tokens, and whitespace on chord lines", () => {
    const source = "  G  | A B || C  (2x)  ??? | Dm7/G  ";
    const output = parseSong(source, 2, false);

    assert.match(
        output,
        /  <span[^>]*>A<\/span>  <span class="song-chord-text">\|<\/span> <span[^>]*>B<\/span> <span[^>]*>C#<\/span> <span class="song-chord-text">\|\|<\/span> <span[^>]*>D<\/span>  <span class="song-annotation">\(2x\)<\/span>  <span class="song-chord-text">\?\?\?<\/span> <span class="song-chord-text">\|<\/span> <span[^>]*>Em7<span class="song-chord-bass">\/<span class="song-bass-note">A<\/span><\/span><\/span>  /
    );
    assert.equal(count(output, 'class="song-chord"'), 5);
    assert.equal(count(output, 'class="song-chord-text"'), 4);
    assert.doesNotMatch(output, /<p[^>]+style=/);
});

test("exposes slash-chord parts semantically and transposes chord and bass", () => {
    const natural = parseSong("C/G", 2, false);
    const sharp = parseSong("D/F#", 1, false);
    const flat = parseSong("C/Bb", 2, false);

    assert.match(
        natural,
        /data-chord="D" data-chord-root="D" data-chord-suffix="" data-bass-note="A">D<span class="song-chord-bass">\/<span class="song-bass-note">A<\/span><\/span><\/span>/
    );
    assert.match(sharp, /data-chord="Eb"[^>]*data-bass-note="G">Eb<span class="song-chord-bass">\/<span class="song-bass-note">G<\/span><\/span><\/span>/);
    assert.match(flat, /data-chord="D"[^>]*data-bass-note="C">D<span class="song-chord-bass">\/<span class="song-bass-note">C<\/span><\/span><\/span>/);
});

test("preserves standalone JTab notation alongside parsed content", () => {
    const output = parseSong("%7/2.X/X.7/3.7/4.6/1.X/X[Bm7b5]\nC\nlyric", 0, true);

    assert.match(output, /<div class="song-custom-chord"><span class="jtab">%7\/2\.X\/X\.7\/3\.7\/4\.6\/1\.X\/X\[Bm7b5\]<\/span><\/div>/);
    assert.match(output, /class="song-chord tooltip"/);
    assert.match(output, /class="song-textLine">lyric<\/p>/);
});
test("exposes the selected instrument to the diagram renderer", () => {
    const guitar = parseSong("C", 0, true, "guitar");
    const ukulele = parseSong("C", 0, true, "ukulele");

    assert.match(guitar, /class="tooltiptext"[^>]*data-instrument="guitar"[\s\S]*class="song-diagram jtab is-fretboard"/);
    assert.match(ukulele, /class="tooltiptext"[^>]*data-instrument="ukulele"[\s\S]*class="song-diagram jtab-ukulele is-fretboard"/);
});
test("honors hover-only and keyboard-accessible tooltip behavior", () => {
    const accessible = parseSong("C", 0, true, "guitar", "hover_focus");
    const hoverOnly = parseSong("C", 0, true, "guitar", "hover");

    assert.match(accessible, /class="song-chord tooltip" tabindex="0"/);
    assert.doesNotMatch(accessible, /tooltip-hover-only/);
    assert.match(hoverOnly, /class="song-chord tooltip tooltip-hover-only"/);
    assert.doesNotMatch(hoverOnly, /tabindex=/);
});


test("offers an inline visual guitar-voicing picker without changing the chord symbol", () => {
    const guitar = parseSong("C", 0, true, "guitar");
    const ukulele = parseSong("C", 0, true, "ukulele");

    assert.match(guitar, />C<span class="tooltiptext"/);
    assert.equal(count(guitar, '<button type="button" class="voicing-option'), 5);
    assert.match(guitar, /role="group" aria-label="Chord voicing by fret for C"/);
    assert.match(guitar, /data-voicing-token="C"[^>]*aria-pressed="true"/);
    assert.match(guitar, /data-voicing-token="C:5"[^>]*aria-pressed="false"/);
    assert.doesNotMatch(guitar, /<select/);
    assert.doesNotMatch(ukulele, /voicing-option/);
});

test("labels guitar alternatives by their actual fret position instead of variant numbers", () => {
    const chordArrays = {
        C: [0, [-1], [3], [2], [0], [1], [0]],
        "C:2": [2, [-1], [3], [5], [5], [5], [3]],
        "C:3": [4, [8], [7], [5], [5], [5], [8]],
        "C:4": [7, [8], [10], [10], [9], [8], [8]],
        "C:5": [9, [-1], [10], [10], [12], [13], [12]]
    };
    function JtabChordStub(token) {
        this.isValid = Object.hasOwn(chordArrays, token);
        this.chordArray = chordArrays[token];
    }
    const context = loadScript({ jtabChord: JtabChordStub });
    const output = context.parseSong("C", 0, true, "guitar");

    assert.match(output, /class="voicing-label"[^>]*>Fret<\/span>/);
    assert.match(output, /data-voicing-token="C"[^>]*>Open<\/button>/);
    assert.match(output, /data-voicing-token="C:2"[^>]*>3<\/button>/);
    assert.match(output, /data-voicing-token="C:3"[^>]*>5<\/button>/);
    assert.match(output, /data-voicing-token="C:4"[^>]*>8<\/button>/);
    assert.match(output, /data-voicing-token="C:5"[^>]*>10<\/button>/);
    assert.match(output, /aria-label="Use open-position shape for C"/);
    assert.match(output, /aria-label="Use shape at fret 10 for C"/);
    assert.doesNotMatch(output, />1<\/button>|>2<\/button>|>4<\/button>/);
});

test("derives fret labels from the deterministic CAGED fallback when JTab inspection fails", () => {
    function ThrowingJtabChord() { throw new Error("renderer unavailable"); }
    const context = loadScript({ jtabChord: ThrowingJtabChord });
    const output = context.parseSong("C", 0, true, "guitar");

    assert.match(output, /data-voicing-token="C"[^>]*>Open<\/button>/);
    assert.match(output, /data-voicing-token="C:2"[^>]*>3<\/button>/);
    assert.match(output, /data-voicing-token="C:3"[^>]*>5<\/button>/);
    assert.match(output, /data-voicing-token="C:4"[^>]*>8<\/button>/);
    assert.match(output, /data-voicing-token="C:5"[^>]*>10<\/button>/);
});

test("shows the fret position alongside an authored voicing pin", () => {
    const output = parseSong("C@{x,3,2,0,1,0}", 2, true, "guitar");

    assert.match(output, /class="voicing-option is-selected is-pinned"[^>]*>Pin 2<\/button>/);
    assert.match(output, /aria-label="Use pinned shape at fret 2 for D"/);
});

test("separates the pinned fretboard and tablature into switchable views", () => {
    const output = parseSong("C@{x,3,2,0,1,0}", 0, true, "guitar");

    assert.match(output, /role="group" aria-label="Diagram view for C"/);
    assert.match(output, /data-diagram-view="fretboard" aria-pressed="true" aria-label="Show fretboard diagram for C"/);
    assert.match(output, /data-diagram-view="tab" aria-pressed="false" aria-label="Show tablature diagram for C"/);
    assert.match(output, /data-voicing-token="%X\/X\.%3\/\.%2\/\.%0\.%1\/\.%0\[C\]" data-tab-token="X\.3\.2\.0\.1\.0"/);
    assert.match(output, /class="song-diagram jtab is-fretboard" data-diagram-view="fretboard" data-fretboard-token="%X\/X\.%3\/\.%2\/\.%0\.%1\/\.%0\[C\]" data-tab-token="X\.3\.2\.0\.1\.0"/);
    assert.doesNotMatch(output, /%X\/X\.3\.2\.0\.1\.0\[C\]/);
});

test("keeps fingerless fretted strings in authored JTab voicings renderable", () => {
    const output = parseSong("C@{x,3,2,0,1,0}", 0, true, "guitar");

    assert.match(
        output,
        /data-fretboard-token="%X\/X\.%3\/\.%2\/\.%0\.%1\/\.%0\[C\]"/
    );
});

test("renders diagram views as an accessible icon rail beside the diagram", () => {
    const output = parseSong("C@{x,3,2,0,1,0}", 0, true, "guitar");
    const fretboardIcon = output.match(/<svg[^>]*data-view-icon="fretboard"[\s\S]*?<\/svg>/)[0];
    const tabIcon = output.match(/<svg[^>]*data-view-icon="tab"[\s\S]*?<\/svg>/)[0];

    assert.match(
        output,
        /class="voicing-diagram-layout"[^>]*>[\s\S]*class="voicing-view-controls"[\s\S]*class="song-diagram jtab is-fretboard"/
    );
    assert.match(output, /data-diagram-view="fretboard"[^>]*aria-label="Show fretboard diagram for C"[^>]*>[\s\S]*class="voicing-view-icon"/);
    assert.match(output, /data-diagram-view="tab"[^>]*aria-label="Show tablature diagram for C"[^>]*>[\s\S]*class="voicing-view-icon"/);
    assert.doesNotMatch(output, />Fretboard<\/button>|>Tab<\/button>/);
    assert.equal((output.match(/data-icon-source="custom"/g) || []).length, 2);
    assert.doesNotMatch(output, /data-icon-source="bootstrap-icons"/);
    assert.match(fretboardIcon, /viewBox="0 0 24 24"[^>]*data-icon-design="guitar-headstock"/);
    assert.match(fretboardIcon, /class="headstock-outline"/);
    assert.match(tabIcon, /viewBox="0 0 24 24"[^>]*data-icon-design="horizontal-tab"/);
    assert.match(tabIcon, /class="tab-label"[^>]*>T<\/text>[\s\S]*>A<\/text>[\s\S]*>B<\/text>/);
    assert.equal((tabIcon.match(/class="tab-string-line"/g) || []).length, 3);
    assert.equal((tabIcon.match(/class="tab-marker"/g) || []).length, 3);
});


test("switches one canvas between fretboard and tab with accessible pressed state", () => {
    const pressed = {};
    const attributes = {
        "data-fretboard-token": "%X/X.%3/.%2/.%0.%1/.%0[C]",
        "data-tab-token": "X.3.2.0.1.0",
        "data-diagram-view": "fretboard"
    };
    function button(view) {
        return {
            getAttribute(name) {
                assert.equal(name, "data-diagram-view");
                return view;
            },
            setAttribute(name, value) {
                assert.equal(name, "aria-pressed");
                pressed[view] = value;
            }
        };
    }
    const diagram = {
        textContent: "",
        getAttribute(name) { return attributes[name]; },
        setAttribute(name, value) { attributes[name] = value; },
        classList: { add() {}, remove() {} }
    };
    const fretboardButton = button("fretboard");
    const tabButton = button("tab");
    const tooltip = {
        parentNode: null,
        querySelector() { return diagram; },
        querySelectorAll() { return [fretboardButton, tabButton]; }
    };
    tabButton.closest = () => tooltip;
    const renderCalls = [];
    const context = loadScript({ jtab: { render(element, token) { renderCalls.push({ element, token }); } } });

    assert.equal(context.selectChordDiagramView(tabButton), true);
    assert.deepEqual(pressed, { fretboard: "false", tab: "true" });
    assert.equal(attributes["data-diagram-view"], "tab");
    assert.equal(diagram.textContent, "X.3.2.0.1.0");
    assert.deepEqual(renderCalls, [{ element: diagram, token: "X.3.2.0.1.0" }]);
});

test("keeps the tab view active when selecting another voicing", () => {
    const renderCalls = [];
    const attributes = { "data-diagram-view": "tab" };
    const diagram = {
        textContent: "",
        getAttribute(name) { return attributes[name]; },
        setAttribute(name, value) { attributes[name] = value; },
        classList: { add() {}, remove() {} }
    };
    const selected = {
        getAttribute(name) {
            return name === "data-voicing-token" ? "C:3" : "8.7.5.5.5.8";
        },
        setAttribute() {},
        classList: { add() {}, remove() {} }
    };
    const tooltip = {
        parentNode: null,
        querySelector() { return diagram; },
        querySelectorAll() { return [selected]; }
    };
    selected.closest = () => tooltip;
    const context = loadScript({ jtab: { render(element, token) { renderCalls.push({ element, token }); } } });

    assert.equal(context.selectChordVoicing(selected), true);
    assert.equal(diagram.textContent, "8.7.5.5.5.8");
    assert.equal(attributes["data-fretboard-token"], "C:3");
    assert.equal(attributes["data-tab-token"], "8.7.5.5.5.8");
    assert.deepEqual(renderCalls, [{ element: diagram, token: "8.7.5.5.5.8" }]);
});

test("pins explicit authored voicings on chord lines and keeps them through transposition", () => {
    const output = parseSong("C@{x,3,2,0,1,0}    G/B@{x,2,0,0,0,3}", 2, true, "guitar");

    assert.match(output, /data-chord="D"[^>]*data-voicing="x,5,4,2,3,2"/);
    assert.match(output, /class="song-diagram jtab is-fretboard"[^>]*data-fretboard-token="%X\/X\.%5\/\.%4\/\.%2\/\.%3\/\.%2\/\[D\]"/);
    assert.match(output, /data-voicing-token="%X\/X\.%5\/\.%4\/\.%2\/\.%3\/\.%2\/\[D\]"[^>]*aria-pressed="true"/);
    assert.match(output, /data-chord="A"[^>]*data-bass-note="C#"[^>]*data-voicing="x,4,2,2,2,5"/);
    assert.match(output, /aria-label="Use pinned shape at fret 2 for D"/);
    assert.doesNotMatch(output, /@\{/);
});

test("pins explicit voicings on inline chords and rejects malformed string sets", () => {
    const inline = parseSong("Play [Am7@{x,0,2,0,1,0}] softly", 0, false, "guitar");
    const invalid = parseSong("C@{x,3,2,0,1}", 0, false, "guitar");

    assert.match(inline, /data-chord="Am7"[^>]*data-voicing="x,0,2,0,1,0"[^>]*>Am7<\/span>/);
    assert.doesNotMatch(inline, /@\{/);
    assert.doesNotMatch(invalid, /data-chord=/);
    assert.match(invalid, /C@\{x,3,2,0,1\}/);
});

test("preserves authored fingers in the source key and drops stale fingers after transposition", () => {
    const source = parseSong("F@{1/1,3/3,3/4,2/2,1/1,1/1}", 0, true, "guitar");
    const shifted = parseSong("F@{1/1,3/3,3/4,2/2,1/1,1/1}", 2, true, "guitar");

    assert.match(source, /data-voicing="1\/1,3\/3,3\/4,2\/2,1\/1,1\/1"/);
    assert.match(source, /%1\/1\.%3\/3\.%3\/4\.%2\/2\.%1\/1\.%1\/1\[F\]/);
    assert.match(shifted, /data-chord="G"[^>]*data-voicing="3,5,5,4,3,3"/);
    assert.doesNotMatch(shifted, /\/1|\/2|\/3|\/4/);
});

test("re-renders only the diagram when a voicing is selected", () => {
    const renderCalls = [];
    const pressed = {};
    function option(token) {
        const classes = new Set();
        return {
            getAttribute(name) {
                if (name === "data-voicing-token") return token;
                return "";
            },
            setAttribute(name, value) {
                assert.equal(name, "aria-pressed");
                pressed[token] = value;
            },
            classList: {
                add(name) { classes.add(name); },
                remove(name) { classes.delete(name); }
            }
        };
    }
    const diagram = {
        textContent: "",
        getAttribute(name) { return name === "data-diagram-view" ? "fretboard" : ""; },
        setAttribute() {},
        classList: { add() {}, remove() {} }
    };
    const pinned = option("%X/X.%3/.%2/.%0.%1/.%0[C]");
    const selected = option("C:3");
    const tooltip = {
        querySelector() { return diagram; },
        querySelectorAll() { return [pinned, selected]; }
    };
    selected.closest = function (selector) {
        assert.equal(selector, ".tooltiptext");
        return tooltip;
    };
    const context = loadScript({
        jtab: {
            render(element, token) {
                renderCalls.push({ element, token });
            }
        }
    });

    assert.equal(context.selectChordVoicing(selected), true);
    assert.equal(diagram.textContent, "C:3");
    assert.deepEqual(renderCalls, [{ element: diagram, token: "C:3" }]);
    assert.equal(pressed["%X/X.%3/.%2/.%0.%1/.%0[C]"], "false");
    assert.equal(pressed["C:3"], "true");
});

test("finds the surrounding tooltip without Element.closest support", () => {
    const diagram = {
        textContent: "",
        classList: { remove() {} }
    };
    const selected = {
        getAttribute() { return "C:4"; },
        setAttribute() {},
        classList: { add() {}, remove() {} }
    };
    const tooltip = {
        className: "tooltiptext",
        parentNode: null,
        querySelector(selector) {
            assert.equal(selector, ".song-diagram");
            return diagram;
        },
        querySelectorAll(selector) {
            assert.equal(selector, ".voicing-option");
            return [selected];
        }
    };
    const header = { className: "voicing-header", parentNode: tooltip };
    const controls = { className: "voicing-controls", parentNode: header };
    const optionGroup = { className: "voicing-options", parentNode: controls };
    selected.parentNode = optionGroup;
    const context = loadScript();

    assert.equal(context.selectChordVoicing(selected), true);
    assert.equal(diagram.textContent, "C:4");
});

test("renders bracketed and parenthesized inline chords in lyric text", () => {
    const output = parseSong("I can see [C] you and (G/B) me", 2, false);

    assert.match(output, /class="song-textLine"/);
    assert.doesNotMatch(output, /song-section-heading/);
    assert.match(
        output,
        /I can see <span[^>]*>D<\/span> you and <span[^>]*data-bass-note="C#">A<span class="song-chord-bass">\/<span class="song-bass-note">C#<\/span><\/span><\/span> me/
    );
});

test("keeps sections unambiguous and permits escaped inline delimiters", () => {
    const output = parseSong("[Verse]\nI see \\[C\\] and \\(G/B\\) literally", 0, true);

    assert.match(output, /class="song-section-heading verse">\[Verse\]<\/h3>/);
    assert.match(output, /I see \[C\] and \(G\/B\) literally/);
    assert.equal(count(output, 'class="song-chord tooltip"'), 0);
});

test("renders a valid tab block safely between neighboring song content", () => {
    const output = parseSong("[Intro]\nBefore\n{{tab}}\n$1 0 1 3 | $2 1 3\n{{/tab}}\nAfter", 0, true);
    assert.match(output, /class="song-section intro"/);
    assert.match(output, />Before<\/p>/);
    assert.match(output, /<div class="jtab chord-sheet-tab">\$1 0 1 3 \| \$2 1 3<\/div>/);
    assert.match(output, />After<\/p>/);
});

test("bounds tab input and rejects HTML-like ABC notation", () => {
    const oversizedTab = "$1 " + "0 ".repeat(10001);
    const htmlLikeAbc = "X:1\nK:C\nC D E F|\n<script>alert(1)</script>";

    assert.equal(parserContext.isValidTabNotation(oversizedTab), false);
    assert.equal(parserContext.isValidAbcNotation(htmlLikeAbc), false);
});

test("invalid and unclosed tab blocks fail safely without swallowing neighbors", () => {
    const invalid = parseSong("Before\n{{tab}}\nnot tab notation\n{{/tab}}\nAfter", 0, false);
    const unclosed = parseSong("Before\n{{tab}}\n<script>alert(1)<\/script>\nAfter", 0, false);
    assert.match(invalid, /class="chord-sheet-tab-error">not tab notation<\/div>/);
    assert.match(invalid, />After<\/p>/);
    assert.doesNotMatch(unclosed, /class="jtab chord-sheet-tab"|<script>/);
    assert.match(unclosed, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(unclosed, />After<\/p>/);
});
test("preserves documented standalone JTab custom chords", () => {
    const source = "%7/2.X/X.7/3.7/4.6/1.X/X[Bm7b5]";
    const interactive = parseSong(source, 0, true);
    const exported = parseSong(source, 0, false);

    assert.match(
        interactive,
        /<div class="song-custom-chord"><span class="jtab">%7\/2\.X\/X\.7\/3\.7\/4\.6\/1\.X\/X\[Bm7b5\]<\/span><\/div>/
    );
    assert.doesNotMatch(interactive, /class="song-chord tooltip"/);
    assert.doesNotMatch(exported, /class="jtab"|tooltip/);
    assert.match(exported, /class="song-chord"[^>]*>Bm7b5<\/span>/);
});


test("renders valid ABC notation blocks and rejects malformed notation", () => {
    const valid = parseSong(
        "Before\n{{notation}}\nX:1\nM:4/4\nK:C\nCDEF|GABc|\n{{/notation}}\nAfter",
        0,
        false
    );
    const invalid = parseSong(
        "{{notation}}\nK:C\n<script>alert(1)</script>\n{{/notation}}",
        0,
        false
    );

    assert.match(valid, /class="song-staff"/);
    assert.match(valid, /class="song-notation-source" hidden/);
    assert.match(valid, /X:1[\s\S]*K:C[\s\S]*CDEF\|GABc\|/);
    assert.match(valid, />After<\/p>/);
    assert.match(invalid, /class="song-notation-error" role="alert"/);
    assert.doesNotMatch(invalid, /<script>/);
});

test("renders notation through the responsive screen renderer", () => {
    const attributes = {};
    const source = { textContent: "X:1\nM:4/4\nK:C\nCDEF|" };
    const block = {
        className: "song-staff",
        innerHTML: "source",
        textContent: "",
        querySelector() { return source; },
        setAttribute(name, value) { attributes[name] = value; }
    };
    const scope = {
        querySelectorAll(selector) {
            assert.equal(selector, ".song-staff:not([data-notation-rendered])");
            return [block];
        }
    };
    const calls = [];
    const context = loadScript({
        ABCJS: {
            renderAbc(element, notation, options) {
                calls.push({ element, notation, options: { ...options } });
            }
        }
    });

    assert.equal(context.renderNotationBlocks(scope), 1);
    assert.equal(attributes["data-notation-rendered"], "true");
    assert.equal(attributes.role, "img");
    assert.equal(attributes["aria-label"], "Rendered musical notation");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].element, block);
    assert.equal(calls[0].options.responsive, "resize");
    assert.equal(calls[0].options.oneSvgPerLine, true);
    assert.equal(Object.hasOwn(calls[0].options, "print"), false);
});

test("builds clean exports with optional metadata and no tooltip markup", () => {
    function createNode() {
        return {
            children: [],
            innerHTML: "",
            style: {},
            appendChild(child) { this.children.push(child); }
        };
    }
    const metadataClone = { kind: "metadata-clone" };
    const metadata = {
        cloneNode(deep) {
            assert.equal(deep, true);
            return metadataClone;
        }
    };
    const document = {
        addEventListener() {},
        createElement() { return createNode(); }
    };
    const song = {
        dataset: {
            exportMetadata: "1",
            transpose: "0",
            instrument: "guitar"
        },
        ownerDocument: document,
        style: {
            getPropertyValue(name) {
                assert.equal(name, "--cs-export-font-family");
                return 'Georgia, "Times New Roman", serif';
            }
        },
        parentNode: {
            querySelector(selector) {
                assert.equal(selector, ".song-metadata");
                return metadata;
            }
        },
        rawText: "C"
    };
    const context = loadScript({ document });
    const exported = context.createChordSheetExportNode(song);

    assert.equal(exported.children[0], metadataClone);
    assert.equal(exported.className, "chord-sheet-export");
    assert.match(exported.children[1].innerHTML, /class="song-chord"/);
    assert.equal(exported.style.fontFamily, 'Georgia, "Times New Roman", serif');
    assert.doesNotMatch(exported.children[1].innerHTML, /tooltip|jtab/);
    song.dataset.exportMetadata = "0";
    assert.equal(context.createChordSheetExportNode(song).children.length, 1);
});



test("renders tablature and notation for the Word export", () => {
    const notationSource = { textContent: "X:1\nK:C\nC D E F" };
    const notationBlock = {
        className: "song-staff",
        innerHTML: "source",
        textContent: "",
        querySelector(selector) {
            assert.equal(selector, ".song-notation-source");
            return notationSource;
        },
        setAttribute() {}
    };
    const scope = {
        querySelectorAll(selector) {
            assert.equal(selector, ".song-staff:not([data-notation-rendered])");
            return [notationBlock];
        }
    };
    let tablatureRenderCount = 0;
    let notationRenderCount = 0;
    const context = loadScript({
        jtab: {
            renderimplicit(node) {
                assert.equal(node, scope);
                tablatureRenderCount++;
            }
        },
        ABCJS: {
            renderAbc(node, notation) {
                assert.equal(node, notationBlock);
                assert.equal(notation, notationSource.textContent);
                notationRenderCount++;
            }
        }
    });

    assert.equal(typeof context.renderChordSheetExportVisuals, "function");
    context.renderChordSheetExportVisuals(scope);
    assert.equal(tablatureRenderCount, 1);
    assert.equal(notationRenderCount, 1);
});

test("converts rendered export SVGs to embedded images before Word copies them", () => {
    const images = [];
    const replacements = [];
    const document = {
        addEventListener() {},
        createElement(tagName) {
            assert.equal(tagName, "img");
            const image = {
                attributes: {},
                setAttribute(name, value) { this.attributes[name] = String(value); }
            };
            images.push(image);
            return image;
        }
    };
    function svg(markup, label, width, height) {
        const element = {
            markup,
            ownerDocument: document,
            getAttribute(name) {
                return { "aria-label": label, width, height }[name] || null;
            }
        };
        element.parentNode = {
            replaceChild(image, original) {
                assert.equal(original, element);
                replacements.push({ image, original });
            }
        };
        return element;
    }
    const tabSvg = svg("<svg><text>TAB</text></svg>", "Rendered tablature", "320", "120");
    const notationSvg = svg("<svg><path d=\"M0 0\"/></svg>", "Rendered musical notation", "640", "180");
    const scope = {
        querySelectorAll(selector) {
            assert.equal(selector, ".song-tab svg, .song-staff svg");
            return [tabSvg, notationSvg];
        }
    };
    function XMLSerializer() {
        this.serializeToString = element => element.markup;
    }
    const context = loadScript({ document, XMLSerializer });

    assert.equal(typeof context.replaceExportSvgsWithImages, "function");
    assert.equal(context.replaceExportSvgsWithImages(scope), 2);
    assert.equal(replacements.length, 2);
    assert.equal(images[0].attributes.alt, "Rendered tablature");
    assert.equal(images[0].attributes.width, "320");
    assert.equal(images[0].attributes.height, "120");
    assert.match(images[0].attributes.src, /^data:image\/svg\+xml;charset=utf-8,/);
    assert.match(decodeURIComponent(images[0].attributes.src.split(",")[1]), /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg">/);
    assert.match(
        context.cSheetExportToWord.toString(),
        /renderChordSheetExportVisuals\(node\);\s*replaceExportSvgsWithImages\(node\);/
    );
});


test("rasterizes rendered export SVGs to embedded PNG images", async () => {
    const replacements = [];
    const drawCalls = [];
    const image = {
        attributes: {},
        onload: null,
        onerror: null,
        setAttribute(name, value) {
            this.attributes[name] = String(value);
            if (name === "src" && String(value).indexOf("data:image/svg+xml") === 0) {
                queueMicrotask(() => this.onload());
            }
        }
    };
    const canvasContext = {
        fillStyle: "",
        fillRect() {},
        drawImage(...args) { drawCalls.push(args); }
    };
    const canvas = {
        width: 0,
        height: 0,
        getContext(type) {
            assert.equal(type, "2d");
            return canvasContext;
        },
        toDataURL(type) {
            assert.equal(type, "image/png");
            return "data:image/png;base64,UE5H";
        }
    };
    const document = {
        addEventListener() {},
        createElement(tagName) {
            if (tagName === "img") return image;
            if (tagName === "canvas") return canvas;
            throw new Error("Unexpected element: " + tagName);
        }
    };
    const sourceSvg = {
        markup: "<svg><path d=\"M0 0\"/></svg>",
        ownerDocument: document,
        getAttribute(name) {
            return name === "aria-label" ? "Rendered musical notation" : null;
        },
        getBoundingClientRect() {
            return { width: 320, height: 120 };
        }
    };
    sourceSvg.parentNode = {
        replaceChild(replacement, original) {
            replacements.push({ replacement, original });
        }
    };
    const scope = {
        querySelectorAll(selector) {
            assert.equal(selector, ".song-tab svg, .song-staff svg");
            return [sourceSvg];
        }
    };
    function XMLSerializer() {
        this.serializeToString = element => element.markup;
    }
    const context = loadScript({ document, XMLSerializer });

    assert.equal(typeof context.replaceExportSvgsWithPngImages, "function");
    assert.equal(await context.replaceExportSvgsWithPngImages(scope), 1);
    assert.equal(canvas.width, 640);
    assert.equal(canvas.height, 240);
    assert.equal(drawCalls.length, 1);
    assert.equal(image.attributes.src, "data:image/png;base64,UE5H");
    assert.equal(image.attributes.width, "320");
    assert.equal(image.attributes.height, "120");
    assert.equal(image.attributes.alt, "Rendered musical notation");
    assert.equal(replacements.length, 1);
});

test("starts a promise-backed HTML clipboard write before PNG preparation finishes", async () => {
    let clipboardEntries = null;
    let writeCallCount = 0;
    class ClipboardItem {
        constructor(entries) {
            clipboardEntries = entries;
        }
    }
    class Blob {
        constructor(parts, options) {
            this.parts = parts;
            this.type = options.type;
        }
    }
    const navigator = {
        clipboard: {
            write(items) {
                assert.equal(items.length, 1);
                writeCallCount++;
                return Promise.all([
                    clipboardEntries["text/html"],
                    clipboardEntries["text/plain"]
                ]).then(() => undefined);
            }
        }
    };
    const exportNode = {
        outerHTML: "<div><img src=\"data:image/png;base64,UE5H\"></div>",
        textContent: "Tab and notation",
        querySelectorAll() { return []; }
    };
    const context = loadScript({
        Blob,
        ClipboardItem,
        navigator
    });

    assert.equal(typeof context.writeWordExportToClipboard, "function");
    const clipboardJob = context.writeWordExportToClipboard(exportNode);
    assert.equal(writeCallCount, 1);
    await clipboardJob.write;
    await clipboardJob.preparation;
    const htmlBlob = await clipboardEntries["text/html"];
    const textBlob = await clipboardEntries["text/plain"];
    assert.equal(htmlBlob.type, "text/html");
    assert.equal(htmlBlob.parts[0], exportNode.outerHTML);
    assert.equal(textBlob.type, "text/plain");
    assert.equal(textBlob.parts[0], exportNode.textContent);
});

test("falls back to the selected-node copy when modern clipboard writing is rejected", async () => {
    let copiedNode = null;
    let execCommandCount = 0;
    let removedNode = null;
    let selectionClearCount = 0;
    const alerts = [];
    class ClipboardItem {
        constructor(entries) {
            this.entries = entries;
        }
    }
    class Blob {
        constructor(parts, options) {
            this.parts = parts;
            this.type = options.type;
        }
    }
    const selection = {
        removeAllRanges() { selectionClearCount++; },
        addRange() {}
    };
    const document = {
        addEventListener() {},
        createRange() {
            return {
                selectNode(node) { copiedNode = node; }
            };
        },
        execCommand(command) {
            assert.equal(command, "copy");
            execCommandCount++;
            return true;
        }
    };
    const song = {
        removeChild(node) {
            removedNode = node;
            node.parentNode = null;
        }
    };
    const exportNode = {
        outerHTML: "<div><img src=\"data:image/png;base64,UE5H\"></div>",
        textContent: "Tab and notation",
        parentNode: song,
        querySelectorAll() { return []; }
    };
    const context = loadScript({
        Blob,
        ClipboardItem,
        document,
        navigator: {
            clipboard: {
                write() { return Promise.reject(new Error("permission denied")); }
            }
        },
        window: { getSelection() { return selection; } },
        alert(message) { alerts.push(message); }
    });

    assert.equal(context.copyChordSheetExportWithClipboard(song, exportNode), true);
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(copiedNode, exportNode);
    assert.equal(execCommandCount, 1);
    assert.equal(removedNode, exportNode);
    assert.ok(selectionClearCount > 0);
    assert.deepEqual(alerts, [
        "successfully copied song to clipboard. Use CTRL + V to paste it in your word document."
    ]);
});
test("falls back to SVG images when PNG preparation fails", async () => {
    let clipboardEntries = null;
    let copiedNode = null;
    let replacement = null;
    let removedNode = null;
    const alerts = [];
    class ClipboardItem {
        constructor(entries) {
            clipboardEntries = entries;
        }
    }
    class Blob {
        constructor(parts, options) {
            this.parts = parts;
            this.type = options.type;
        }
    }
    class XMLSerializer {
        serializeToString() {
            return "<svg width=\"320\" height=\"120\"></svg>";
        }
    }
    const image = {
        attributes: {},
        setAttribute(name, value) {
            this.attributes[name] = String(value);
            if (name === "src" && this.onerror) {
                queueMicrotask(() => this.onerror());
            }
        }
    };
    const canvas = {
        getContext() {
            return {
                fillRect() {},
                drawImage() {}
            };
        }
    };
    const document = {
        addEventListener() {},
        createElement(tagName) {
            return tagName === "canvas" ? canvas : image;
        },
        createRange() {
            return {
                selectNode(node) { copiedNode = node; }
            };
        },
        execCommand(command) {
            assert.equal(command, "copy");
            return true;
        }
    };
    const svg = {
        ownerDocument: document,
        getAttribute(name) {
            if (name === "aria-label") return "Rendered notation";
            if (name === "width") return "320";
            if (name === "height") return "120";
            return "";
        },
        getBoundingClientRect() {
            return { width: 320, height: 120 };
        },
        parentNode: {
            replaceChild(next, previous) {
                assert.equal(previous, svg);
                replacement = next;
            }
        }
    };
    const song = {
        removeChild(node) {
            removedNode = node;
            node.parentNode = null;
        }
    };
    const exportNode = {
        outerHTML: "<div><svg></svg></div>",
        textContent: "Notation",
        parentNode: song,
        querySelectorAll(selector) {
            if (selector !== ".song-tab svg, .song-staff svg") return [];
            return replacement ? [] : [svg];
        }
    };
    const context = loadScript({
        Blob,
        ClipboardItem,
        document,
        XMLSerializer,
        navigator: {
            clipboard: {
                write() {
                    return Promise.all([
                        clipboardEntries["text/html"],
                        clipboardEntries["text/plain"]
                    ]).then(() => undefined);
                }
            }
        },
        window: {
            getSelection() {
                return {
                    addRange() {},
                    removeAllRanges() {}
                };
            }
        },
        alert(message) { alerts.push(message); }
    });

    assert.equal(context.copyChordSheetExportWithClipboard(song, exportNode), true);
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(copiedNode, exportNode);
    assert.equal(removedNode, exportNode);
    assert.equal(replacement.attributes.alt, "Rendered notation");
    assert.match(replacement.attributes.src, /^data:image\/svg\+xml;charset=utf-8,/);
    assert.deepEqual(alerts, [
        "successfully copied song to clipboard. Use CTRL + V to paste it in your word document."
    ]);
});
test("cleans up the temporary Word export when tablature rendering fails", () => {
    const exportNode = {
        children: [],
        appendChild(child) { this.children.push(child); },
        querySelectorAll() { return []; }
    };
    const contentNode = { innerHTML: "" };
    let createdElements = 0;
    let attachedNode = null;
    let removedNode = null;
    let selectionClearCount = 0;
    const alerts = [];
    const song = {
        dataset: { exportMetadata: "0", transpose: "0", instrument: "guitar" },
        ownerDocument: null,
        parentNode: { querySelector() { return null; } },
        rawText: "{{tab}}\\n$2 0 1 3\\n{{/tab}}",
        appendChild(node) { attachedNode = node; },
        removeChild(node) {
            assert.equal(node, attachedNode);
            removedNode = node;
            attachedNode = null;
        }
    };
    const document = {
        addEventListener() {},
        createElement() {
            createdElements++;
            return createdElements === 1 ? exportNode : contentNode;
        },
        getElementById() { return song; }
    };
    song.ownerDocument = document;
    const context = loadScript({
        document,
        window: {
            getSelection() {
                return {
                    removeAllRanges() { selectionClearCount++; },
                    addRange() {}
                };
            }
        },
        alert(message) { alerts.push(message); },
        jtab: { renderimplicit() { throw new Error("render failed"); } }
    });

    assert.doesNotThrow(() => context.cSheetExportToWord("song-export"));
    assert.equal(removedNode, exportNode);
    assert.equal(attachedNode, null);
    assert.equal(selectionClearCount, 2);
    assert.deepEqual(alerts, ["Oops, unable to prepare song for copying"]);
});
test("enhances Chordsheets color settings with synchronized native color pickers", () => {
    const textListeners = Object.create(null);
    const pickerListeners = Object.create(null);
    const inserted = [];
    const picker = {
        attributes: {},
        value: "",
        setAttribute(name, value) {
            this.attributes[name] = String(value);
        },
        addEventListener(type, listener) {
            pickerListeners[type] = listener;
        }
    };
    const ownerDocument = {
        createElement(tagName) {
            assert.equal(tagName, "input");
            return picker;
        }
    };
    const parentNode = {
        insertBefore(node, reference) {
            inserted.push({ node, reference });
        }
    };
    const textInput = {
        id: "config___plugin____chordsheets____chord_color",
        labels: [{ textContent: "Chord color" }],
        ownerDocument,
        parentNode,
        value: "#abc",
        addEventListener(type, listener) {
            textListeners[type] = listener;
        }
    };
    const scope = {
        querySelectorAll(selector) {
            assert.match(selector, /chord_color/);
            assert.match(selector, /lyric_color/);
            assert.match(selector, /section_color/);
            assert.match(selector, /section_background/);
            return [textInput];
        }
    };
    const context = loadScript();

    assert.equal(typeof context.initializeChordSheetColorSettings, "function");
    assert.equal(context.initializeChordSheetColorSettings(scope), 1);
    assert.equal(inserted.length, 1);
    assert.equal(inserted[0].node, picker);
    assert.equal(inserted[0].reference, textInput);
    assert.equal(picker.attributes.type, "color");
    assert.equal(picker.attributes.class, "chordsheets-color-picker");
    assert.equal(picker.attributes["aria-label"], "Choose Chord color");
    assert.equal(picker.value, "#aabbcc");

    picker.value = "#123456";
    pickerListeners.input();
    assert.equal(textInput.value, "#123456");

    textInput.value = "#fed";
    textListeners.input();
    assert.equal(picker.value, "#ffeedd");

    textInput.value = "not-a-color";
    textListeners.input();
    assert.equal(picker.value, "#ffeedd");

    assert.equal(context.initializeChordSheetColorSettings(scope), 0);
    assert.equal(inserted.length, 1);
});
test("initializes color pickers after late script loads and DokuWiki content replacements", () => {
    const documentListeners = Object.create(null);
    const inserted = [];
    let activeInput;

    function createSetting(label) {
        const picker = {
            value: "",
            setAttribute() {},
            addEventListener() {}
        };
        const input = {
            labels: [{ textContent: label }],
            ownerDocument: {
                createElement() { return picker; }
            },
            parentNode: {
                insertBefore(node, reference) {
                    inserted.push({ node, reference });
                }
            },
            value: "#123456",
            addEventListener() {}
        };
        return { input, picker };
    }

    function colorScope() {
        return {
            querySelectorAll(selector) {
                return selector.includes("chordsheets____chord_color") ? [activeInput] : [];
            }
        };
    }

    const initial = createSetting("Chord color");
    activeInput = initial.input;
    const initialScope = colorScope();
    const document = {
        ...initialScope,
        readyState: "complete",
        addEventListener(type, listener) {
            documentListeners[type] = listener;
        }
    };

    loadScript({ document });
    assert.equal(inserted.length, 1);
    assert.equal(inserted[0].node, initial.picker);

    const replacement = createSetting("Chord color");
    activeInput = replacement.input;
    documentListeners.dw_page_loaded({ detail: { root: colorScope() } });
    assert.equal(inserted.length, 2);
    assert.equal(inserted[1].node, replacement.picker);
});
function createSong(rawText, transpose = "0", instrument = "guitar") {
    return {
        dataset: { transpose, instrument },
        innerHTML: rawText
    };
}

function createChord() {
    const listeners = Object.create(null);
    return {
        dataset: {},
        listeners,
        addEventListener(type) {
            listeners[type] = (listeners[type] || 0) + 1;
        }
    };
}

function createScope(songs, chords = []) {
    return {
        querySelectorAll(selector) {
            if (selector === ".song-with-chords") {
                return songs;
            }
            if (selector === ".song-chord.tooltip") {
                return chords;
            }
            return [];
        },
        querySelector() {
            return null;
        }
    };
}

test("initializes initial and AJAX-replaced sheets idempotently without duplicate listeners", () => {
    const documentListeners = Object.create(null);
    const windowListenerCounts = Object.create(null);
    const firstChord = createChord();
    const firstSong = createSong("C");
    const firstScope = createScope([firstSong], [firstChord]);
    const document = {
        ...firstScope,
        documentElement: { clientWidth: 800, clientHeight: 600 },
        addEventListener(type, listener) {
            documentListeners[type] = listener;
        }
    };
    const window = {
        addEventListener(type) {
            windowListenerCounts[type] = (windowListenerCounts[type] || 0) + 1;
        }
    };
    const renderScopes = [];
    const context = loadScript({
        document,
        window,
        jtab: {
            renderimplicit(scope) {
                renderScopes.push(scope);
            }
        }
    });

    assert.equal(typeof documentListeners.DOMContentLoaded, "function");
    assert.equal(typeof documentListeners.dw_page_loaded, "function");

    documentListeners.DOMContentLoaded();
    const initiallyRendered = firstSong.innerHTML;
    documentListeners.DOMContentLoaded();
    assert.equal(firstSong.innerHTML, initiallyRendered);
    assert.equal(firstSong.dataset.chordsheetsInitialized, "true");
    assert.equal(firstChord.listeners.mouseenter, 1);
    assert.equal(firstChord.listeners.focus, 1);

    const secondChord = createChord();
    const secondSong = createSong("D");
    const secondScope = createScope([secondSong], [secondChord]);
    documentListeners.dw_page_loaded({ detail: { root: secondScope } });
    const secondRendered = secondSong.innerHTML;
    documentListeners.dw_page_loaded({ detail: { root: secondScope } });
    assert.equal(secondSong.innerHTML, secondRendered);
    assert.equal(secondChord.listeners.mouseenter, 1);
    assert.equal(secondChord.listeners.focus, 1);

    const thirdChord = createChord();
    const thirdSong = createSong("E");
    const thirdScope = createScope([thirdSong], [thirdChord]);
    documentListeners.dw_page_loaded({ detail: { root: thirdScope } });
    assert.equal(thirdSong.dataset.chordsheetsInitialized, "true");
    assert.equal(thirdChord.listeners.mouseenter, 1);
    assert.equal(thirdChord.listeners.focus, 1);
    assert.equal(windowListenerCounts.resize, 1);
    assert.equal(windowListenerCounts.scroll, 1);
    assert.equal(renderScopes.length, 3);
    assert.equal(renderScopes[0], document);
    assert.equal(renderScopes[1], secondScope);
    assert.equal(renderScopes[2], thirdScope);
    assert.equal(typeof context.ready, "function");
});
