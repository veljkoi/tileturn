export type GridSquare = {
  column: number;
  row: number;
};

export type BoardSize = {
  columns: number;
  rows: number;
};

export type OrthogonalHinge = "north" | "east" | "south" | "west";

export type OrthogonalFlip = {
  hinge: OrthogonalHinge;
  destination: GridSquare;
};

const ORTHOGONAL_HINGES: ReadonlyArray<OrthogonalHinge> = [
  "north",
  "east",
  "south",
  "west",
];

export function reflectAcrossOrthogonalHinge(
  square: GridSquare,
  hinge: OrthogonalHinge,
): GridSquare {
  const offsets: Record<OrthogonalHinge, GridSquare> = {
    north: { column: 0, row: -1 },
    east: { column: 1, row: 0 },
    south: { column: 0, row: 1 },
    west: { column: -1, row: 0 },
  };
  const offset = offsets[hinge];

  return {
    column: square.column + offset.column,
    row: square.row + offset.row,
  };
}

export function getLegalOrthogonalFlips(
  board: BoardSize,
  square: GridSquare,
  occupiedSquares: ReadonlyArray<GridSquare>,
  hinges: ReadonlyArray<OrthogonalHinge> = ORTHOGONAL_HINGES,
): OrthogonalFlip[] {
  if (!Number.isInteger(square.column) || !Number.isInteger(square.row)) return [];

  const moves: OrthogonalFlip[] = [];
  const seenDestinations = new Set<string>();

  for (const hinge of hinges) {
    const destination = reflectAcrossOrthogonalHinge(square, hinge);
    const destinationKey = `${destination.column},${destination.row}`;
    const isInBounds =
      destination.column >= 0 &&
      destination.column < board.columns &&
      destination.row >= 0 &&
      destination.row < board.rows;
    const isOccupied = occupiedSquares.some(
      (occupied) =>
        occupied.column === destination.column && occupied.row === destination.row,
    );

    if (isInBounds && !isOccupied && !seenDestinations.has(destinationKey)) {
      moves.push({ hinge, destination });
      seenDestinations.add(destinationKey);
    }
  }

  return moves;
}
