"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

test("seeds a local-only DokuWiki demo administrator", () => {
    const localConfig = read("docker/dokuwiki/local.php");
    const users = read("docker/dokuwiki/users.auth.php");
    const acl = read("docker/dokuwiki/acl.auth.php");
    const compose = read("compose.yaml");

    assert.match(localConfig, /\$conf\['useacl'\]\s*=\s*1;/);
    assert.match(localConfig, /\$conf\['authtype'\]\s*=\s*'authplain';/);
    assert.match(localConfig, /\$conf\['superuser'\]\s*=\s*'admin';/);
    assert.match(users, /^admin:\$2[aby]\$/m);
    assert.doesNotMatch(users, /^admin:chordsheets-demo:/m);
    assert.match(users, /:admin,user\s*$/m);
    assert.match(acl, /^\*\s+@ALL\s+1\s*$/m);
    assert.match(compose, /cp \/seed\/users\.auth\.php \/storage\/conf\/users\.auth\.php/);
    assert.match(compose, /cp \/seed\/acl\.auth\.php \/storage\/conf\/acl\.auth\.php/);
    assert.match(compose, /127\.0\.0\.1:\$\{DOKUWIKI_PORT:-8080\}:8080/);
    assert.match(compose, /source: \.\/lang\s+target: \/storage\/lib\/plugins\/chordsheets\/lang/);
});

test("publishes the demo-only administrator credentials and config link", () => {
    const demo = read("demo/start.txt");

    assert.match(demo, /Demo administration/);
    assert.match(demo, /Username:\*\* ''admin''/);
    assert.match(demo, /Password:\*\* ''chordsheets-demo''/);
    assert.match(demo, /\[\[\/start\?do=admin&page=config\|Open configuration manager\]\]/);
    assert.match(demo, /local test server only/i);
});
