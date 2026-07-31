<?php

declare(strict_types=1);

define('DOKU_INC', __DIR__ . DIRECTORY_SEPARATOR);
define('DOKU_LEXER_ENTER', 1);
define('DOKU_LEXER_UNMATCHED', 2);
define('DOKU_LEXER_EXIT', 3);
define('DOKU_LEXER_MATCHED', 4);

class DokuWiki_Syntax_Plugin
{
    /** @var array<string, mixed> */
    public $configuration = array();

    /** @return mixed */
    public function getConf(string $key)
    {
        return array_key_exists($key, $this->configuration)
            ? $this->configuration[$key]
            : null;
    }
}

class Doku_Handler
{
}

class Doku_Renderer
{
    /** @var string */
    public $doc = '';

    public function _xmlEntities(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}

function csAssertSame($expected, $actual, string $message): void
{
    if ($expected !== $actual) {
        throw new RuntimeException(
            $message . "\nExpected: " . var_export($expected, true) .
            "\nActual: " . var_export($actual, true)
        );
    }
}

function csAssertContains(string $needle, string $haystack, string $message): void
{
    if (strpos($haystack, $needle) === false) {
        throw new RuntimeException($message . "\nMissing: " . $needle . "\nIn: " . $haystack);
    }
}

function csAssertNotContains(string $needle, string $haystack, string $message): void
{
    if (strpos($haystack, $needle) !== false) {
        throw new RuntimeException($message . "\nUnexpected: " . $needle . "\nIn: " . $haystack);
    }
}

set_error_handler(
    static function (int $severity, string $message, string $file, int $line): bool {
        throw new ErrorException($message, 0, $severity, $file, $line);
    }
);

try {
    require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'syntax.php';

    $handler = new Doku_Handler();
    $plugin = new syntax_plugin_chordsheets();

    $legacy = $plugin->handle('<chordSheet 0>', DOKU_LEXER_ENTER, 0, $handler);
    csAssertSame(0, $legacy[1]['transpose'], 'Legacy numeric transposition must remain supported.');
    csAssertSame(array(), $legacy[1]['metadata'], 'Legacy tags must not invent metadata.');
    csAssertSame(array(), $plugin->getAllowedTypes(), 'Chord-sheet content must remain raw and must not activate nested wiki syntax.');
    csAssertSame('block', $plugin->getPType(), 'Chord sheets emit block-level article markup.');

    $sourceTabs = $plugin->handle(
        '<chordSheet 0 source="tabs" title="Source example">',
        DOKU_LEXER_ENTER,
        0,
        $handler
    );
    csAssertSame(true, $sourceTabs[1]['source_tabs'], 'Source tabs must be opt-in through source="tabs".');
    $invalidSourceTabs = $plugin->handle(
        '<chordSheet 0 source="tabs-and-script">',
        DOKU_LEXER_ENTER,
        0,
        $handler
    );
    csAssertSame(false, $invalidSourceTabs[1]['source_tabs'], 'Unknown source modes must not enable controls.');

    $sourceRenderer = new Doku_Renderer();
    $plugin->render('xhtml', $sourceRenderer, $sourceTabs);
    $plugin->render('xhtml', $sourceRenderer, array(DOKU_LEXER_UNMATCHED, "[Verse]\nC & <unsafe>"));
    $plugin->render('xhtml', $sourceRenderer, array(DOKU_LEXER_MATCHED, '%0/1.2/2.2/3.1/1.0/0.0/0[C]'));
    $plugin->render('xhtml', $sourceRenderer, array(DOKU_LEXER_EXIT, ''));
    csAssertContains('role="tablist"', $sourceRenderer->doc, 'Opt-in examples must render an accessible tab list.');
    csAssertContains('role="tab"', $sourceRenderer->doc, 'View choices must use tab semantics.');
    csAssertContains('aria-selected="true"', $sourceRenderer->doc, 'The rendered view must be selected initially.');
    csAssertContains('role="tabpanel"', $sourceRenderer->doc, 'Both example views must use tab-panel semantics.');
    csAssertContains('>Ansicht</button>', $sourceRenderer->doc, 'The rendered example tab must be clearly labelled.');
    csAssertContains('>Source</button>', $sourceRenderer->doc, 'The source example tab must be clearly labelled.');
    csAssertContains(
        '&lt;chordSheet 0 source=&quot;tabs&quot; title=&quot;Source example&quot;&gt;',
        $sourceRenderer->doc,
        'The opening DokuWiki tag must be displayed as escaped source.'
    );
    csAssertContains('C &amp; &lt;unsafe&gt;', $sourceRenderer->doc, 'Source text must be escaped against HTML injection.');
    csAssertContains('&lt;/chordSheet&gt;', $sourceRenderer->doc, 'The closing DokuWiki tag must be included in source.');
    csAssertContains('%0/1.2/2.2/3.1/1.0/0.0/0[C]', $sourceRenderer->doc, 'Matched JTab source must remain copyable.');

    $plainRenderer = new Doku_Renderer();
    $plugin->render('xhtml', $plainRenderer, $legacy);
    $plugin->render('xhtml', $plainRenderer, array(DOKU_LEXER_UNMATCHED, 'C'));
    $plugin->render('xhtml', $plainRenderer, array(DOKU_LEXER_EXIT, ''));
    csAssertNotContains('role="tablist"', $plainRenderer->doc, 'Existing chord sheets must stay unchanged by default.');

    $valid = $plugin->handle(
        '<chordSheet -2 title="Rock &amp; Roll" author="A &quot;B&quot;" date="2026-07-30">',
        DOKU_LEXER_ENTER,
        0,
        $handler
    );
    csAssertSame(-2, $valid[1]['transpose'], 'Signed transposition must be parsed.');
    csAssertSame(
        array(
            'title' => 'Rock &amp; Roll',
            'author' => 'A &quot;B&quot;',
            'date' => '2026-07-30',
        ),
        $valid[1]['metadata'],
        'Metadata must be escaped at the parser boundary.'
    );

    $htmlLike = $plugin->handle(
        '<chordSheet title="<img src=x onerror=alert(1)>" author="  Alice' . "\n" . 'Example  " date="2026-02-30">',
        DOKU_LEXER_ENTER,
        0,
        $handler
    );
    csAssertSame(
        array(
            'title' => '&lt;img src=x onerror=alert(1)&gt;',
            'author' => 'Alice Example',
        ),
        $htmlLike[1]['metadata'],
        'HTML-like values must be escaped and impossible dates omitted.'
    );

    $plugin->configuration = array(
        'chord_color' => 'red;position:fixed',
        'lyric_color' => '#123',
        'font_family' => 'monospace;background:url(javascript:alert(1))',
        'lyrics_font_size' => 99,
        'chords_font_size' => 0.1,
        'line_spacing' => 'not-a-number',
        'section_color' => '#abcdef',
        'section_background' => '#fff2d7',
        'section_spacing' => 1.5,
        'tooltip_behavior' => 'disabled',
        'section_style' => 'plain',
        'export_include_metadata' => 0,
        'export_font_family' => 'Georgia, "Times New Roman", serif',
    );

    $renderer = new Doku_Renderer();
    $plugin->render('xhtml', $renderer, $htmlLike);

    csAssertContains('<article class="chord-sheet"', $renderer->doc, 'A chord sheet must use semantic article markup.');
    $articlePosition = strpos($renderer->doc, '<article class="chord-sheet"');
    $metadataPosition = strpos($renderer->doc, '<header class="song-metadata">');
    $exportButtonPosition = strpos($renderer->doc, '<div class="cSheetButtonBar">');
    $songBodyPosition = strpos($renderer->doc, '<div class="song-with-chords"');
    csAssertSame(
        true,
        $articlePosition < $metadataPosition && $metadataPosition < $exportButtonPosition && $exportButtonPosition < $songBodyPosition,
        'The Word export action must sit inside its article directly before the song body.'
    );
    csAssertContains('<div class="song-with-chords"', $renderer->doc, 'The raw song body must be isolated from metadata.');
    csAssertContains('--cs-chord-color:#c94f2d', $renderer->doc, 'Unsafe colors must fall back to defaults.');
    csAssertContains('--cs-lyric-color:#123', $renderer->doc, 'Valid short hex colors must be retained.');
    csAssertContains(
        '--cs-font-family:ui-monospace, &quot;SFMono-Regular&quot;, Consolas, &quot;Liberation Mono&quot;, monospace',
        $renderer->doc,
        'Unsafe font-family values must fall back to the default and remain attribute-escaped.'
    );
    csAssertContains('--cs-lyrics-font-size:2.5rem', $renderer->doc, 'Lyric font size must be capped.');
    csAssertContains('--cs-chords-font-size:0.75rem', $renderer->doc, 'Chord font size must have an accessible lower bound.');
    csAssertContains('--cs-line-spacing:1.7', $renderer->doc, 'Invalid line spacing must fall back.');
    csAssertContains('--cs-section-spacing:1.5rem', $renderer->doc, 'Valid section spacing must be exposed.');
    csAssertContains('data-tooltips="0"', $renderer->doc, 'Disabled diagrams must be exposed to the client.');
    csAssertContains('data-tooltip-behavior="disabled"', $renderer->doc, 'Tooltip behavior must be structured.');
    csAssertContains('data-section-style="plain"', $renderer->doc, 'Section style must be structured.');
    csAssertContains('data-export-metadata="0"', $renderer->doc, 'Export metadata preference must be structured.');
    csAssertNotContains('data-print-template', $renderer->doc, 'Removed print templates must not leak into rendered sheets.');
    csAssertContains('<div class="song-with-chords" id="', $renderer->doc, 'The configurable body must remain addressable.');
    csAssertContains('style="--cs-chord-color:#c94f2d', $renderer->doc, 'Validated CSS settings must be applied directly to the song body.');
    csAssertContains('data-title="&lt;img src=x onerror=alert(1)&gt;"', $renderer->doc, 'Escaped title must be addressable.');
    csAssertContains('<h2 class="chord-sheet-title song-title" itemprop="name">&lt;img src=x onerror=alert(1)&gt;</h2>', $renderer->doc, 'Title must render safely.');
    csAssertContains('<p class="chord-sheet-author song-author" itemprop="author">Alice Example</p>', $renderer->doc, 'Author must use semantic markup.');
    csAssertNotContains('onerror=alert(1)>', $renderer->doc, 'Raw HTML metadata must never reach output.');
    csAssertNotContains('javascript:', $renderer->doc, 'CSS injection attempts must never reach output.');

    $markerRenderer = new Doku_Renderer();
    $plugin->render('xhtml', $markerRenderer, array(
        DOKU_LEXER_UNMATCHED,
        '{{tab}}{{/tab}}{{notation}}{{/notation}}',
    ));
    csAssertSame(
        '{{tab}}{{/tab}}{{notation}}{{/notation}}',
        $markerRenderer->doc,
        'Tab and notation markers must survive DokuWiki parsing unchanged.'
    );

    $conf = array();
    $meta = array();
    include dirname(__DIR__) . DIRECTORY_SEPARATOR . 'conf' . DIRECTORY_SEPARATOR . 'default.php';
    include dirname(__DIR__) . DIRECTORY_SEPARATOR . 'conf' . DIRECTORY_SEPARATOR . 'metadata.php';

    $expectedKeys = array(
        'chord_color',
        'lyric_color',
        'font_family',
        'lyrics_font_size',
        'chords_font_size',
        'line_spacing',
        'section_color',
        'section_background',
        'section_spacing',
        'tooltip_behavior',
        'section_style',
        'export_include_metadata',
        'export_font_family',
    );
    csAssertSame($expectedKeys, array_keys($conf), 'Configuration defaults must declare the supported options.');
    csAssertSame($expectedKeys, array_keys($meta), 'Configuration metadata must match defaults exactly.');
    csAssertSame(
        array('hover_focus', 'hover', 'disabled'),
        $meta['tooltip_behavior']['_choices'],
        'Tooltip behavior must be a constrained enum.'
    );

    $lang = array();
    include dirname(__DIR__) . DIRECTORY_SEPARATOR . 'lang' . DIRECTORY_SEPARATOR . 'en' . DIRECTORY_SEPARATOR . 'settings.php';
    foreach ($expectedKeys as $key) {
        if (!isset($lang[$key]) || trim($lang[$key]) === '') {
            throw new RuntimeException('Missing English setting label for ' . $key . '.');
        }
    }
} finally {
    restore_error_handler();
}

fwrite(STDOUT, "syntax-config-metadata.test.php: PASS\n");
