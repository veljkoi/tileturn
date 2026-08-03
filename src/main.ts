import "./style.css";
import {
  getLegalOrthogonalFlips,
  type OrthogonalFlip,
  type OrthogonalHinge,
} from "./geometry";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const BOARD_COLUMNS = 8;
const BOARD_ROWS = 16;
const CELL_SIZE = 64;
const TILE_INSET = 4;
const FLIP_DURATION_MS = 350;

type Tile = {
  id: number;
  column: number;
  row: number;
  color: string;
};

type ActiveFlip = {
  tileId: number;
  move: OrthogonalFlip;
};

const INITIAL_TILES: ReadonlyArray<Tile> = [
  { id: 1, column: 3, row: 6, color: "#22b8cf" },
  { id: 2, column: 4, row: 6, color: "#ff6b6b" },
  { id: 3, column: 3, row: 7, color: "#f4b942" },
  { id: 4, column: 4, row: 7, color: "#9b5de5" },
  { id: 5, column: 3, row: 8, color: "#4dd4ac" },
];

let tiles = cloneInitialTiles();
let selectedTileId: number | null = null;
let activeFlip: ActiveFlip | null = null;
let flipTimer: number | undefined;

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("Tileturn requires an #app element.");
}

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
renderBoard("The board is ready. Select a tile to see its legal flips.");

function cloneInitialTiles(): Tile[] {
  return INITIAL_TILES.map((tile) => ({ ...tile }));
}

function resetBoard(): void {
  window.clearTimeout(flipTimer);
  tiles = cloneInitialTiles();
  selectedTileId = null;
  activeFlip = null;
  renderBoard("Board reset to the starting arrangement.");
}

function selectTile(tileId: number): void {
  if (activeFlip) return;
  selectedTileId = tileId;
  const tile = tiles.find(({ id }) => id === tileId);
  renderBoard(tile ? `Tile ${tile.id} selected. Choose a legal flip.` : undefined);
}

function clearSelection(): void {
  if (activeFlip || selectedTileId === null) return;
  selectedTileId = null;
  renderBoard("Selection cleared.");
}

function beginFlip(tileId: number, move: OrthogonalFlip): void {
  if (activeFlip || selectedTileId !== tileId) return;
  activeFlip = { tileId, move };
  renderBoard(`Tile ${tileId} is flipping ${move.hinge}.`);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    settleFlip();
    return;
  }

  flipTimer = window.setTimeout(settleFlip, FLIP_DURATION_MS);
}

function settleFlip(): void {
  if (!activeFlip) return;
  const { tileId, move } = activeFlip;
  const tile = tiles.find(({ id }) => id === tileId);
  if (tile) {
    tile.column = move.destination.column;
    tile.row = move.destination.row;
  }
  activeFlip = null;
  selectedTileId = null;
  renderBoard(`Tile ${tileId} flipped ${move.hinge}.`);
}

function renderBoard(message?: string): void {
  const board = createSvgElement("svg");
  board.classList.add("board");
  board.setAttribute("viewBox", `0 0 ${BOARD_COLUMNS * CELL_SIZE} ${BOARD_ROWS * CELL_SIZE}`);
  board.setAttribute("role", "group");
  board.setAttribute("aria-label", "Eight by sixteen Tileturn board");
  board.addEventListener("click", (event) => {
    if (event.target === board || (event.target as Element).classList.contains("grid__cell")) {
      clearSelection();
    }
  });

  const boardBackground = createSvgElement("rect");
  boardBackground.classList.add("board__background");
  boardBackground.setAttribute("width", "100%");
  boardBackground.setAttribute("height", "100%");
  board.append(boardBackground);

  const grid = createSvgElement("g");
  grid.classList.add("grid");
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let column = 0; column < BOARD_COLUMNS; column += 1) {
      const cell = createSvgElement("rect");
      cell.classList.add("grid__cell");
      cell.setAttribute("x", String(column * CELL_SIZE));
      cell.setAttribute("y", String(row * CELL_SIZE));
      cell.setAttribute("width", String(CELL_SIZE));
      cell.setAttribute("height", String(CELL_SIZE));
      grid.append(cell);
    }
  }
  board.append(grid);

  const selectedTile = tiles.find(({ id }) => id === selectedTileId);
  const moveLayer = selectedTile && !activeFlip
    ? createMoveLayer(
        selectedTile,
        getLegalOrthogonalFlips(
          { columns: BOARD_COLUMNS, rows: BOARD_ROWS },
          selectedTile,
          tiles.filter(({ id }) => id !== selectedTile.id),
        ),
      )
    : null;

  const tileLayer = createSvgElement("g");
  tileLayer.classList.add("tiles");
  for (const tile of tiles) {
    tileLayer.append(createTileElement(tile));
  }
  board.append(tileLayer);
  if (moveLayer) board.append(moveLayer);
  boardFrame.replaceChildren(board);
  if (message !== undefined) status.textContent = message;
}

function createTileElement(tile: Tile): SVGGElement {
  const group = createSvgElement("g");
  const isSelected = tile.id === selectedTileId;
  group.classList.add("tile");
  if (isSelected) group.classList.add("tile--selected");
  group.dataset.tile = String(tile.id);
  group.setAttribute("role", "button");
  group.setAttribute("tabindex", activeFlip ? "-1" : "0");
  group.setAttribute("aria-pressed", String(isSelected));
  group.setAttribute("aria-label", `Tile ${tile.id} at column ${tile.column + 1}, row ${tile.row + 1}`);
  group.setAttribute("transform", `translate(${tile.column * CELL_SIZE} ${tile.row * CELL_SIZE})`);
  group.addEventListener("click", (event) => {
    event.stopPropagation();
    selectTile(tile.id);
  });
  group.addEventListener("keydown", (event) => activateOnKeyboard(event, () => selectTile(tile.id)));

  const flip = activeFlip?.tileId === tile.id ? activeFlip : null;
  if (flip) {
    group.classList.add("tile--flipping", `tile--flip-${flip.move.hinge}`);
  }

  const square = createSvgElement("rect");
  square.classList.add("tile__square");
  square.setAttribute("x", String(TILE_INSET));
  square.setAttribute("y", String(TILE_INSET));
  square.setAttribute("width", String(CELL_SIZE - TILE_INSET * 2));
  square.setAttribute("height", String(CELL_SIZE - TILE_INSET * 2));
  square.setAttribute("rx", "9");
  square.setAttribute("fill", tile.color);

  const label = createSvgElement("text");
  label.classList.add("tile__label");
  label.setAttribute("x", String(CELL_SIZE / 2));
  label.setAttribute("y", String(CELL_SIZE / 2));
  label.textContent = String(tile.id);
  const face = createSvgElement("g");
  face.classList.add("tile__face");
  const faceBounds = createSvgElement("rect");
  faceBounds.classList.add("tile__face-bounds");
  faceBounds.setAttribute("width", String(CELL_SIZE));
  faceBounds.setAttribute("height", String(CELL_SIZE));
  face.append(faceBounds, square, label);
  group.append(face);
  return group;
}

function createMoveLayer(tile: Tile, moves: OrthogonalFlip[]): SVGGElement {
  const layer = createSvgElement("g");
  layer.classList.add("moves");
  for (const move of moves) {
    const group = createSvgElement("g");
    group.classList.add("move");
    group.setAttribute("role", "button");
    group.setAttribute("tabindex", "0");
    group.setAttribute(
      "aria-label",
      `Flip tile ${tile.id} ${move.hinge} to column ${move.destination.column + 1}, row ${move.destination.row + 1}`,
    );
    group.addEventListener("click", (event) => {
      event.stopPropagation();
      beginFlip(tile.id, move);
    });
    group.addEventListener("keydown", (event) => activateOnKeyboard(event, () => beginFlip(tile.id, move)));

    const preview = createSvgElement("rect");
    preview.classList.add("move__preview");
    preview.setAttribute("x", String(move.destination.column * CELL_SIZE + TILE_INSET));
    preview.setAttribute("y", String(move.destination.row * CELL_SIZE + TILE_INSET));
    preview.setAttribute("width", String(CELL_SIZE - TILE_INSET * 2));
    preview.setAttribute("height", String(CELL_SIZE - TILE_INSET * 2));
    preview.setAttribute("rx", "9");

    const handle = createSvgElement("circle");
    const hingePoint = getHingePoint(tile, move.hinge);
    handle.classList.add("move__handle");
    handle.setAttribute("cx", String(hingePoint.x));
    handle.setAttribute("cy", String(hingePoint.y));
    handle.setAttribute("r", "20");
    handle.setAttribute("aria-hidden", "true");
    group.append(preview, handle);
    layer.append(group);
  }
  return layer;
}

function getHingePoint(tile: Tile, hinge: OrthogonalHinge): { x: number; y: number } {
  const left = tile.column * CELL_SIZE;
  const top = tile.row * CELL_SIZE;
  const centerX = left + CELL_SIZE / 2;
  const centerY = top + CELL_SIZE / 2;
  if (hinge === "north") return { x: centerX, y: top };
  if (hinge === "east") return { x: left + CELL_SIZE, y: centerY };
  if (hinge === "south") return { x: centerX, y: top + CELL_SIZE };
  return { x: left, y: centerY };
}

function activateOnKeyboard(event: KeyboardEvent, activate: () => void): void {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    event.stopPropagation();
    activate();
  }
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NAMESPACE, name);
}
