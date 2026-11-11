# Rotisserie visual design

Date: 2026-11-10. Companion to `2026-11-10-rotisserie-design.md`. It records the look the user reviewed and where the source files are, so the design does not depend on the online canvases staying available.

## Where things are

| What | In this repo | Online canvas (private to the author) |
|---|---|---|
| UI mockups, three screens | `mockups/Main.dc.html`, `mockups/Dark.dc.html`, `mockups/Summary.dc.html` | https://claude.ai/artifact/92RfaRsxVN836ukogQ4sDQ |
| Logo, as chosen | `logo/logo.svg` | https://claude.ai/artifact/A3yBygYQ4VVm1yaH1WjFaX |
| Favicon, as chosen | `logo/favicon.svg` | same canvas |
| Logo presentation boards | `logo/PolishConnected.dc.html`, `logo/PolishBold.dc.html` | same canvas |

The `.dc.html` files are design-canvas sources. They only render inside that canvas, but their inline-styled markup is plain HTML and CSS and is the reference for layout, spacing and colour. The two `.svg` files open in any browser.

## Status

- The user reviewed the mockups and accepted the direction ("modern and slick, yet relatively minimalistic").
- The mockups and logo paths were written by hand and never rendered by the agent, so small geometry or spacing flaws may remain. The built page is the place to fix them.
- The state colours below are final: they passed the `dataviz` palette validator (`validate_palette.js --pairs all`, every check PASS) in both themes on 2026-11-10. The values first drawn in the mockups failed (invalid red and ember were too close; the dark set was above the lightness band and its red and green merged for deutan vision), so the mockup files still show the old state colours.

## The three screens

- **Session view, light** (`Main.dc.html`): sessions sidebar grouped by project, header with session title and agent status, progress bar, filter chips, the question tree in every state, and the Respond bar pinned to the bottom.
- **Agent working, dark, narrow window** (`Dark.dc.html`): the moment after Respond. Status strip, new follow-ups arriving under their parent, a multi-choice question, Respond disabled. The sidebar is collapsed into a session switcher.
- **Summary and confirmation** (`Summary.dc.html`): the agent's summary with a diagram, decisions assumed by the agent pulled out for review, the "not yet" note box and the Confirm button.

Decided after the mockups were drawn, so not shown in them: the button that folds the sessions panel, the project filter in the sidebar, the offline banner and "Will send when the agent is back" state, and the keyboard hints on buttons other than Done.

## Look

One accent, used only for things that need the user's attention: new items, focus, and the Respond and Confirm buttons. Primary buttons inside cards are near-black (light theme) or near-white (dark theme), so the accent stays rare.

| Role | Light | Dark |
|---|---|---|
| Page background | `#F5F6F7` | `#0F1115` |
| Card / panel surface | `#FFFFFF` | `#171A20` |
| Raised surface | `#F5F6F7` | `#1E222A` |
| Border | `#E3E5E9` | `#2A2F3A` |
| Strong border | `#C9CDD4` | `#4A5160` |
| Text | `#16181D` | `#ECEEF2` |
| Secondary text | `#4B5160` | `#B4BAC6` |
| Muted text | `#646B7A` | `#8F97A6` |
| Accent (ember) | `#C2410C` | `#FF8A4C` |
| Accent tint | `#FFF1E8` | `#33200F` |
| Sent / settled | `#17824D` | `#41AA75` |
| Done, not sent | `#C2410C` | `#E26C32` |
| Assumed by agent | `#673DC7` | `#927EF1` |
| Invalid | `#8F1948` | `#D454A9` |
| Open | strong border | strong border |

Type: Space Grotesk 600 for headings and the wordmark, Inter 400/500/600 for body, JetBrains Mono for question and session ids. The fonts are bundled with the plugin; nothing loads from another host.

Shape: 12 px radius on cards, 10 px on buttons and inputs, fully round on chips. Buttons and inputs are at least 44 px tall. Follow-ups are indented under their parent with a 2 px guide line.

Every question state carries an icon and a text label as well as a colour.

Validator results for the four state colours, all pairs: light on `#FFFFFF`, worst colour-blind separation 8.1 (target 8), worst normal-vision separation 15.8 (floor 15), text contrast 4.8 to 8.8; dark on `#171A20`, 8.2 and 16.2, text contrast 4.7 to 6.0. In the dark theme the brand accent stays `#FF8A4C` for buttons, logo and focus, while the "done, not sent" state uses the slightly deeper `#E26C32`.

## Logo

A clockwise arrow circling a solid dot: the subject turning in front of the heat. Single colour, so it works in the accent, in white on an accent tile, or in plain ink.

The user compared eleven options on the canvas (four concepts, four variations that added question and interview metaphors, three polished takes on the original) and chose the original mark from the first UI mockup, polished:

- **Logo: "P1 Connected"** (`logo/logo.svg`). The ring flows into the arrowhead as one stroke. Stroke width 4 on a 48 unit box, ring radius 18, centre dot radius 5.
- **Favicon and any use at 16 px: "P3 Bold"** (`logo/favicon.svg`). The same shape, heavier: stroke width 5, ring radius 17, centre dot radius 6.

The wordmark is "Rotisserie" in Space Grotesk 600 with slightly tight letter spacing, set to the right of the mark.

Rejected directions, for the record: a question mark with an arrowhead, a skewer with a crank, a flame in a ring, a Q-shaped ring, a question mark in the ring, a speech-bubble ring, and a segmented ring.
