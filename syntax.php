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
        $this->Lexer->addSpecialPattern('%.*?\[\w+\]', $mode,'plugin_chordsheets');
    }
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
          case DOKU_LEXER_SPECIAL:     return array($state, $match);
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
                case DOKU_LEXER_SPECIAL:
                    $renderer->doc .= '<span class="jtab">'.$match.'</span>';
                break;
            }
            return true;
        }
        return false;
    }
}