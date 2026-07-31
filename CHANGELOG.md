# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-07-31

### Added

* Configurable chord-sheet colors, fonts, independent lyric/chord sizes, spacing, section styles, tooltip behavior, and export defaults (#26, #28).
* Ukulele diagrams, alternate guitar voicings, inline chords, slash-chord semantics, tablature blocks, ABC notation, and optional title/author/date metadata (#7, #24, #25, #29, #30, #31, #32).
* Stable explicit guitar-voicing pins using six-string fret shapes in chord lines and inline chords.

### Changed

* Tablature, notation, and chord diagrams now stay responsive on narrow screens.
* Chord-sheet initialization is scoped and idempotent for AJAX page updates.
* Guitar voicing choices now use a compact accessible fret-position control with an authored-pin state and labels derived from the rendered shape.
* Guitar voicing popovers now switch the selected shape between a fretboard diagram and tablature.

### Removed

* Browser-specific print/PDF templates and their configuration, so document output can be handled by a dedicated external tool.

### Fixed

* Word export omits tooltip diagrams and can include configured song metadata (#20).
* Altered and extended chords remain intact during parsing (#21).
* Long chord lines preserve bars, annotations, unknown tokens, and trailing content (#34).
* Chord-sheet tags inside code examples remain literal, while tab and notation markers inside a sheet reach the client-side renderer.
* The invisible hover corridor now keeps chord popovers open while the pointer crosses the visual gap.

## [0.2.0] - 2026-07-30

### Added

* Local Docker-based DokuWiki setup and smoke tests.
* A public demo site with installation guidance and examples.
* Reproducible, verified plugin ZIP packaging and protected release environments.

### Fixed

* Chord diagrams are rendered in a viewport-level tooltip so parent containers no longer clip them.
* Tooltips flip below the chord when there is not enough room above it.
* Lexer registration no longer references an undefined `$mode` variable.

## [0.1.2] - 2025-08-11

### Fixed

* [#4  - Chordsheets parse elements outside of chordsheet](https://github.com/apazureck/dokuwiki-chordsheets/issues/4) tags (Credits: [@mperry2](https://github.com/mperry2))
* [#1  - TypeError: htmlspecialchars](https://github.com/apazureck/dokuwiki-chordsheets/issues/1) (Credits: [@mperry2](https://github.com/mperry2))

## [0.1.1] - 2018-08-01

### Fixed

* Chords do not get rendered when ajax request occurred (for example after editing a page)

## [0.1.0] - 2018-07-30

### Added

* It is possible to add whole chord sheets with a ultimate-uitar-ish syntax, hightlighting chords and sections
* Export method to word
* Chords are displayed on a fretboard when hovering
* Adding custom chords using the [jtab](http://jtab.tardate.com/) syntax `%...[<chordname>]` *This may change in the future being wrapped by `<chord></chord>`*
