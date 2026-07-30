const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const context = {
    console,
    document: {
        addEventListener() {}
    }
};

vm.createContext(context);
vm.runInContext(
    fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8"),
    context
);

const calculatePosition = context.calculateChordTooltipPosition;
const position = (...args) => ({ ...calculatePosition(...args) });

test("places a chord tooltip above the chord when enough space exists", () => {
    assert.equal(typeof calculatePosition, "function");

    assert.deepEqual(
        position(
            { left: 200, right: 240, top: 200, bottom: 220, width: 40 },
            { width: 120, height: 100 },
            { width: 640, height: 800 }
        ),
        { left: 160, top: 92, placement: "top" }
    );
});

test("flips a chord tooltip below the chord near the viewport top", () => {
    assert.deepEqual(
        position(
            { left: 200, right: 240, top: 50, bottom: 70, width: 40 },
            { width: 120, height: 100 },
            { width: 640, height: 800 }
        ),
        { left: 160, top: 78, placement: "bottom" }
    );
});

test("keeps a chord tooltip inside the horizontal viewport gutter", () => {
    assert.deepEqual(
        position(
            { left: 600, right: 620, top: 200, bottom: 220, width: 20 },
            { width: 150, height: 100 },
            { width: 640, height: 800 }
        ),
        { left: 482, top: 92, placement: "top" }
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
