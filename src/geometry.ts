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

export function getExposedGroupHinges(group: ReadonlyArray<GridSquare>): OrthogonalGroupHinge[] {
  const selected = new Set(group.map(squareKey));
  const segments: OrthogonalGroupHinge[] = [];
  for (const square of group) {
    const edges: Array<{ neighbor: GridSquare; hinge: OrthogonalGroupHinge }> = [
      { neighbor: { column: square.column, row: square.row - 1 }, hinge: { orientation: "horizontal", line: square.row, start: square.column, end: square.column + 1, side: "north" } },
      { neighbor: { column: square.column + 1, row: square.row }, hinge: { orientation: "vertical", line: square.column + 1, start: square.row, end: square.row + 1, side: "east" } },
      { neighbor: { column: square.column, row: square.row + 1 }, hinge: { orientation: "horizontal", line: square.row + 1, start: square.column, end: square.column + 1, side: "south" } },
      { neighbor: { column: square.column - 1, row: square.row }, hinge: { orientation: "vertical", line: square.column, start: square.row, end: square.row + 1, side: "west" } },
    ];
    for (const edge of edges) if (!selected.has(squareKey(edge.neighbor))) segments.push(edge.hinge);
  }
  const buckets = new Map<string, OrthogonalGroupHinge[]>();
  for (const hinge of segments) {
    const key = hinge.orientation + ":" + hinge.line + ":" + hinge.side;
    const bucket = buckets.get(key) ?? [];
    bucket.push(hinge);
    buckets.set(key, bucket);
  }
  const merged: OrthogonalGroupHinge[] = [];
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => a.start - b.start);
    let previous: OrthogonalGroupHinge | undefined;
    for (const hinge of bucket) {
      if (previous && previous.end === hinge.start) previous.end = hinge.end;
      else { previous = { ...hinge }; merged.push(previous); }
    }
  }
  return merged;
}

function tilesOwningVertex(group: ReadonlyArray<GridSquare>, vertex: Vertex): GridSquare[] {
  return group.filter(({ column, row }) =>
    (vertex.x === column || vertex.x === column + 1) &&
    (vertex.y === row || vertex.y === row + 1),
  );
}

export function verticesBelongToDifferentTiles(
  group: ReadonlyArray<GridSquare>,
  start: Vertex,
  end: Vertex,
): boolean {
  const startOwners = tilesOwningVertex(group, start);
  const endOwners = tilesOwningVertex(group, end);
  return startOwners.some((first) =>
    endOwners.some((second) => squareKey(first) !== squareKey(second)),
  );
}

function boundaryVertices(group: ReadonlyArray<GridSquare>): Vertex[] {
  const vertices = new Map<string, Vertex>();
  for (const { column, row } of group) {
    for (const vertex of [
      { x: column, y: row },
      { x: column + 1, y: row },
      { x: column, y: row + 1 },
      { x: column + 1, y: row + 1 },
    ]) vertices.set(`${vertex.x},${vertex.y}`, vertex);
  }
  return [...vertices.values()].filter((vertex) => {
    const ownershipCount = tilesOwningVertex(group, vertex).length;
    return ownershipCount > 0 && ownershipCount < 4;
  });
}

export function isConcaveTileGroup(group: ReadonlyArray<GridSquare>): boolean {
  if (group.length < 3 || group.length > 5 || !isEdgeConnected(group)) return false;
  return boundaryVertices(group).some((vertex) => tilesOwningVertex(group, vertex).length === 3);
}

function segmentIsContained(group: ReadonlyArray<GridSquare>, start: Vertex, end: Vertex): boolean {
  const selected = new Set(group.map(squareKey));
  const steps = Math.abs(end.x - start.x);
  for (let step = 0; step < steps; step += 1) {
    const t = (step + 0.5) / steps;
    const point = {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
    };
    if (!selected.has(squareKey({ column: Math.floor(point.x), row: Math.floor(point.y) }))) return false;
  }
  return true;
}

export function getEligibleDiagonalHinges(group: ReadonlyArray<GridSquare>): DiagonalHinge[] {
  if (!isConcaveTileGroup(group)) return [];
  const vertices = boundaryVertices(group);
  const hingesBySupportingLine = new Map<string, DiagonalHinge>();
  for (let firstIndex = 0; firstIndex < vertices.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < vertices.length; secondIndex += 1) {
      let start = vertices[firstIndex];
      let end = vertices[secondIndex];
      const deltaX = end.x - start.x;
      const deltaY = end.y - start.y;
      if (Math.abs(deltaX) !== Math.abs(deltaY) || deltaX === 0) continue;
      if (!verticesBelongToDifferentTiles(group, start, end) || !segmentIsContained(group, start, end)) continue;
      if (start.x > end.x || (start.x === end.x && start.y > end.y)) [start, end] = [end, start];
      const slope = (end.y - start.y) / (end.x - start.x) as -1 | 1;
      const intercept = slope === 1 ? start.y - start.x : start.y + start.x;
      const supportingLineKey = `${slope}:${intercept}`;
      const existing = hingesBySupportingLine.get(supportingLineKey);
      if (!existing || Math.abs(end.x - start.x) > Math.abs(existing.end.x - existing.start.x)) {
        hingesBySupportingLine.set(supportingLineKey, { orientation: "diagonal", slope, start, end });
      }
    }
  }
  return [...hingesBySupportingLine.values()];
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
  if (group.length === 0 || !isEdgeConnected(group) || group.some(({ column, row }) => !Number.isInteger(column) || !Number.isInteger(row))) return [];
  const occupied = new Set(occupiedSquares.map(squareKey));
  const seen = new Set<string>();
  const moves: GroupFlip[] = [];
  for (const hinge of [...getExposedGroupHinges(group), ...getEligibleDiagonalHinges(group)]) {
    const destinations = reflectGroupAcrossHinge(group, hinge);
    const legal = destinations.every(({ column, row }) => Number.isInteger(column) && Number.isInteger(row) && column >= 0 && column < board.columns && row >= 0 && row < board.rows && !occupied.has(squareKey({ column, row })));
    const footprint = destinations.map(squareKey).sort().join(";");
    if (legal && !seen.has(footprint)) { seen.add(footprint); moves.push({ hinge, destinations }); }
  }
  return moves;
}
