<?php
/**
 * DokuWiki Plugin chordsheets (Syntax Component)
 *
 * @license GPL-2.0-or-later
 * @author  Andreas Pazureck <andreas@pazureck.de>
 */

if (!defined('DOKU_INC')) {
    die();
}

class syntax_plugin_chordsheets extends DokuWiki_Syntax_Plugin
{
    private $defaults = array(
        'chord_color' => '#c94f2d',
        'lyric_color' => '#26312b',
        'font_family' => 'ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace',
        'lyrics_font_size' => 1.0,
        'chords_font_size' => 1.0,
        'line_spacing' => 1.7,
        'section_color' => '#405347',
        'section_background' => '#fff2d7',
        'section_spacing' => 1.25,
        'tooltip_behavior' => 'hover_focus',
        'section_style' => 'accented',
        'export_include_metadata' => 1,
        'export_font_family' => 'Georgia, "Times New Roman", serif',
    );

    public function getType() { return 'formatting'; }
    public function getAllowedTypes() { return array(); }
    public function getPType() { return 'block'; }
    public function getSort() { return 158; }

    public function connectTo($mode)
    {
        $tag = '<chordSheet(?:(?:"[^"]*"|\'[^\']*\'|[^>])*)>';
        $this->Lexer->addEntryPattern($tag . '(?=.*?</chordSheet>)', $mode, 'plugin_chordsheets');
    }

    public function postConnect()
    {
        $this->Lexer->addExitPattern('</chordSheet>', 'plugin_chordsheets');
        $this->Lexer->addPattern('%.*?\\[\\w+\\]', 'plugin_chordsheets');
    }

    public function handle($match, $state, $pos, Doku_Handler $handler)
    {
        switch ($state) {
            case DOKU_LEXER_ENTER:
                return array($state, $this->parseOptions($match));
            case DOKU_LEXER_UNMATCHED:
                return array($state, $match);
            case DOKU_LEXER_EXIT:
                return array($state, '');
            case DOKU_LEXER_MATCHED:
                return array($state, $match);
        }
        return array();
    }

    private function parseOptions($tag)
    {
        $options = array('transpose' => 0, 'instrument' => 'guitar', 'metadata' => array());
        $body = preg_replace('/^<chordSheet|>$/i', '', (string) $tag);
        if (preg_match('/(?:^|\\s)([-+]?\\d+)(?=\\s|$)/', $body, $match)) {
            $options['transpose'] = (int) $match[1];
        }

        preg_match_all('/\\b(transpose|instrument|title|author|date)\\s*=\\s*(["\'])(.*?)\\2/is', $body, $attributes, PREG_SET_ORDER);
        foreach ($attributes as $attribute) {
            $name = strtolower($attribute[1]);
            $value = $this->normalizeAttribute($attribute[3]);
            if ($name === 'transpose' && preg_match('/^[-+]?\\d+$/', $value)) {
                $options['transpose'] = (int) $value;
            } elseif ($name === 'instrument') {
                if (in_array(strtolower($value), array('guitar', 'ukulele'), true)) {
                    $options['instrument'] = strtolower($value);
                }
            } elseif ($name === 'date') {
                if ($this->isValidDate($value)) {
                    $options['metadata']['date'] = $this->escape($value);
                }
            } elseif (($name === 'title' || $name === 'author') && $value !== '') {
                $options['metadata'][$name] = $this->escape(substr($value, 0, 500));
            }
        }
        return $options;
    }

    private function normalizeAttribute($value)
    {
        $decoded = html_entity_decode((string) $value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        return trim(preg_replace('/\\s+/u', ' ', $decoded));
    }

    private function isValidDate($value)
    {
        if (!preg_match('/^(\\d{4})-(\\d{2})-(\\d{2})$/', $value, $parts)) {
            return false;
        }
        return checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1]);
    }

    private function escape($value)
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | (defined('ENT_SUBSTITUTE') ? ENT_SUBSTITUTE : 0), 'UTF-8');
    }

    public function render($mode, Doku_Renderer $renderer, $data)
    {
        if ($mode !== 'xhtml') {
            return false;
        }
        list($state, $match) = $data;
        switch ($state) {
            case DOKU_LEXER_ENTER:
                $this->renderStart($renderer, $match);
                break;
            case DOKU_LEXER_UNMATCHED:
                $renderer->doc .= $renderer->_xmlEntities($match);
                break;
            case DOKU_LEXER_EXIT:
                $renderer->doc .= '</div></article>';
                break;
            case DOKU_LEXER_MATCHED:
                $renderer->doc .= '<span class="jtab">' . $renderer->_xmlEntities($match) . '</span>';
                break;
        }
        return true;
    }

    private function renderStart(Doku_Renderer $renderer, $options)
    {
        $id = mt_rand();
        $metadata = isset($options['metadata']) ? $options['metadata'] : array();
        $settings = $this->safeSettings();

        $attributes = array(
            'class="chord-sheet"',
            'data-export-metadata="' . ($settings['export_include_metadata'] ? '1' : '0') . '"',
            'itemscope',
            'itemtype="https://schema.org/MusicComposition"',
        );
        $bodyAttributes = array(
            'class="song-with-chords"',
            'id="' . $id . '"',
            'data-transpose="' . (int) $options['transpose'] . '"',
            'data-instrument="' . $options['instrument'] . '"',
            'data-tooltips="' . ($settings['tooltip_behavior'] === 'disabled' ? '0' : '1') . '"',
            'data-tooltip-behavior="' . $settings['tooltip_behavior'] . '"',
            'data-section-style="' . $settings['section_style'] . '"',
            'data-export-metadata="' . ($settings['export_include_metadata'] ? '1' : '0') . '"',
        );
        foreach (array('title', 'author', 'date') as $field) {
            if (isset($metadata[$field])) {
                $attributes[] = 'data-' . $field . '="' . $metadata[$field] . '"';
            }
        }
        $style = $this->styleProperties($settings);
        $attributes[] = 'style="' . $style . '"';
        $bodyAttributes[] = 'style="' . $style . '"';
        $renderer->doc .= '<article ' . implode(' ', $attributes) . '>';
        $this->renderMetadata($renderer, $metadata);
        $renderer->doc .= '<div class="cSheetButtonBar"><span class="cSheetButtons"><button type="button" class="cSheetExportButton" onclick="cSheetExportToWord(' . $id . ')" aria-label="Copy this chord sheet for use in a document">Copy for Word</button></span></div>';
        $renderer->doc .= '<div ' . implode(' ', $bodyAttributes) . '>';
    }

    private function renderMetadata(Doku_Renderer $renderer, $metadata)
    {
        if (count($metadata) === 0) {
            return;
        }
        $renderer->doc .= '<header class="song-metadata">';
        if (isset($metadata['title'])) {
            $renderer->doc .= '<h2 class="chord-sheet-title song-title" itemprop="name">' . $metadata['title'] . '</h2>';
        }
        if (isset($metadata['author'])) {
            $renderer->doc .= '<p class="chord-sheet-author song-author" itemprop="author">' . $metadata['author'] . '</p>';
        }
        if (isset($metadata['date'])) {
            $renderer->doc .= '<time class="chord-sheet-date song-date" datetime="' . $metadata['date'] . '" itemprop="datePublished">' . $metadata['date'] . '</time>';
        }
        $renderer->doc .= '</header>';
    }

    private function safeSettings()
    {
        $settings = $this->defaults;
        $settings['chord_color'] = $this->safeColor($this->configured('chord_color'), $settings['chord_color']);
        $settings['lyric_color'] = $this->safeColor($this->configured('lyric_color'), $settings['lyric_color']);
        $settings['section_color'] = $this->safeColor($this->configured('section_color'), $settings['section_color']);
        $settings['section_background'] = $this->safeColor($this->configured('section_background'), $settings['section_background']);
        $settings['font_family'] = $this->safeFontFamily($this->configured('font_family'), $settings['font_family']);
        $settings['export_font_family'] = $this->safeFontFamily($this->configured('export_font_family'), $settings['export_font_family']);
        $settings['lyrics_font_size'] = $this->boundedNumber($this->configured('lyrics_font_size', 'lyric_font_size'), 0.75, 2.5, $settings['lyrics_font_size']);
        $settings['chords_font_size'] = $this->boundedNumber($this->configured('chords_font_size', 'chord_font_size'), 0.75, 2.5, $settings['chords_font_size']);
        $settings['section_font_size'] = $this->boundedNumber($this->configured('section_font_size'), 0.5, 4, 0.8);
        $settings['line_spacing'] = $this->boundedNumber($this->configured('line_spacing', 'line_height'), 1, 3, $settings['line_spacing']);
        $settings['section_spacing'] = $this->boundedNumber($this->configured('section_spacing'), 0, 4, $settings['section_spacing']);
        $settings['tooltip_behavior'] = $this->safeChoice($this->configured('tooltip_behavior'), array('hover_focus', 'hover', 'disabled'), $settings['tooltip_behavior']);
        $settings['section_style'] = $this->safeChoice($this->configured('section_style'), array('accented', 'plain'), $settings['section_style']);
        $includeMetadata = $this->configured('export_include_metadata');
        if ($includeMetadata !== null) {
            $settings['export_include_metadata'] = (bool) $includeMetadata;
        }
        return $settings;
    }

    private function configured($key, $alias = null)
    {
        $value = $this->getConf($key);
        if ($value === null && $alias !== null) {
            $value = $this->getConf($alias);
        }
        return $value;
    }

    private function safeColor($value, $fallback)
    {
        return is_string($value) && preg_match('/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/', $value) ? $value : $fallback;
    }

    private function safeFontFamily($value, $fallback)
    {
        return is_string($value) && preg_match('/^[a-zA-Z0-9 ,"-]+$/', $value) ? $value : $fallback;
    }

    private function boundedNumber($value, $minimum, $maximum, $fallback)
    {
        if (is_string($value) && preg_match('/^(\\d+(?:\\.\\d+)?)(?:rem|em|px|%)$/', $value, $parts)) {
            $value = (float) $parts[1];
        }
        if (!is_numeric($value)) {
            return $fallback;
        }
        return max($minimum, min($maximum, (float) $value));
    }

    private function safeChoice($value, $allowed, $fallback)
    {
        return in_array($value, $allowed, true) ? $value : $fallback;
    }

    private function styleProperties($settings)
    {
        $properties = array(
            '--cs-chord-color' => $settings['chord_color'],
            '--cs-lyric-color' => $settings['lyric_color'],
            '--cs-font-family' => $settings['font_family'],
            '--cs-lyrics-font-size' => $settings['lyrics_font_size'] . 'rem',
            '--cs-chords-font-size' => $settings['chords_font_size'] . 'rem',
            '--cs-line-spacing' => $settings['line_spacing'],
            '--cs-section-color' => $settings['section_color'],
            '--cs-section-background' => $settings['section_background'],
            '--cs-section-spacing' => $settings['section_spacing'] . 'rem',
            '--cs-export-font-family' => $settings['export_font_family'],
            '--chordsheets-chord-color' => $settings['chord_color'],
            '--chordsheets-lyric-color' => $settings['lyric_color'],
            '--chordsheets-chord-font-size' => $settings['chords_font_size'] . 'rem',
            '--chordsheets-lyric-font-size' => $settings['lyrics_font_size'] . 'rem',
            '--chordsheets-section-font-size' => $settings['section_font_size'] . 'rem',
            '--chordsheets-line-height' => $settings['line_spacing'],
        );
        $pairs = array();
        foreach ($properties as $name => $value) {
            $pairs[] = $name . ':' . $this->escape($value);
        }
        return implode(';', $pairs);
    }
}
