// Away from the bottom, opening or closing a disclosure keeps the reader's view: the line they
// clicked (a tool group, a tool, command or MCP call, a folded thought, a settled run, "Worked for",
// a subagent group, a failure's Details) stays where it was on screen while what it opens or closes
// lays out and its fold plays (fold.ts). VirtualTranscript holds it (App.tsx): each placement pass
// during the hold moves the offset by however far the line moved, and none of them follows the
// latest row meanwhile.
//
// A disclosure closed with the view at its very end instead pins the bottom and moves the thread
// as one stack: what closes pulls it down, leaving no blank room under the rows (App.tsx `beginBottomStackFold`, Leo 2026-11-03: "it's
// weird to collapse and get all that empty space at the bottom"). Away from the end a close keeps
// the clicked line: foldRoomFor prevents a browser clamp, and trimmedFoldRoom releases that room as
// the reader scrolls up, the rows fill it, or a send/Jump to latest returns to following.
import { foldMs } from "./fold";

/// The disclosures a click holds in place: every control that opens or closes something in its row
/// (a button or a `role="button"` line with `aria-expanded`: a tool or sent message's line, Show
/// more, Show all lines, Raw, a file list's "+N more"), a `<summary>`, and a header that is its
/// toggle edge to edge (`data-header-toggle`, headerToggle.ts: an agent message's line, the edits
/// card's header, a disclosure row's line). A menu's trigger
/// (`aria-haspopup`) opens no body in the row and is left out. An `aria-pressed` button is held only
/// when it says it changes its block's height (`data-fold-toggle`: Wrap lines, a tool output's Raw):
/// a reply's Pin and Read aloud are `aria-pressed` too, and holding them would stop following a
/// reply that streams on.
export const FOLD_TOGGLE = [
  "button[aria-expanded]:not([aria-haspopup])",
  '[role="button"][aria-expanded]:not([aria-haspopup])',
  "summary",
  "[data-header-toggle]",
  // Toggles that change their block's height in place: Wrap lines, Raw, a diagram's chart or code.
  "button[aria-pressed][data-fold-toggle]",
  "button.cv-diagram__toggle",
].join(", ");
/// The controls a click lands on: one inside a toggle is its own, not the toggle's.
const NESTED_CONTROL =
  'button, a[href], [role="button"], [role="link"], summary, input, textarea, select, [role="menuitem"]';
/// What a collapsible's header sends up (bubbling, cancelable) to be held where it is drawn while its
/// body opens or closes (useAnchoredCollapse.ts); the transcript that holds it cancels it.
export const ANCHORED_COLLAPSE_EVENT = "cmux:anchored-collapse";

/// How far up the view a disclosure line sat, as a share of the view's height from its foot, when
/// opening it at the latest row pinned the bottom. Opening no longer pins it (VirtualTranscript.tsx
/// `beginBottomStackFold`); only transcript-details-toggle-steady-browser.test.ts still reads it.
export const BOTTOM_PIN_SHARE = 0.6;
/// How long a hold outlasts its fold: the last frame's measure, and rows a "Worked for" inserts.
export const FOLD_SETTLE_MS = 150; // motion-allow: a hold timer after the fold, not an animation
/// The shortest hold, so a toggle with no fold (Reduce Motion, a body that lays out late) is still
/// held while what it opened is measured and placed. A hold that kept extending while its line moved
/// re-placed a tall prompt under the pointer and its Show less missed the click. The reader's own
/// scroll lets go of it sooner.
export const FOLD_HOLD_MIN_MS = 400; // motion-allow: a hold timer, not an animation

/// Whether the physical scroller is at (or within the normal follow deadband of) its end.
export function atFoldBottom(scrollTop: number, clientHeight: number, scrollHeight: number, deadband: number): boolean {
  return scrollHeight > clientHeight + 0.5 && scrollHeight - clientHeight - scrollTop <= deadband;
}

/// Whether a click on `toggle` opens what it holds: a closed disclosure (`aria-expanded="false"`, on
/// itself or on its header's button) or the `<summary>` of a closed `<details>`.
export function opensBody(toggle: HTMLElement): boolean {
  if (toggle.tagName === "SUMMARY") return !(toggle.parentElement as HTMLDetailsElement | null)?.open;
  const expanded = toggle.hasAttribute("aria-expanded")
    ? toggle
    : toggle.querySelector("[aria-expanded]:not([aria-haspopup])");
  return expanded?.getAttribute("aria-expanded") === "false";
}

/// The cut that keeps a row moving up with the bottom stack from drawing past the line the rows
/// under it hold (App.tsx): `over` is how far the row's foot lands below that line once it settles
/// (0 for the opened row, less for one above it), `from` how far the stack starts below where it
/// settles. Keyframes on the stack's own eased progress, so the cut row's foot reaches the line as
/// the stack carries it there and nothing of it ever covers the held rows; none when it never does.
export function pushUpCut(over: number, from: number): Keyframe[] {
  const start = over + from;
  if (from <= 0.5 || start <= 0.5) return [];
  const until = Math.min(1, start / from);
  return [
    { offset: 0, clipPath: `inset(0 0 ${start}px 0)` },
    { offset: until, clipPath: "inset(0 0 0px 0)" },
    { offset: 1, clipPath: "inset(0 0 0px 0)" },
  ];
}

export type FoldAnchor = {
  toggle: HTMLElement;
  /// Where the line was drawn when clicked (its viewport top).
  top: number;
  /// When the hold ends (performance.now()). While it waits for the click's change to be drawn
  /// (`control`), the latest it waits; once that is drawn, the fold's length and the settle after it.
  until: number;
  /// The control the reader clicked, while the hold waits for its change to be drawn: its open state
  /// (`toggleState`) still reads `from`. The hold's clock starts on the first pass that draws another.
  control?: HTMLElement;
  from?: string;
  /// How long the hold lasts once the change is drawn (the fold, the settle, at least FOLD_HOLD_MIN_MS).
  span?: number;
  /// Finds the held line and the control again when an update draws them anew (`lineSelector`).
  find?: string;
  controlFind?: string;
  /// The transcript they are found again in.
  root?: ParentNode;
};

/// The longest a hold waits for the click's change to be drawn before it lets go (Leo, 2026-11-10,
/// on a recording at load ~260: "when things get slow this tool call expansion situatoin gets insanely
/// f***ed"). A hold timed from the click ran out before a render that slow drew what the click
/// opened, so the pass that drew it neither held the line nor stopped following the latest row: the
/// view jumped to the bottom and the clicked line left it. The hold's clock now starts when the change
/// is drawn; this only bounds a click whose change never comes. The reader's own scroll lets go sooner.
export const FOLD_DRAW_WAIT_MS = 5_000; // motion-allow: a hold's upper bound, not an animation

/// What a disclosure control says of its state: a `<summary>`'s details open or not, its own
/// `aria-expanded` or `aria-pressed`, or its header button's `aria-expanded` (a `data-header-toggle`
/// line). Undefined for a control that says nothing (a diagram's chart or code switch).
export function toggleState(control: HTMLElement): string | undefined {
  if (control.tagName === "SUMMARY") {
    const details = control.parentElement;
    return details?.tagName === "DETAILS" ? String((details as HTMLDetailsElement).open) : undefined;
  }
  if (typeof control.getAttribute !== "function") return undefined;
  const own = control.getAttribute("aria-expanded") ?? control.getAttribute("aria-pressed");
  if (own !== null) return own;
  return control.querySelector?.("[aria-expanded]:not([aria-haspopup])")?.getAttribute("aria-expanded") ?? undefined;
}

/// The id-keyed lines a streamed update can draw anew (a call's, a group's, a run's: the ids outlast
/// a regroup, keepOpenedLineModel.ts) and a transcript row; anything else is not found again.
const LINE_IDS = ["data-tool-id", "data-tool-group", "data-tool-run"] as const;

/// A selector that finds `node` again once React draws it anew, or undefined.
export function lineSelector(node: HTMLElement): string | undefined {
  if (typeof node.getAttribute !== "function") return undefined;
  const escape = (value: string) => value.replace(/["\\]/g, "\\$&");
  for (const name of LINE_IDS) {
    const value = node.getAttribute(name);
    if (value) return `${node.tagName.toLowerCase()}[${name}="${escape(value)}"]`;
  }
  const row = node.getAttribute("data-row-id");
  return row && node.classList?.contains("acpmux-row") ? `.acpmux-row[data-row-id="${escape(row)}"]` : undefined;
}

/// `node` if it is still drawn, else what `find` finds in its transcript now.
function drawnAgain(node: HTMLElement, find: string | undefined, root: ParentNode | undefined): HTMLElement | undefined {
  if (node.isConnected) return node;
  return (find && root?.querySelector<HTMLElement>(find)) || undefined;
}

/// The held line as drawn now (found again if an update drew it anew), with the hold's clock started
/// once the click's change is drawn; undefined once the line is gone.
function heldLine(anchor: FoldAnchor, now: number): HTMLElement | undefined {
  const root = anchor.root;
  const line = drawnAgain(anchor.toggle, anchor.find, root);
  if (!line) return undefined;
  anchor.toggle = line;
  if (anchor.span === undefined || anchor.control === undefined) return line;
  const control = drawnAgain(anchor.control, anchor.controlFind, root);
  // Still drawn as it was clicked (the render is not in yet), and still within the wait: hold on.
  if (control && toggleState(control) === anchor.from && now <= anchor.until) {
    anchor.control = control;
    return line;
  }
  if (now > anchor.until) return line;
  anchor.until = now + anchor.span;
  anchor.control = anchor.from = anchor.span = anchor.controlFind = undefined;
  return line;
}

/// A message row's first line, on its own line under the row (messageLineLook.ts, stacked: a sent
/// message, an agent message, a received line, a folded group's head). It toggles its row, so a click
/// on it holds the row's line, as a click on the line does; the first line itself goes as the row opens.
const FIRST_LINE = ".cv-msgline__preview";

/// The disclosure line `target` is on, inside one of `scroller`'s rows; undefined for anything else.
export function foldToggleAt(target: EventTarget | null, scroller: HTMLElement): HTMLElement | undefined {
  const element = target && typeof (target as Element).closest === "function" ? (target as Element) : null;
  const line = element?.closest(FIRST_LINE)?.previousElementSibling;
  const toggle = line?.matches(FOLD_TOGGLE) ? (line as HTMLElement) : element?.closest<HTMLElement>(FOLD_TOGGLE);
  if (!toggle || !scroller.contains(toggle) || !toggle.closest(".acpmux-row")) return undefined;
  // A control of its own inside the toggle (a sent line's recipient, its Copy) opens nothing there.
  const control = element?.closest<HTMLElement>(NESTED_CONTROL);
  return control && control !== toggle && toggle.contains(control) ? undefined : toggle;
}

/// The lines that open a body under themselves: a click holds the line itself.
const HEADER_TOGGLE =
  'button.is-toggle[aria-expanded], button.cv-subagents[aria-expanded], [role="button"][aria-expanded], summary, [data-header-toggle]';

/// What a click on `toggle` holds in place. A line that opens a body under itself holds itself. Any
/// other control (Show more, Show all lines, "+N more", Raw) may sit under or beside the body it
/// opens or closes, so its row holds by its top: the body grows and shrinks downward and nothing
/// above it moves, the control with it. A row whose top is above `scroller`'s view (Show less under
/// a long output, scrolled down to) holds the control instead: held by its top, the row would close
/// up above the view and leave it blank, so the body shrinks up into the control, which stays where
/// it was clicked.
export function foldHoldTarget(toggle: HTMLElement, scroller?: HTMLElement): HTMLElement {
  if (toggle.matches(HEADER_TOGGLE)) return toggle;
  const row = toggle.closest<HTMLElement>(".acpmux-row");
  if (!row) return toggle;
  if (scroller && row.getBoundingClientRect().top < scroller.getBoundingClientRect().top - 0.5) return toggle;
  return row;
}

/// Holds `toggle` where it is drawn now, for its fold and a little after. With the `control` the
/// reader clicked, the clock starts once its change is drawn, however long the render takes (up to
/// `FOLD_DRAW_WAIT_MS`); without one, or for a control that says nothing of its state, from `now`.
export function holdFold(toggle: HTMLElement, now = performance.now(), control?: HTMLElement): FoldAnchor {
  const span = Math.max(foldMs(toggle) + FOLD_SETTLE_MS, FOLD_HOLD_MIN_MS);
  const top = toggle.getBoundingClientRect().top;
  const from = control ? toggleState(control) : undefined;
  const anchor: FoldAnchor =
    from === undefined
      ? { toggle, top, until: now + span }
      : { toggle, top, until: now + Math.max(FOLD_DRAW_WAIT_MS, span), control, from, span };
  const find = lineSelector(toggle);
  if (find) anchor.find = find;
  const controlFind = control && control !== toggle ? lineSelector(control) : find;
  if (anchor.control && controlFind) anchor.controlFind = controlFind;
  const root = typeof toggle.closest === "function" ? toggle.closest(".acpmux-scroll") : null;
  if (root) anchor.root = root;
  return anchor;
}

/// The hold for a click on `toggle`: the one its press started (`pressed`, same line, still on), kept
/// at the place the line was pressed at and timed from the click, so a line that streaming moved
/// between press and release goes back to where the reader pressed it; else a new one.
export function clickFold(
  toggle: HTMLElement,
  pressed: FoldAnchor | undefined,
  now = performance.now(),
  control?: HTMLElement,
): FoldAnchor {
  const fresh = holdFold(toggle, now, control);
  if (pressed && pressed.toggle === toggle && foldHolding(pressed, now)) fresh.top = pressed.top;
  return fresh;
}

/// Whether a wheel event is the reader scrolling the transcript: up or down, not sideways (a code
/// block's horizontal scroll keeps the hold).
export function verticalWheel(event: { deltaX: number; deltaY: number }): boolean {
  return Math.abs(event.deltaY) > Math.abs(event.deltaX);
}

/// Puts the held line back where it was clicked by moving `scroller`'s offset. False once the hold
/// is over (its time is up, or the line left the transcript), and the view is the reader's again.
export function keepFold(anchor: FoldAnchor, scroller: HTMLElement, now = performance.now()): boolean {
  const line = heldLine(anchor, now);
  if (!line || now > anchor.until) return false;
  const moved = line.getBoundingClientRect().top - anchor.top;
  if (Math.abs(moved) >= 0.5) scroller.scrollTop += moved;
  return true;
}

/// The content end a click on a disclosure keeps: the view's end now (offset plus height), whole
/// pixels up, or the end already kept when that is further down.
export function foldRoomFor(scrollTop: number, clientHeight: number, kept = 0): number {
  return Math.max(kept, Math.ceil(scrollTop + clientHeight));
}

/// The kept end after a scroll or a placement pass: as it is while a fold holds its line; else no
/// further down than the view's end (`viewEnd`, the reader scrolled up), and 0 once the content
/// would be that tall anyway: the rows' own end (`rowsEnd`) or the view's height (`viewHeight`, a
/// scroller is never shorter than its view) reaches it, when nothing of it is room any more. Nor
/// once the rows end above the view's top: the room would be all the reader sees, so it goes and
/// the view comes back to the rows' end.
export function trimmedFoldRoom(
  kept: number,
  viewEnd: number,
  rowsEnd: number,
  holding: boolean,
  viewHeight = 0,
): number {
  if (kept <= 0) return 0;
  if (holding) return kept;
  if (viewHeight > 0 && rowsEnd <= viewEnd - viewHeight + 0.5) return 0;
  const next = Math.min(kept, Math.ceil(viewEnd));
  return next <= Math.max(rowsEnd, viewHeight) + 0.5 ? 0 : next;
}

/// Whether `anchor` still holds its line (its time is not up and the line is still drawn).
export function foldHolding(anchor: FoldAnchor | undefined, now = performance.now()): boolean {
  if (!anchor) return false;
  return heldLine(anchor, now) !== undefined && now <= anchor.until;
}
