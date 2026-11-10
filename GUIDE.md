# StillHere — interactive pebble game

Open index.html in a modern browser, preferably with an editor's local web server
for consistent browser storage. No build or package installation is needed.

## Files
- index.html: semantic controls, score panels, forms, game field and dialogs.
- styles.css: responsive layout, rock drawings, three themes, animations and
  reduced-motion support.
- game.js: state, validation, click rate limits, levels, badges, odds and score.
- blocks.js: falling-block geometry, collision checks, rotation and row scoring.
- app.js: browser events, rendering, local saving and the repair puzzle interface.

## Rules
Each accepted interaction gives 10 main-score points and an independent 0.10%
(1 in 1,000) chance of a rare movement. No guaranteed movement after 10,000 clicks.
Each 100 current-level clicks earns a level and 100 points. Rocks change colour,
shape and position. Size/decoy difficulty is capped at 44px/12 decoys. Reveal and
keyboard focus are always available. Each rare movement earns 1,000 points.

Play by tapping the correct stone, catching the shifting button, holding for
three seconds, or starting a three-second deep inspection. Each completion earns
one click. No automatic clicks. Rhythm messages, funny random responses and
button animation provide feedback. The steady-button option stops relocation;
reduced-motion preference suppresses animations.

The seventh attempt in two seconds triggers a 15-second cooldown and clears
progress towards the NEXT level. Further offences double the duration up to
120 seconds. Earned levels, badges, lifetime clicks and time remain. Attempts
while cooling down do not extend the cooldown. Recent attempts and cooldown
expiry persist on reload. This is client-side gameplay, not cheat-proof security.

Visible-tab time awards patience badges at 1, 5, 15 and 60 minutes. It pauses while
the tab is hidden. Click badges include 1, 10, 100, 500, 1,000 and 10,000 clicks.

## Input, calculation and themes
Rename your rock, set a whole-number lifetime click goal from 1 to 100,000, and
choose Daylight, Midnight or Lilac. Preferences are saved in localStorage.
Remaining clicks = max(0, goal - lifetime clicks).
Chance of at least one movement over n remaining clicks = 1 - (1 - 0.001)^n.
The screen displays this as a percentage. It is not a guaranteed outcome.
Main score = clicks*10 + (level-1)*100 + movements*1000 + repairs*100.

## Fictional errors and Pebble Blocks
Once at least 20 clicks have passed since the previous event, each accepted click
has a 6% chance of a funny, explicitly fictional error. Rare movement takes
priority. An existing error cannot be replaced by another event.
Clear one complete row in the falling-block puzzle to earn 10 puzzle points and
remove the error. Arrow keys move/rotate/down, Space drops while the board has
focus, and touch buttons offer the same controls. Pause, restart and play later
are available. The opening O block and partially filled bottom row keep a first
repair achievable. A text arithmetic challenge provides a nonvisual alternative.
Each completed error repair awards 100 main-score points, once only. Practice
puzzles do not award main-score points. Pending errors persist when the puzzle
closes or the page reloads; a puzzle board itself is session-only.

## Manual reset
Reset progress opens a confirmation dialog. Confirming clears all game counters,
badges, levels, time, cooldowns, errors and repair wins. Name and theme stay.
Cancelling changes nothing. Cleared progress cannot be recovered.

## Learning exercise
Prompt -> Generate -> Run -> Examine -> Change:
Change game.js RULES.moveChance from 0.001 to 0.01 in a local copy. Predict the
result: a 1% movement chance per accepted click. Update the matching UI copy too.
Run and inspect; restore 0.001 afterwards. Never infer exact probability from a
small play session. Tests can inject controlled randomness to verify boundaries.
Removing save() stops immediate persistence at that call site. Removing render()
leaves the screen stale until another render. Removing the rate-limit check lets
that interaction route bypass the intended rule. Keep rules separate from UI so
all interaction routes share the same behaviour.

## Verification and limits
Run `node --test tests/*.test.cjs` from the extracted source directory. Tests cover
rules, odds boundaries, cooldowns, saving, UI wiring with simulated browser objects,
block collisions, row clearing, scoring, holds, reset and error repair. JavaScript
syntax is checked separately. Actual browser layout and interaction QA were not
available in the build environment; test desktop, mobile, touch, keyboard, report
exports and theme contrast in a real browser before broader release.
The existing client PowerPoint/PDF describe the earlier observatory prototype.
