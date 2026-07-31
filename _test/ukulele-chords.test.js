const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
    path.join(__dirname, "..", "js", "ukulele-chords.js"),
    "utf8"
);

function load(overrides = {}) {
    const context = {
        console,
        document: {
            createElement() {
                return { id: "", style: {} };
            },
            querySelectorAll() {
                return [];
            }
        },
        getComputedStyle() {
            return { color: "#111", backgroundColor: "transparent" };
        },
        ...overrides
    };

    const globalsBefore = new Set(Object.keys(context));
    vm.createContext(context);
    vm.runInContext(source, context);
    const leakedGlobals = Object.keys(context).filter(
        (name) => !globalsBefore.has(name) && name !== "ukulele"
    );

    return { context, leakedGlobals };
}

test("publishes only the documented ukulele renderer API", () => {
    const { context, leakedGlobals } = load();

    assert.deepEqual(leakedGlobals, []);
    assert.equal(typeof context.ukulele, "object");
    assert.equal(typeof context.ukulele.render, "function");
    assert.equal(typeof context.ukulele.renderimplicit, "function");
    assert.equal(typeof context.ukulele.getChord, "function");
});

test("contains four-string GCEA shapes for representative chord families", () => {
    const { context } = load();
    const chord = (name) =>
        JSON.parse(JSON.stringify(context.ukulele.getChord(name)));

    assert.deepEqual(chord("C"), {
        name: "C",
        baseFret: 0,
        tuning: "GCEA",
        frets: [0, 0, 0, 3]
    });
    assert.deepEqual(chord("Am").frets, [2, 0, 0, 0]);
    assert.deepEqual(chord("G7").frets, [0, 2, 1, 2]);
    assert.deepEqual(chord("a#"), chord("Bb"));
    assert.deepEqual(chord("dbm"), chord("C#m"));
});

test("handles an unknown chord without changing its element", () => {
    let raphaelCalls = 0;
    const { context } = load({
        Raphael() {
            raphaelCalls += 1;
        }
    });
    const element = {
        innerHTML: "H13",
        textContent: "H13",
        appendChild() {
            throw new Error("must not append for an unknown chord");
        },
        classList: {
            add() {
                throw new Error("must not mark an unknown chord as rendered");
            }
        }
    };

    assert.equal(context.ukulele.render(element, "H13"), false);
    assert.equal(element.innerHTML, "H13");
    assert.equal(raphaelCalls, 0);
});

test("renders exactly four strings and labels them G C E A", () => {
    const paths = [];
    const texts = [];
    const holderChildren = [];
    const canvases = [];
    const paper = {
        text(x, y, value) {
            texts.push(value);
            return { attr() {} };
        },
        path(value) {
            paths.push(value);
            return { attr() {} };
        },
        circle() {
            return { attr() {} };
        }
    };
    const { context } = load({
        Raphael(id, width, height) {
            canvases.push({ id, width, height });
            return paper;
        }
    });
    const classes = [];
    const element = {
        innerHTML: "C",
        textContent: "C",
        appendChild(child) {
            holderChildren.push(child);
        },
        classList: {
            add(name) {
                classes.push(name);
            }
        }
    };

    assert.equal(context.ukulele.render(element, "C"), true);
    assert.equal(
        paths.filter((value) => /l0 72$/.test(value)).length,
        4
    );
    assert.deepEqual(texts.slice(-4), [
        "G",
        "C",
        "E",
        "A"
    ]);
    assert.equal(holderChildren.length, 1);
    assert.equal(holderChildren[0].style.height, "124px");
    assert.deepEqual(canvases, [{ id: "uku_0", width: 98, height: 124 }]);
    assert.deepEqual(classes, ["rendered"]);
});

test("renderimplicit accepts a DOM scope without constructing a selector from input", () => {
    const calls = [];
    const element = {
        textContent: "unknown",
        innerHTML: "unknown",
        appendChild() {},
        classList: { add() {} }
    };
    const scope = {
        querySelectorAll(selector) {
            calls.push(selector);
            return [element];
        }
    };
    const { context } = load();

    assert.equal(context.ukulele.renderimplicit(scope), 0);
    assert.deepEqual(calls, [".jtab-ukulele:not(.rendered)"]);
});
