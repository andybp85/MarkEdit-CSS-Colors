# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- The menu item is now **Extensions → Highlight CSS Colors**. The `extension.cssColors` settings key is unchanged.

## [1.0.0] - 2026-09-04

### Added

- Paints CSS colour literals in the MarkEdit editor and in the MarkEdit-preview pane, with the colour they name, and
  sets the text of the literal to black or white by WCAG relative luminance. A menu item turns it on and off, and the
  state is kept in the `extension.cssColors` key of `settings.json`.
- A library entry point, `dist/lib`, exporting the parser and the DOM painter for a host that cannot load a user
  script.

### Changed

- Replaces the `color-highlight` extension of `markedit-extensions` and the colour painting of the `MarkEdit-preview`
  fork. Neither `extension.colorHighlight` nor `extension.markeditPreview.colorHighlight` is migrated; set
  `extension.cssColors` instead.

### Fixed

- `dist/lib`'s relative imports now carry explicit `.js` extensions, so Node's own ESM resolution (`import()`, not
  just a bundler) can load the library entry point directly.
