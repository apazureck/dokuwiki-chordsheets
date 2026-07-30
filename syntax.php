<?php
/**
 * DokuWiki Plugin chordsheets (Syntax Component)
 *
 * @license MIT
 * @author  Andreas Pazureck <andreas@pazureck.de>
 */

// must be run within Dokuwiki
if (!defined('DOKU_INC')) {
    die();
}

class syntax_plugin_chordsheets extends DokuWiki_Syntax_Plugin
{
    public function getType(){ return 'formatting'; }
    public function getAllowedTypes() { return array('formatting', 'substition', 'disabled'); }   
    public function getSort(){ return 158; }
    public function connectTo($mode) 
    { 
        $this->Lexer->addEntryPattern('<chordSheet.*?>(?=.*?</chordSheet>)',$mode,'plugin_chordsheets');
    }
    public function postConnect()
    {
        $this->Lexer->addExitPattern('</chordSheet>','plugin_chordsheets');
        $this->Lexer->addPattern('%.*?\[\w+\]', $mode,'plugin_chordsheets');
    }
 
    /**
     * Handle the match
     */
    public function handle($match, $state, $pos, Doku_Handler $handler){
        switch ($state) {
          case DOKU_LEXER_ENTER :
                $transpose  = 0;
                $instrument = 'guitar';

                $re = '/^<chordSheet.*?([-+]?\d+)>/';
                preg_match($re, $match, $matches, PREG_OFFSET_CAPTURE, 0);
                if (count($matches) > 0) {
                    $transpose = $matches[1][0];
                }

                $re_inst = '/\binstrument=["\']?([a-zA-Z]+)["\']?/i';
                preg_match($re_inst, $match, $inst_matches);
                if (count($inst_matches) > 0) {
                    // only allow known instruments to avoid XSS via attribute injection
                    $allowed = array('guitar', 'ukulele');
                    $val = strtolower($inst_matches[1]);
                    if (in_array($val, $allowed)) {
                        $instrument = $val;
                    }
                }

                return array($state, array($transpose, $instrument));
 
          case DOKU_LEXER_UNMATCHED :  return array($state, $match);
          case DOKU_LEXER_EXIT :       return array($state, '');
          case DOKU_LEXER_MATCHED:     return array($state, $match);
        }
        return array();
    }
 
    /**
     * Create output
     */
    public function render($mode, Doku_Renderer $renderer, $data) {
        // $data is what the function handle() return'ed.
        if($mode == 'xhtml'){
            /** @var Doku_Renderer_xhtml $renderer */
            list($state,$match) = $data;
            switch ($state) {
                case DOKU_LEXER_ENTER :
                    list($transpose, $instrument) = $match;
                    $id = mt_rand();
                    $renderer->doc .= '<div class="cSheetButtonBar"><span class=cSheetButtons><button onclick="cSheetExportToWord('.$id.')">Export to Word</button></span></div>';
                    $renderer->doc .= '<div class="song-with-chords" id="'.$id.'" data-transpose="'.((int)$transpose).'" data-instrument="'.htmlspecialchars($instrument, ENT_QUOTES, 'UTF-8').'">';
                    break;
                case DOKU_LEXER_UNMATCHED :  
                    $renderer->doc .= $renderer->_xmlEntities($match); 
                    break;
                case DOKU_LEXER_EXIT :       
                    $renderer->doc .= "</div>"; 
                    break;
                case DOKU_LEXER_MATCHED:
                    $renderer->doc .= '<span class="jtab">'.$match.'</span>';
                    break;
            }
            return true;
        }
        return false;
    }
}
