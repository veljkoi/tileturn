import { getLegalGroupFlips, isEdgeConnected, type BoardSize, type GridSquare } from "./geometry";

type RandomSource = () => number;
type CellPair = [GridSquare, GridSquare];

export function createAdjacentPairPool(board: BoardSize): CellPair[] {
  const pairs: CellPair[] = [];
  for (let row = 2; row < board.rows - 2; row += 1) {
    for (let column = 0; column < board.columns; column += 1) {
      const cell = { column, row };
      if (column + 1 < board.columns) pairs.push([cell, { column: column + 1, row }]);
      if (row + 1 < board.rows - 2) pairs.push([cell, { column, row: row + 1 }]);
    }
  }
  return pairs;
}

export function generateObstacles(
  board: BoardSize,
  movingTiles: ReadonlyArray<GridSquare>,
  count = 32,
  random: RandomSource = Math.random,
): GridSquare[] {
  const eligibleCellCount = board.columns * Math.max(0, board.rows - 4);
  if (count < 0 || count > eligibleCellCount) throw new Error("Obstacle count exceeds the eligible board area.");

  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    const obstacles = takeObstacleCells(createAdjacentPairPool(board), count, random);
    if (hasLegalOpeningMove(board, movingTiles, obstacles)) return obstacles;
  }
  throw new Error("Unable to generate an obstacle layout with a legal opening move.");
}

export function hasLegalOpeningMove(
  board: BoardSize,
  movingTiles: ReadonlyArray<GridSquare>,
  obstacles: ReadonlyArray<GridSquare>,
): boolean {
  for (let mask = 1; mask < 2 ** movingTiles.length; mask += 1) {
    const selected = movingTiles.filter((_, index) => mask & (1 << index));
    if (selected.length > 5 || !isEdgeConnected(selected)) continue;
    const unselected = movingTiles.filter((_, index) => !(mask & (1 << index)));
    if (getLegalGroupFlips(board, selected, [...unselected, ...obstacles]).length > 0) return true;
  }
  return false;
}

function takeObstacleCells(pool: CellPair[], count: number, random: RandomSource): GridSquare[] {
  shuffle(pool, random);
  const obstacles = new Map<string, GridSquare>();
  for (const pair of pool) {
    if (obstacles.size === count) break;
    const unseen = pair.filter((cell) => !obstacles.has(cellKey(cell)));
    if (unseen.length === 0) continue;
    if (obstacles.size === count - 1 && unseen.length === 2) {
      const chosen = unseen[Math.floor(random() * unseen.length)];
      obstacles.set(cellKey(chosen), chosen);
      break;
    }
    for (const cell of unseen) obstacles.set(cellKey(cell), cell);
  }
  if (obstacles.size !== count) throw new Error("Adjacent-cell pool could not provide the requested obstacles.");
  return [...obstacles.values()];
}

function shuffle<T>(values: T[], random: RandomSource): void {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [values[index], values[other]] = [values[other], values[index]];
  }
}

function cellKey({ column, row }: GridSquare): string {
  return `${column},${row}`;
}
