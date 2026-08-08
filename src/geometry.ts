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


export type OrthogonalGroupHinge = {
  orientation: "horizontal" | "vertical";
  line: number;
  start: number;
  end: number;
  side: OrthogonalHinge;
};

export type Vertex = { x: number; y: number };

export type DiagonalHinge = {
  orientation: "diagonal";
  slope: -1 | 1;
  start: Vertex;
  end: Vertex;
};

export type GroupHinge = OrthogonalGroupHinge | DiagonalHinge;

export type GroupFlip = { hinge: GroupHinge; destinations: GridSquare[] };

function tileVertices(group: ReadonlyArray<GridSquare>): Vertex[] {
  const vertices = new Map<string, Vertex>();
  for (const { column, row } of group) {
    for (const vertex of [
      { x: column, y: row }, { x: column + 1, y: row },
      { x: column, y: row + 1 }, { x: column + 1, y: row + 1 },
    ]) vertices.set(`${vertex.x},${vertex.y}`, vertex);
  }
  return [...vertices.values()];
}

function cross(origin: Vertex, first: Vertex, second: Vertex): number {
  return (first.x - origin.x) * (second.y - origin.y) -
    (first.y - origin.y) * (second.x - origin.x);
}

/** Returns maximal-edge hull vertices in cyclic order, without a repeated endpoint. */
export function getConvexHull(group: ReadonlyArray<GridSquare>): Vertex[] {
  const points = tileVertices(group).sort((a, b) => a.x - b.x || a.y - b.y);
  if (points.length <= 1) return points;
  const halfHull = (ordered: ReadonlyArray<Vertex>): Vertex[] => {
    const half: Vertex[] = [];
    for (const point of ordered) {
      while (half.length >= 2 && cross(half[half.length - 2], half[half.length - 1], point) <= 0) half.pop();
      half.push(point);
    }
    return half;
  };
  const lower = halfHull(points);
  const upper = halfHull([...points].reverse());
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

/** Finds eligible maximal edges of the selected tiles convex hull. */
export function getGroupHinges(group: ReadonlyArray<GridSquare>): GroupHinge[] {
  if (group.length < 1 || group.length > 5 || !isEdgeConnected(group) ||
      group.some(({ column, row }) => !Number.isInteger(column) || !Number.isInteger(row))) return [];
  const hull = getConvexHull(group);
  const center = {
    x: group.reduce((sum, square) => sum + square.column + 0.5, 0) / group.length,
    y: group.reduce((sum, square) => sum + square.row + 0.5, 0) / group.length,
  };
  return hull.flatMap((start, index): GroupHinge[] => {
    const end = hull[(index + 1) % hull.length];
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    if (deltaY === 0) return [{ orientation: "horizontal", line: start.y, start: Math.min(start.x, end.x), end: Math.max(start.x, end.x), side: center.y > start.y ? "north" : "south" }];
    if (deltaX === 0) return [{ orientation: "vertical", line: start.x, start: Math.min(start.y, end.y), end: Math.max(start.y, end.y), side: center.x > start.x ? "west" : "east" }];
    if (Math.abs(deltaX) !== Math.abs(deltaY)) return [];
    const [orderedStart, orderedEnd] = start.x < end.x ? [start, end] : [end, start];
    return [{ orientation: "diagonal", slope: (orderedEnd.y - orderedStart.y) / (orderedEnd.x - orderedStart.x) as -1 | 1, start: orderedStart, end: orderedEnd }];
  });
}


export function reflectGroupAcrossHinge(group: ReadonlyArray<GridSquare>, hinge: GroupHinge): GridSquare[] {
  if (hinge.orientation === "diagonal") {
    if (hinge.slope === 1) {
      const intercept = hinge.start.y - hinge.start.x;
      return group.map(({ column, row }) => ({ column: row - intercept, row: column + intercept }));
    }
    const intercept = hinge.start.y + hinge.start.x;
    return group.map(({ column, row }) => ({
      column: intercept - row - 1,
      row: intercept - column - 1,
    }));
  }
  if (hinge.orientation === "horizontal") {
    return group.map((square) => ({ column: square.column, row: 2 * hinge.line - square.row - 1 }));
  }
  return group.map((square) => ({ column: 2 * hinge.line - square.column - 1, row: square.row }));
}

export function getLegalGroupFlips(board: BoardSize, group: ReadonlyArray<GridSquare>, occupiedSquares: ReadonlyArray<GridSquare>): GroupFlip[] {
  const occupied = new Set(occupiedSquares.map(squareKey));
  const seen = new Set<string>();
  const moves: GroupFlip[] = [];
  for (const hinge of getGroupHinges(group)) {
    const destinations = reflectGroupAcrossHinge(group, hinge);
    const legal = destinations.every(({ column, row }) => Number.isInteger(column) && Number.isInteger(row) && column >= 0 && column < board.columns && row >= 0 && row < board.rows && !occupied.has(squareKey({ column, row })));
    const footprint = destinations.map(squareKey).sort().join(";");
    if (legal && !seen.has(footprint)) { seen.add(footprint); moves.push({ hinge, destinations }); }
  }
  return moves;
}
