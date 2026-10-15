# Third-party components

## KaTeX

The vendored files in `dist/vendor/katex/` are from KaTeX 0.19.0.
Source: https://github.com/KaTeX/KaTeX
License: MIT; the original license is included at
[`dist/vendor/katex/LICENSE`](dist/vendor/katex/LICENSE).
The standalone `Paperdesk.html` embeds its scripts, styles and fonts.

## Fonts

The UI optionally loads DM Sans and Noto Sans SC from Google Fonts.
Without access to that service, system fonts are used. KaTeX formula fonts
are bundled locally with KaTeX.

The logo's letter outline was derived from the locally installed Georgia
typeface. The Georgia font file is not distributed with this project.

These notices describe third-party assets; they do not grant a license for
the rest of the project. The repository owner should select a project
license before offering the code under open-source terms.

## markdown-it

The vendored Markdown parser is markdown-it 15.0.2, distributed under the MIT license.
Source: https://github.com/markdown-it/markdown-it
Original license: [dist/vendor/markdown-it/LICENSE](dist/vendor/markdown-it/LICENSE).
Its browser bundle is also embedded in Paperdesk.html. Raw HTML parsing is disabled.
