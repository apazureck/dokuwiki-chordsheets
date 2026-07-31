<?php
/**
 * Options for the chordsheets plugin
 *
 * @author Andreas Pazureck <andreas@pazureck.de>
 */


$meta['chord_color'] = array('string', '_pattern' => '/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/');
$meta['lyric_color'] = array('string', '_pattern' => '/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/');
$meta['font_family'] = array('string');
$meta['lyrics_font_size'] = array('numeric', '_min' => 0.75, '_max' => 2.5);
$meta['chords_font_size'] = array('numeric', '_min' => 0.75, '_max' => 2.5);
$meta['line_spacing'] = array('numeric', '_min' => 1, '_max' => 3);
$meta['section_color'] = array('string', '_pattern' => '/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/');
$meta['section_background'] = array('string', '_pattern' => '/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/');
$meta['section_spacing'] = array('numeric', '_min' => 0, '_max' => 4);
$meta['tooltip_behavior'] = array('multichoice', '_choices' => array('hover_focus', 'hover', 'disabled'));
$meta['section_style'] = array('multichoice', '_choices' => array('accented', 'plain'));
$meta['export_include_metadata'] = array('onoff');
$meta['export_font_family'] = array('string');

