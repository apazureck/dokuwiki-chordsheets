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
    public function connectTo($mode) { $this->Lexer->addEntryPattern('<chordSheet.*?>(?=.*?</chordSheet>)',$mode,'plugin_chordsheets'); }
    public function postConnect() { $this->Lexer->addExitPattern('</chordSheet>','plugin_chordsheets'); }
 
    /**
     * Handle the match
     */
    public function handle($match, $state, $pos, Doku_Handler $handler){
        switch ($state) {
          case DOKU_LEXER_ENTER :
                $re = '/^<chordSheet.*?([-+]?\d+)>/';
                $transpose = 0;
                preg_match($re, $match, $matches, PREG_OFFSET_CAPTURE, 0);
                if(count($matches) > 0) {
                    $transpose = $matches[1];
                }
                return array($state, $transpose);
 
          case DOKU_LEXER_UNMATCHED :  return array($state, $match);
          case DOKU_LEXER_EXIT :       return array($state, '');
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
                    list($transpose) = $match;
                    $id = mt_rand();
                    $renderer->doc .= '<div class="cSheetButtonBar"><span class=cSheetButtons><button onclick="cSheetExportToWord('.$id.')">Export to Word</button></span></div>';
                    $renderer->doc .= '<div class="song-with-chords" id="'.$id.'" data-transpose="'.$transpose.'">';
                    // $renderer->doc .= 'Filter: <form class="searchtable" onsubmit="return false;"><input class="searchtable" name="filtertable" b="searchtable.filterall(this, \''.$id.'\')" type="text"></form>';
 
                case DOKU_LEXER_UNMATCHED :  
                    $renderer->doc .= $renderer->_xmlEntities($match); 
                    break;
                case DOKU_LEXER_EXIT :       
                    $renderer->doc .= "</div>"; 
                    break;
            }
            return true;
        }
        return false;
    }
 
    /**
     * Validate color value $c
     * this is cut price validation - only to ensure the basic format is correct and there is nothing harmful
     * three basic formats  "colorname", "#fff[fff]", "rgb(255[%],255[%],255[%])"
     */
    private function _isValid($c) {
        $c = trim($c);
 
        $pattern = "/^\s*(
            ([a-zA-z]+)|                                #colorname - not verified
            (\#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}))|        #colorvalue
            (rgb\(([0-9]{1,3}%?,){2}[0-9]{1,3}%?\))     #rgb triplet
            )\s*$/x";
 
        if (preg_match($pattern, $c)) return trim($c);
 
        return "";
    }
}

