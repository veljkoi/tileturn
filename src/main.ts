import "./style.css";
import { getLegalGroupFlips, isEdgeConnected, type GroupFlip, type GroupHinge, type Vertex } from "./geometry";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const BOARD_COLUMNS = 8;
const BOARD_ROWS = 16;
const CELL_SIZE = 64;
const TILE_INSET = 4;
const FLIP_DURATION_MS = 350;

type Tile = { id: number; column: number; row: number; color: string };
type ActiveFlip = { tileIds: number[]; move: GroupFlip };

const INITIAL_TILES: ReadonlyArray<Tile> = [
  { id: 1, column: 3, row: 6, color: "#22b8cf" },
  { id: 2, column: 4, row: 6, color: "#ff6b6b" },
  { id: 3, column: 3, row: 7, color: "#f4b942" },
  { id: 4, column: 5, row: 7, color: "#9b5de5" },
  { id: 5, column: 3, row: 8, color: "#4dd4ac" },
];

let tiles = cloneInitialTiles();
let selectedTileIds = new Set<number>();
let activeFlip: ActiveFlip | null = null;
let flipTimer: number | undefined;
const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Tileturn requires an #app element.");

const heading = document.createElement("h1");
heading.textContent = "Tileturn";
const intro = document.createElement("p");
intro.className = "intro";
intro.textContent = "Turn connected tiles over the grid.";
const boardFrame = document.createElement("div");
boardFrame.className = "board-frame";
const status = document.createElement("p");
status.className = "status";
status.setAttribute("role", "status");
const resetButton = document.createElement("button");
resetButton.type = "button";
resetButton.textContent = "Reset";
resetButton.addEventListener("click", resetBoard);
app.append(heading, intro, boardFrame, status, resetButton);
renderBoard("The board is ready. Select a tile to build a group.");

function cloneInitialTiles(): Tile[] { return INITIAL_TILES.map((tile) => ({ ...tile })); }
function resetBoard(): void {
  window.clearTimeout(flipTimer);
  tiles = cloneInitialTiles(); selectedTileIds = new Set(); activeFlip = null;
  renderBoard("Board reset to the starting arrangement.");
}
function changeSelection(tileId: number): void {
  if (activeFlip) return;
  const next = new Set(selectedTileIds);
  const removing = next.delete(tileId);
  if (!removing) next.add(tileId);
  const nextTiles = tiles.filter(({ id }) => next.has(id));
  if (!isEdgeConnected(nextTiles)) {
    renderBoard(removing ? "That tile cannot be removed because it would split the group." : "That tile cannot be added because it is not edge-connected to the group.");
    return;
  }
  selectedTileIds = next;
  if (next.size === 0) renderBoard("Selection cleared.");
  else renderBoard(selectionGuidance());
}
function clearSelection(): void {
  if (activeFlip || selectedTileIds.size === 0) return;
  selectedTileIds = new Set(); renderBoard("Selection cleared.");
}
function selectionGuidance(): string {
  const count = selectedTileIds.size;
  const subject = count === 1 ? "Tile" : "Group of";
  if (getCurrentMoves().length === 0) return subject + " " + count + " selected, but it has no legal flips.";
  return subject + " " + count + " selected. Choose a legal flip or add an edge-connected tile.";
}
function getCurrentMoves(): GroupFlip[] {
  const selectedTiles = tiles.filter(({ id }) => selectedTileIds.has(id));
  return selectedTiles.length > 0 && !activeFlip
    ? getLegalGroupFlips({ columns: BOARD_COLUMNS, rows: BOARD_ROWS }, selectedTiles, tiles.filter(({ id }) => !selectedTileIds.has(id)))
    : [];
}
function beginFlip(move: GroupFlip): void {
  if (activeFlip || selectedTileIds.size === 0) return;
  const tileIds = tiles.filter(({ id }) => selectedTileIds.has(id)).map(({ id }) => id);
  activeFlip = { tileIds, move };
  renderBoard(`Selected group is flipping ${hingeDirection(move.hinge)}.`);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) settleFlip();
  else flipTimer = window.setTimeout(settleFlip, FLIP_DURATION_MS);
}
function settleFlip(): void {
  if (!activeFlip) return;
  const { tileIds, move } = activeFlip;
  tileIds.forEach((id, index) => {
    const tile = tiles.find((candidate) => candidate.id === id);
    const destination = move.destinations[index];
    if (tile && destination) { tile.column = destination.column; tile.row = destination.row; }
  });
  activeFlip = null; selectedTileIds = new Set();
  renderBoard(`Group flipped ${hingeDirection(move.hinge)}. Selection cleared.`);
}

function hingeDirection(hinge: GroupHinge): string {
  return hinge.orientation === "diagonal" ? "diagonally" : hinge.side;
}

function moveLabel(hinge: GroupHinge): string {
  if (hinge.orientation !== "diagonal") return `Flip selected group ${hinge.side}`;
  return `Flip selected group diagonally along hinge (${hinge.start.x},${hinge.start.y})–(${hinge.end.x},${hinge.end.y})`;
}

function renderBoard(message?: string): void {
  const board = createSvgElement("svg");
  board.classList.add("board");
  board.setAttribute("viewBox", `0 0 ${BOARD_COLUMNS * CELL_SIZE} ${BOARD_ROWS * CELL_SIZE}`);
  board.setAttribute("role", "group");
  board.setAttribute("aria-label", "Eight by sixteen Tileturn board");
  board.addEventListener("click", (event) => { if (event.target === board || (event.target as Element).classList.contains("grid__cell")) clearSelection(); });
  const background = createSvgElement("rect"); background.classList.add("board__background"); background.setAttribute("width", "100%"); background.setAttribute("height", "100%"); board.append(background);
  const grid = createSvgElement("g"); grid.classList.add("grid");
  for (let row = 0; row < BOARD_ROWS; row += 1) for (let column = 0; column < BOARD_COLUMNS; column += 1) {
    const cell = createSvgElement("rect"); cell.classList.add("grid__cell");
    setAttributes(cell, { x: column * CELL_SIZE, y: row * CELL_SIZE, width: CELL_SIZE, height: CELL_SIZE }); grid.append(cell);
  }
  board.append(grid);
  const moves = getCurrentMoves();
  const tileLayer = createSvgElement("g"); tileLayer.classList.add("tiles");
  const flipGroup = createSvgElement("g");
  if (activeFlip) {
    flipGroup.classList.add("tile-group--flipping", "tile-group--flip-" + activeFlip.move.hinge.orientation);
    const hinge = activeFlip.move.hinge;
    const hingeStart = hingeGridSegment(hinge).start;
    flipGroup.style.transformOrigin = hingeStart.x * CELL_SIZE + "px " + hingeStart.y * CELL_SIZE + "px";
    if (hinge.orientation === "diagonal") {
      flipGroup.classList.add(hinge.slope === 1 ? "tile-group--flip-diagonal-ascending" : "tile-group--flip-diagonal-descending");
    }
  }
  for (const tile of tiles) {
    const element = createTileElement(tile);
    if (activeFlip?.tileIds.includes(tile.id)) flipGroup.append(element);
    else tileLayer.append(element);
  }
  if (activeFlip) tileLayer.append(flipGroup);
  board.append(tileLayer);
  if (moves.length > 0) board.append(createMoveLayer(moves));
  boardFrame.replaceChildren(board);
  if (message !== undefined) status.textContent = message;
}

function createTileElement(tile: Tile): SVGGElement {
  const group = createSvgElement("g"); const selected = selectedTileIds.has(tile.id);
  group.classList.add("tile"); if (selected) group.classList.add("tile--selected");
  group.dataset.tile = String(tile.id); group.setAttribute("role", "button"); group.setAttribute("tabindex", activeFlip ? "-1" : "0"); group.setAttribute("aria-pressed", String(selected));
  group.setAttribute("aria-label", `Tile ${tile.id} at column ${tile.column + 1}, row ${tile.row + 1}`);
  group.setAttribute("transform", `translate(${tile.column * CELL_SIZE} ${tile.row * CELL_SIZE})`);
  group.addEventListener("click", (event) => { event.stopPropagation(); changeSelection(tile.id); });
  group.addEventListener("keydown", (event) => activateOnKeyboard(event, () => changeSelection(tile.id)));
  const square = createSvgElement("rect"); square.classList.add("tile__square"); setAttributes(square, { x: TILE_INSET, y: TILE_INSET, width: CELL_SIZE - TILE_INSET * 2, height: CELL_SIZE - TILE_INSET * 2, rx: 9 }); square.setAttribute("fill", tile.color);
  const label = createSvgElement("text"); label.classList.add("tile__label"); setAttributes(label, { x: CELL_SIZE / 2, y: CELL_SIZE / 2 }); label.textContent = String(tile.id);
  const face = createSvgElement("g"); face.classList.add("tile__face"); const bounds = createSvgElement("rect"); bounds.classList.add("tile__face-bounds"); setAttributes(bounds, { width: CELL_SIZE, height: CELL_SIZE }); face.append(bounds, square, label); group.append(face); return group;
}

function createMoveLayer(moves: GroupFlip[]): SVGGElement {
  const layer = createSvgElement("g"); layer.classList.add("moves");
  for (const move of moves) {
    const group = createSvgElement("g"); group.classList.add("move"); group.setAttribute("role", "button"); group.setAttribute("tabindex", "0");
    group.setAttribute("aria-label", moveLabel(move.hinge));
    group.addEventListener("click", (event) => { event.stopPropagation(); beginFlip(move); });
    group.addEventListener("keydown", (event) => activateOnKeyboard(event, () => beginFlip(move)));
    for (const destination of move.destinations) {
      const preview = createSvgElement("rect"); preview.classList.add("move__preview"); setAttributes(preview, { x: destination.column * CELL_SIZE + TILE_INSET, y: destination.row * CELL_SIZE + TILE_INSET, width: CELL_SIZE - TILE_INSET * 2, height: CELL_SIZE - TILE_INSET * 2, rx: 9 }); group.append(preview);
    }
    group.append(createHingeHandle(move.hinge)); layer.append(group);
  }
  return layer;
}
function createHingeHandle(hinge: GroupHinge): SVGGElement {
  const group = createSvgElement("g");
  const hitTarget = createSvgElement("line"); hitTarget.classList.add("move__hit-target");
  const line = createSvgElement("line"); line.classList.add("move__handle");
  const segment = hingeGridSegment(hinge);
  const attributes = { x1: segment.start.x * CELL_SIZE, x2: segment.end.x * CELL_SIZE, y1: segment.start.y * CELL_SIZE, y2: segment.end.y * CELL_SIZE };
  setAttributes(hitTarget, attributes); setAttributes(line, attributes); group.append(hitTarget, line);
  return group;
}
function hingeGridSegment(hinge: GroupHinge): { start: Vertex; end: Vertex } {
  if (hinge.orientation === "diagonal") return hinge;
  return hinge.orientation === "horizontal"
    ? { start: { x: hinge.start, y: hinge.line }, end: { x: hinge.end, y: hinge.line } }
    : { start: { x: hinge.line, y: hinge.start }, end: { x: hinge.line, y: hinge.end } };
}
function setAttributes(element: Element, attributes: Record<string, number>): void { for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value)); }
function activateOnKeyboard(event: KeyboardEvent, activate: () => void): void { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); activate(); } }
function createSvgElement<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] { return document.createElementNS(SVG_NAMESPACE, name); }
