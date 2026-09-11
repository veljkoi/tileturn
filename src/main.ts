import "./style.css";
import { getLegalGroupFlips, isEdgeConnected, type GroupFlip, type GroupHinge, type Vertex } from "./geometry";
import { generateObstacles } from "./obstacles";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const BOARD_COLUMNS = 8;
const BOARD_ROWS = 16;
const CELL_SIZE = 64;
const TILE_INSET = 4;
const FLIP_DURATION_MS = 350;
const DRAG_THRESHOLD_PX = 8;
const DRAG_SAMPLE_DISTANCE_PX = 4;

type Tile = { id: number; column: number; row: number };
type ActiveFlip = { tileIds: number[]; move: GroupFlip };

const INITIAL_TILES: ReadonlyArray<Tile> = [
  { id: 1, column: 2, row: 14 },
  { id: 2, column: 3, row: 14 },
  { id: 3, column: 4, row: 14 },
  { id: 4, column: 3, row: 15 },
  { id: 5, column: 4, row: 15 },
];

let tiles = cloneInitialTiles();
let obstacles = generateObstacles({ columns: BOARD_COLUMNS, rows: BOARD_ROWS }, tiles);
let selectedTileIds = new Set<number>();
let activeFlip: ActiveFlip | null = null;
type SelectionDrag = {
  pointerId: number;
  startTileId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  dragging: boolean;
  initialTileIds: Set<number>;
};
let selectionDrag: SelectionDrag | null = null;
let suppressNextTileClick = false;
const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Tileturn requires an #app element.");

const boardFrame = document.createElement("div");
boardFrame.className = "board-frame";
const announcer = document.createElement("div");
announcer.className = "visually-hidden";
announcer.setAttribute("role", "status");
announcer.setAttribute("aria-atomic", "true");
const orientationMessage = document.createElement("p");
orientationMessage.className = "orientation-message";
orientationMessage.textContent = "Rotate your device to play.";
app.append(boardFrame, announcer, orientationMessage);
renderBoard("The board is ready. Select a tile to build a group.");
window.addEventListener("pointermove", continueSelectionDrag, { passive: false });
window.addEventListener("pointerup", finishSelectionDrag);
window.addEventListener("pointercancel", finishSelectionDrag);

function cloneInitialTiles(): Tile[] { return INITIAL_TILES.map((tile) => ({ ...tile })); }
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
function beginSelectionDrag(event: PointerEvent, tileId: number): void {
  if (activeFlip || selectionDrag || event.button !== 0) return;
  suppressNextTileClick = false;
  selectionDrag = {
    pointerId: event.pointerId,
    startTileId: tileId,
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    dragging: false,
    initialTileIds: new Set(selectedTileIds),
  };
}

function continueSelectionDrag(event: PointerEvent): void {
  const drag = selectionDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  const samples = event.getCoalescedEvents?.() ?? [event];
  for (const sample of samples.length > 0 ? samples : [event]) {
    continueSelectionDragTo(sample.clientX, sample.clientY);
  }
  if (drag.dragging) event.preventDefault();
}

function finishSelectionDrag(event: PointerEvent): void {
  const drag = selectionDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  if (event.type === "pointerup") continueSelectionDragTo(event.clientX, event.clientY);
  selectionDrag = null;
  if (!drag.dragging) return;
  event.preventDefault();
  if (event.type === "pointercancel") {
    selectedTileIds = drag.initialTileIds;
    renderBoard();
    return;
  }
  suppressNextTileClick = true;
  renderBoard(selectionGuidance());
}

function continueSelectionDragTo(clientX: number, clientY: number): void {
  const drag = selectionDrag;
  if (!drag) return;
  if (!drag.dragging && Math.hypot(clientX - drag.startX, clientY - drag.startY) < DRAG_THRESHOLD_PX) {
    drag.lastX = clientX;
    drag.lastY = clientY;
    return;
  }
  if (!drag.dragging) {
    drag.dragging = true;
    startDragSelection(drag);
    document.querySelector(".moves")?.remove();
    drag.lastX = drag.startX;
    drag.lastY = drag.startY;
  }
  addTilesAlongPath(drag.lastX, drag.lastY, clientX, clientY);
  drag.lastX = clientX;
  drag.lastY = clientY;
}

function startDragSelection(drag: SelectionDrag): void {
  selectedTileIds = drag.initialTileIds.has(drag.startTileId)
    ? new Set(drag.initialTileIds)
    : new Set([drag.startTileId]);
  syncDraggedSelection();
}

function addTilesAlongPath(startX: number, startY: number, endX: number, endY: number): void {
  const distance = Math.hypot(endX - startX, endY - startY);
  const steps = Math.max(1, Math.ceil(distance / DRAG_SAMPLE_DISTANCE_PX));
  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    const tileId = tileIdAtClientPoint(
      startX + (endX - startX) * progress,
      startY + (endY - startY) * progress,
    );
    if (tileId !== undefined) addTileToDragSelection(tileId);
  }
}

function tileIdAtClientPoint(clientX: number, clientY: number): number | undefined {
  const board = document.querySelector<SVGSVGElement>(".board");
  if (!board) return undefined;
  const bounds = board.getBoundingClientRect();
  if (
    clientX < bounds.left || clientX >= bounds.right ||
    clientY < bounds.top || clientY >= bounds.bottom
  ) return undefined;
  const column = Math.floor((clientX - bounds.left) / bounds.width * BOARD_COLUMNS);
  const row = Math.floor((clientY - bounds.top) / bounds.height * BOARD_ROWS);
  return tiles.find((tile) => tile.column === column && tile.row === row)?.id;
}

function addTileToDragSelection(tileId: number): void {
  if (selectedTileIds.has(tileId) || selectedTileIds.size >= 5) return;
  const next = new Set(selectedTileIds).add(tileId);
  if (!isEdgeConnected(tiles.filter(({ id }) => next.has(id)))) return;
  selectedTileIds = next;
  syncDraggedSelection();
}

function syncDraggedSelection(): void {
  for (const element of document.querySelectorAll<SVGGElement>(".tile")) {
    const selected = selectedTileIds.has(Number(element.dataset.tile));
    element.classList.toggle("tile--selected", selected);
    element.setAttribute("aria-pressed", String(selected));
  }
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
    ? getLegalGroupFlips({ columns: BOARD_COLUMNS, rows: BOARD_ROWS }, selectedTiles, [...tiles.filter(({ id }) => !selectedTileIds.has(id)), ...obstacles])
    : [];
}
function beginFlip(move: GroupFlip): void {
  if (activeFlip || selectedTileIds.size === 0) return;
  const tileIds = tiles.filter(({ id }) => selectedTileIds.has(id)).map(({ id }) => id);
  activeFlip = { tileIds, move };
  renderBoard(`Selected group is flipping ${hingeDirection(move.hinge)}.`);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) settleFlip();
  else window.setTimeout(settleFlip, FLIP_DURATION_MS);
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
  const obstacleLayer = createSvgElement("g"); obstacleLayer.classList.add("obstacles");
  for (const obstacle of obstacles) {
    const element = createSvgElement("rect"); element.classList.add("obstacle");
    setAttributes(element, { x: obstacle.column * CELL_SIZE + TILE_INSET, y: obstacle.row * CELL_SIZE + TILE_INSET, width: CELL_SIZE - TILE_INSET * 2, height: CELL_SIZE - TILE_INSET * 2, rx: 9 });
    element.addEventListener("click", (event) => { event.stopPropagation(); clearSelection(); });
    obstacleLayer.append(element);
  }
  board.append(obstacleLayer);
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
  if (message !== undefined) announcer.textContent = message;
}

function createTileElement(tile: Tile): SVGGElement {
  const group = createSvgElement("g"); const selected = selectedTileIds.has(tile.id);
  group.classList.add("tile"); if (selected) group.classList.add("tile--selected");
  group.dataset.tile = String(tile.id); group.setAttribute("role", "button"); group.setAttribute("tabindex", activeFlip ? "-1" : "0"); group.setAttribute("aria-pressed", String(selected));
  group.setAttribute("aria-label", "Tile at column " + (tile.column + 1) + ", row " + (tile.row + 1));
  group.setAttribute("transform", `translate(${tile.column * CELL_SIZE} ${tile.row * CELL_SIZE})`);
  group.addEventListener("pointerdown", (event) => beginSelectionDrag(event, tile.id));
  group.addEventListener("click", (event) => {
    event.stopPropagation();
    if (suppressNextTileClick && event.detail !== 0) {
      suppressNextTileClick = false;
      return;
    }
    changeSelection(tile.id);
  });
  group.addEventListener("keydown", (event) => activateOnKeyboard(event, () => changeSelection(tile.id)));
  const square = createSvgElement("rect"); square.classList.add("tile__square"); setAttributes(square, { x: TILE_INSET, y: TILE_INSET, width: CELL_SIZE - TILE_INSET * 2, height: CELL_SIZE - TILE_INSET * 2, rx: 9 });
  const face = createSvgElement("g"); face.classList.add("tile__face"); const bounds = createSvgElement("rect"); bounds.classList.add("tile__face-bounds"); setAttributes(bounds, { width: CELL_SIZE, height: CELL_SIZE }); face.append(bounds, square); group.append(face); return group;
}

function createMoveLayer(moves: GroupFlip[]): SVGGElement {
  const layer = createSvgElement("g"); layer.classList.add("moves");
  for (const move of moves) {
    const group = createSvgElement("g"); group.classList.add("move"); group.setAttribute("role", "button"); group.setAttribute("tabindex", "0");
    group.setAttribute("aria-label", moveLabel(move.hinge));
    group.addEventListener("keydown", (event) => activateOnKeyboard(event, () => beginFlip(move)));
    for (const destination of move.destinations) {
      const preview = createSvgElement("rect"); preview.classList.add("move__preview");
      setAttributes(preview, { x: destination.column * CELL_SIZE, y: destination.row * CELL_SIZE, width: CELL_SIZE, height: CELL_SIZE });
      preview.addEventListener("click", (event) => { event.stopPropagation(); beginFlip(move); });
      group.append(preview);
    }
    const boundary = createSvgElement("path"); boundary.classList.add("move__boundary");
    boundary.setAttribute("d", createMoveBoundaryPath(move.destinations));
    group.append(boundary); layer.append(group);
  }
  return layer;
}

function createMoveBoundaryPath(destinations: ReadonlyArray<{ column: number; row: number }>): string {
  const occupied = new Set(destinations.map(({ column, row }) => `${column},${row}`));
  const segments: string[] = [];
  for (const { column, row } of destinations) {
    const left = column * CELL_SIZE;
    const top = row * CELL_SIZE;
    const right = left + CELL_SIZE;
    const bottom = top + CELL_SIZE;
    if (!occupied.has(`${column},${row - 1}`)) segments.push(`M ${left} ${top} L ${right} ${top}`);
    if (!occupied.has(`${column + 1},${row}`)) segments.push(`M ${right} ${top} L ${right} ${bottom}`);
    if (!occupied.has(`${column},${row + 1}`)) segments.push(`M ${right} ${bottom} L ${left} ${bottom}`);
    if (!occupied.has(`${column - 1},${row}`)) segments.push(`M ${left} ${bottom} L ${left} ${top}`);
  }
  return segments.join(" ");
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
