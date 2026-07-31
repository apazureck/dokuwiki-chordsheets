const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const css = read("style.css");
const readme = read("README.md");
const demo = read(path.join("demo", "start.txt"));
const compose = read("compose.yaml");
const liveDemo = demo.replace(/<code(?:\s+[^>]*)?>[\s\S]*?<\/code>/gi, "");

function mediaBlock(source, query) {
    const start = source.indexOf(query);
    assert.notEqual(start, -1, `Missing ${query}`);

    let depth = 0;
    let opened = false;
    for (let index = start; index < source.length; index += 1) {
        if (source[index] === "{") {
            depth += 1;
            opened = true;
        } else if (source[index] === "}") {
            depth -= 1;
            if (opened && depth === 0) {
                return source.slice(start, index + 1);
            }
        }
    }

    throw new Error(`Unclosed ${query}`);
}

test("declares and consumes the public chord-sheet CSS custom properties", () => {
    const properties = [
        "--cs-chord-color",
        "--cs-lyric-color",
        "--cs-font-family",
        "--cs-lyrics-font-size",
        "--cs-chords-font-size",
        "--cs-line-spacing",
        "--cs-section-color",
        "--cs-section-background",
        "--cs-export-font-family"
    ];

    for (const property of properties) {
        assert.match(css, new RegExp(`${property}\\s*:`));
        assert.match(css, new RegExp(`var\\(${property}(?:,|\\))`));
    }
});


test("keeps the native settings color picker rule self-contained", () => {
    assert.match(
        css,
        /\.chordsheets-color-picker\s*\{[^}]*width:\s*2\.75rem;\s*\}\s*\.song-with-chords\s*\{/s
    );
});

test("keeps the Word export action visually attached to its sheet", () => {
    assert.match(
        css,
        /\.cSheetButtonBar\s*\{[^}]*justify-content:\s*flex-start[^}]*margin:\s*0\.25rem 0 0\.5rem/s
    );
});

test("applies the configured export font across exported text", () => {
    assert.match(
        css,
        /\.chord-sheet-export[\s\S]*?\.chord-sheet-export \.song-chordLine[\s\S]*?\.chord-sheet-export \.song-textLine[\s\S]*?font-family:\s*var\(--cs-export-font-family\)/
    );
});

test("keeps the plain section-style override as a standalone rule", () => {
    assert.doesNotMatch(css, /\.song-metadata\s*\{\s*\.song-with-chords/);
    assert.match(
        css,
        /\.song-with-chords\[data-section-style=["']plain["']\]\s+\.song-section\s*\{[\s\S]*?background:\s*transparent/
    );
});

test("keeps chord and lyric typography independently configurable", () => {
    assert.match(
        css,
        /\.song-chordLine[\s\S]*?font-family:\s*var\(--cs-font-family\)[\s\S]*?font-size:\s*var\(--cs-chords-font-size\)/
    );
    assert.match(
        css,
        /\.song-textLine[\s\S]*?font-family:\s*var\(--cs-font-family\)[\s\S]*?font-size:\s*var\(--cs-lyrics-font-size\)/
    );
    assert.match(css, /white-space:\s*pre/);
});

test("keeps non-chord tokens in a chord line in the lyric color", () => {
    assert.match(
        css,
        /\.song-chordLine\s*\{[\s\S]*?color:\s*var\(--cs-chord-color\)/
    );
    assert.match(
        css,
        /\.song-chordLine\s+\.song-chord-text\s*,[\s\S]*?\.song-chordLine\s+\.song-annotation\s*\{[\s\S]*?color:\s*var\(--cs-lyric-color\)/
    );
    assert.doesNotMatch(css, /\.song-chordLine\s+\.song-annotation\s*\{[\s\S]*?color:\s*inherit/);
});

test("does not ship the removed browser print and PDF feature", () => {
    assert.equal(fs.existsSync(path.join(root, "print.css")), false);
    assert.doesNotMatch(css, /@media\s+print|data-print-template/i);
    assert.doesNotMatch(readme, /data-print-template|print\/pdf|save as pdf/i);
    assert.doesNotMatch(demo, /print and pdf|save as pdf|print template/i);
    assert.match(compose, /rm -f \/storage\/lib\/plugins\/chordsheets\/print\.css/);
});

test("keeps tablature, staff, and chord diagrams inside narrow viewports", () => {
    assert.match(css, /\.song-tab/);
    assert.match(css, /\.song-staff/);
    assert.match(css, /\.song-diagram/);
    assert.match(css, /\.jtab-ukulele/);
    assert.match(css, /max-width:\s*100%/);
    assert.match(css, /overflow-x:\s*auto/);
});

test("reserves enough height for ukulele tuning labels", () => {
    assert.match(
        css,
        /\.jtab-ukulele\.song-diagram\.is-fretboard\s*\{[^}]*height:\s*124px/s
    );
});

test("documents supported syntax and configuration", () => {
    for (const marker of [
        'title="',
        'author="',
        'date="',
        'instrument="ukulele"',
        '{{tab}}',
        '--cs-chord-color',
        '@{x,3,2,0,1,0}'
    ]) {
        assert.ok(
            readme.includes(marker),
            `README must document ${marker}`
        );
    }

    assert.match(readme, /\[C\].*inline/i);
    assert.match(readme, /escape/i);
    assert.match(readme, /Configuration Manager/i);
    assert.match(demo, /instrument="ukulele"/);
    assert.match(demo, /\{\{tab\}\}/);
    assert.match(demo, /C@\{x,3,2,0,1,0\}/);
});

test("keeps inline syntax examples from opening a live chord-sheet block", () => {
    assert.doesNotMatch(
        liveDemo,
        /^\s+[*-].*''<chordSheet/m
    );
});
test("presents the completed wishlist as an interactive demo tour", () => {
    for (const marker of [
        "Feature tour",
        "Inline chords and slash bass",
        "Ukulele and song metadata",
        "Tablature and standard notation",
        "Alternative voicings"
    ]) {
        assert.ok(demo.includes(marker), `Demo must present ${marker}`);
    }

    assert.match(liveDemo, /\[C\].*\(G\/B\)/);
    assert.match(liveDemo, /instrument="ukulele"[\s\S]*title="[^"]+"/);
    assert.match(liveDemo, /\{\{notation\}\}/);
});

test("includes a live standalone legacy JTab chord", () => {
    assert.match(
        liveDemo,
        /==== Standalone JTab chord ====\s*<chordSheet 0>\s*%7\/2\.X\/X\.7\/3\.7\/4\.6\/1\.X\/X\[Bm7b5\]\s*<\/chordSheet>\s*The original JTab custom-chord syntax[\s\S]*?==== Tablature and standard notation ====/
    );
});

test("includes a live tooltip-alignment example for both viewport edges", () => {
    assert.match(demo, /Tooltip alignment at both edges/);
    assert.match(demo, /C {40,}G/);
});

test("includes a live regression example for long mixed chord lines", () => {
    assert.match(demo, /Long chord lines stay intact/);
    assert.match(demo, /C \| G\/B \(2x\) \?\?\? \| Am7 {4}Fadd9 \|\| Dm7\/G {2}outro/);
});

test("styles voicing choices as a compact visible segmented control", () => {
    assert.match(css, /\.voicing-header\s*\{[\s\S]*?display:\s*flex/);
    assert.match(css, /\.voicing-options\s*\{[\s\S]*?display:\s*inline-flex/);
    assert.match(
        css,
        /\.voicing-option\[aria-pressed=["']true["']\][\s\S]*?background/
    );
    assert.match(css, /\.voicing-option:focus-visible/);
});

test("styles the fretboard and tab switch as an accessible segmented control", () => {
    assert.match(
        css,
        /\.voicing-view-controls\s*\{[\s\S]*?display:\s*inline-flex[\s\S]*?flex-direction:\s*column[\s\S]*?margin:\s*0/
    );
    assert.match(css, /\.tooltip \.tooltiptext\s*\{[\s\S]*?text-align:\s*left/);
    assert.match(css, /\.voicing-view-option\[aria-pressed=["']true["']\][\s\S]*?background/);
    assert.match(css, /\.voicing-view-option:focus-visible/);
    assert.match(css, /\.song-diagram\.is-fretboard/);
    assert.match(css, /\.song-diagram\.is-tab/);
});

test("places diagram view icons in a centered vertical rail", () => {
    assert.match(
        css,
        /\.voicing-diagram-layout\s*\{[^}]*align-items:\s*center[^}]*display:\s*flex/s
    );
    assert.match(
        css,
        /\.voicing-view-controls\s*\{[^}]*flex-direction:\s*column/s
    );
    assert.match(css, /\.voicing-view-icon\s*\{[^}]*height:/s);
    assert.match(css, /\.voicing-view-icon\s*\{[^}]*fill:\s*currentColor/s);
    assert.match(css, /\.voicing-view-icon\s*\{[^}]*stroke:\s*none/s);
    assert.match(css, /\.voicing-view-icon \.tab-label\s*\{[^}]*font-weight:\s*800/s);
    assert.match(css, /\.voicing-view-icon \.tab-marker\s*\{[^}]*stroke-width:\s*2\.1/s);
    assert.match(
        css,
        /\.song-diagram\.is-fretboard\s*\{[^{}]*height:\s*118px[^{}]*\}\s*\.voicing-diagram-layout \.song-diagram\s*\{[^{}]*flex:\s*1 1 auto/s
    );
});



test("uses the runtime arrow offset for viewport-clamped chord tooltips", () => {
    assert.match(
        css,
        /\.tooltip \.tooltiptext::after\s*\{[\s\S]*?left:\s*var\(--cs-tooltip-arrow-left,\s*50%\)/
    );
});

test("extends the popover hover target across the gap to the chord", () => {
    assert.match(
        css,
        /\.tooltip \.tooltiptext::before\s*\{[\s\S]*?height:\s*1\.25rem[\s\S]*?pointer-events:\s*auto/
    );
    assert.match(css, /\.tooltip \.tooltiptext\[data-placement=["']top["']\]::before\s*\{[\s\S]*?top:\s*100%/);
    assert.match(
        css,
        /\.tooltip \.tooltiptext\[data-placement=["']bottom["']\]::before\s*\{[\s\S]*?bottom:\s*100%/
    );
});
