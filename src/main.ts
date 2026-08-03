import "./style.css";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const BOARD_COLUMNS = 8;
const BOARD_ROWS = 16;
const CELL_SIZE = 64;
const TILE_INSET = 4;

type Tile = {
  id: number;
  column: number;
  row: number;
  color: string;
};

const INITIAL_TILES: ReadonlyArray<Tile> = [
  { id: 1, column: 3, row: 6, color: "#22b8cf" },
  { id: 2, column: 4, row: 6, color: "#ff6b6b" },
  { id: 3, column: 3, row: 7, color: "#f4b942" },
  { id: 4, column: 4, row: 7, color: "#9b5de5" },
  { id: 5, column: 3, row: 8, color: "#4dd4ac" },
];

let tiles = cloneInitialTiles();

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
renderBoard();

function cloneInitialTiles(): Tile[] {
  return INITIAL_TILES.map((tile) => ({ ...tile }));
}

function resetBoard(): void {
  tiles = cloneInitialTiles();
  renderBoard();
  status.textContent = "Board reset to the starting arrangement.";
}

function renderBoard(): void {
  const board = createSvgElement("svg");
  board.classList.add("board");
  board.setAttribute(
    "viewBox",
    `0 0 ${BOARD_COLUMNS * CELL_SIZE} ${BOARD_ROWS * CELL_SIZE}`,
  );
  board.setAttribute("role", "img");
  board.setAttribute(
    "aria-label",
    "Eight by sixteen Tileturn board with five numbered tiles in the center",
  );

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

  const tileLayer = createSvgElement("g");
  tileLayer.classList.add("tiles");

  for (const tile of tiles) {
    const group = createSvgElement("g");
    group.classList.add("tile");
    group.dataset.tile = String(tile.id);
    group.setAttribute(
      "transform",
      `translate(${tile.column * CELL_SIZE} ${tile.row * CELL_SIZE})`,
    );

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

    group.append(square, label);
    tileLayer.append(group);
  }

  board.append(tileLayer);
  boardFrame.replaceChildren(board);
  status.textContent = "The board is ready. Tile movement is coming next.";
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  name: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NAMESPACE, name);
}
