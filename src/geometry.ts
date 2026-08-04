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

export function canAddToGroup(group: ReadonlyArray<GridSquare>, square: GridSquare): boolean {
  return isEdgeConnected([...group, square]);
}

export function canRemoveFromGroup(group: ReadonlyArray<GridSquare>, square: GridSquare): boolean {
  return isEdgeConnected(group.filter((candidate) => candidate.column !== square.column || candidate.row !== square.row));
}

export function isEdgeConnected(squares: ReadonlyArray<GridSquare>): boolean {
  if (squares.length <= 1) return true;
  const remaining = new Set(squares.map(squareKey));
  const first = squares[0];
  const frontier = [first];
  remaining.delete(squareKey(first));

  while (frontier.length > 0) {
    const square = frontier.pop()!;
    for (const neighbor of [
      { column: square.column, row: square.row - 1 },
      { column: square.column + 1, row: square.row },
      { column: square.column, row: square.row + 1 },
      { column: square.column - 1, row: square.row },
    ]) {
      const key = squareKey(neighbor);
      if (remaining.delete(key)) frontier.push(neighbor);
    }
  }

  return remaining.size === 0;
}

function squareKey({ column, row }: GridSquare): string {
  return column + "," + row;
}

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


export type GroupHinge = {
  orientation: "horizontal" | "vertical";
  line: number;
  start: number;
  end: number;
  side: OrthogonalHinge;
};

export type GroupFlip = { hinge: GroupHinge; destinations: GridSquare[] };

export function getExposedGroupHinges(group: ReadonlyArray<GridSquare>): GroupHinge[] {
  const selected = new Set(group.map(squareKey));
  const segments: GroupHinge[] = [];
  for (const square of group) {
    const edges: Array<{ neighbor: GridSquare; hinge: GroupHinge }> = [
      { neighbor: { column: square.column, row: square.row - 1 }, hinge: { orientation: "horizontal", line: square.row, start: square.column, end: square.column + 1, side: "north" } },
      { neighbor: { column: square.column + 1, row: square.row }, hinge: { orientation: "vertical", line: square.column + 1, start: square.row, end: square.row + 1, side: "east" } },
      { neighbor: { column: square.column, row: square.row + 1 }, hinge: { orientation: "horizontal", line: square.row + 1, start: square.column, end: square.column + 1, side: "south" } },
      { neighbor: { column: square.column - 1, row: square.row }, hinge: { orientation: "vertical", line: square.column, start: square.row, end: square.row + 1, side: "west" } },
    ];
    for (const edge of edges) if (!selected.has(squareKey(edge.neighbor))) segments.push(edge.hinge);
  }
  const buckets = new Map<string, GroupHinge[]>();
  for (const hinge of segments) {
    const key = hinge.orientation + ":" + hinge.line + ":" + hinge.side;
    const bucket = buckets.get(key) ?? [];
    bucket.push(hinge);
    buckets.set(key, bucket);
  }
  const merged: GroupHinge[] = [];
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => a.start - b.start);
    let previous: GroupHinge | undefined;
    for (const hinge of bucket) {
      if (previous && previous.end === hinge.start) previous.end = hinge.end;
      else { previous = { ...hinge }; merged.push(previous); }
    }
  }
  return merged;
}

export function reflectGroupAcrossHinge(group: ReadonlyArray<GridSquare>, hinge: GroupHinge): GridSquare[] {
  return group.map((square) => hinge.orientation === "horizontal"
    ? { column: square.column, row: 2 * hinge.line - square.row - 1 }
    : { column: 2 * hinge.line - square.column - 1, row: square.row });
}

export function getLegalGroupFlips(board: BoardSize, group: ReadonlyArray<GridSquare>, occupiedSquares: ReadonlyArray<GridSquare>): GroupFlip[] {
  if (group.length === 0 || !isEdgeConnected(group) || group.some(({ column, row }) => !Number.isInteger(column) || !Number.isInteger(row))) return [];
  const occupied = new Set(occupiedSquares.map(squareKey));
  const seen = new Set<string>();
  const moves: GroupFlip[] = [];
  for (const hinge of getExposedGroupHinges(group)) {
    const destinations = reflectGroupAcrossHinge(group, hinge);
    const legal = destinations.every(({ column, row }) => column >= 0 && column < board.columns && row >= 0 && row < board.rows && !occupied.has(squareKey({ column, row })));
    const footprint = destinations.map(squareKey).sort().join(";");
    if (legal && !seen.has(footprint)) { seen.add(footprint); moves.push({ hinge, destinations }); }
  }
  return moves;
}
