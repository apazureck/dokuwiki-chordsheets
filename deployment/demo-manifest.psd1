@{
    DokuWiki = @{
        Version  = '2026-07-14a'
        RootName = 'dokuwiki-2026-07-14a'
        Url      = 'https://download.dokuwiki.org/src/dokuwiki/dokuwiki-2026-07-14a.tgz'
        Sha256   = '88a4a37bba7353b883610bbb738c30472af9d4254bd7064495a106f2e8086de3'
    }

    PluginRuntime = @(
        'conf'
        'demo'
        'img'
        'js'
        'plugin.info.txt'
        'script.js'
        'style.css'
        'syntax.php'
    )

    MutableDokuWikiPaths = @(
        '.git'
        '.github'
        '.gitignore'
        '.travis.yml'
        '.tx'
        '_test'
        'data'
        'conf/local.php'
        'conf/local.php.bak'
        'conf/users.auth.php'
        'conf/users.auth.php.bak'
        'conf/acl.auth.php'
        'conf/acl.auth.php.bak'
    )

    ForbiddenReleasePaths = @(
        'install.php'
        'data/'
        '.git/'
        '.github/'
        '.vscode/'
        '.codex_tmp/'
        'docker/'
        '_test/'
        'released/'
        'compose.yaml'
        'README.md'
        'CHANGELOG.md'
        'test.html'
    )
}
