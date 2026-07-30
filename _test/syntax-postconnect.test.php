<?php

declare(strict_types=1);

define('DOKU_INC', __DIR__ . DIRECTORY_SEPARATOR);

class DokuWiki_Syntax_Plugin
{
    /** @var LexerSpy */
    public $Lexer;
}

class LexerSpy
{
    /** @var array<int, array<int, string>> */
    public $calls = array();

    public function addExitPattern(string $pattern, string $plugin): void
    {
        $this->calls[] = array('exit', $pattern, $plugin);
    }

    public function addPattern(string $pattern, string $plugin): void
    {
        $this->calls[] = array('pattern', $pattern, $plugin);
    }
}

set_error_handler(
    static function (
        int $severity,
        string $message,
        string $file,
        int $line
    ): bool {
        throw new ErrorException($message, 0, $severity, $file, $line);
    }
);

try {
    require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'syntax.php';

    $plugin = new syntax_plugin_chordsheets();
    $lexer = new LexerSpy();
    $plugin->Lexer = $lexer;
    $plugin->postConnect();

    $expected = array(
        array('exit', '</chordSheet>', 'plugin_chordsheets'),
        array('pattern', '%.*?\[\w+\]', 'plugin_chordsheets'),
    );

    if ($lexer->calls !== $expected) {
        throw new RuntimeException(
            'postConnect() registered unexpected lexer calls: ' .
            var_export($lexer->calls, true)
        );
    }
} finally {
    restore_error_handler();
}

fwrite(STDOUT, "syntax-postconnect.test.php: PASS\n");
