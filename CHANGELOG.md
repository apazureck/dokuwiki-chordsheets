# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2018-08-01

### Fixed

* Chords do not get rendered when ajax request occurred (for example after editing a page)

## [0.1.0] - 2018-07-30

### Added

* It is possible to add whole chord sheets with a ultimate-uitar-ish syntax, hightlighting chords and sections
* Export method to word
* Chords are displayed on a fretboard when hovering
* Adding custom chords using the [jtab](http://jtab.tardate.com/) syntax `%...[<chordname>]` *This may change in the future being wrapped by `<chord></chord>`*