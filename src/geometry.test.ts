import { describe, expect, it } from "vitest";

import {
  getLegalOrthogonalFlips,
  isEdgeConnected,
  reflectAcrossOrthogonalHinge,
  type GridSquare,
  canAddToGroup,
  canRemoveFromGroup,
  getExposedGroupHinges,
  getLegalGroupFlips,
  reflectGroupAcrossHinge,
  getEligibleDiagonalHinges,
  isConcaveTileGroup,
  verticesBelongToDifferentTiles,
} from "./geometry";

describe("group selection", () => {
  it("accepts edge additions and valid removals but rejects corner additions and splitting removals", () => {
    const group = [{ column: 2, row: 2 }, { column: 3, row: 2 }, { column: 2, row: 3 }];
    expect(canAddToGroup(group, { column: 3, row: 3 })).toBe(true);
    expect(canAddToGroup(group, { column: 4, row: 3 })).toBe(false);
    expect(canRemoveFromGroup(group, { column: 2, row: 3 })).toBe(true);
    expect(canRemoveFromGroup(group, { column: 2, row: 2 })).toBe(false);
  });
});

describe("isEdgeConnected", () => {
  it("accepts edge-connected groups and rejects corner-only contact", () => {
    expect(isEdgeConnected([{ column: 2, row: 2 }, { column: 3, row: 2 }, { column: 3, row: 3 }])).toBe(true);
    expect(isEdgeConnected([{ column: 2, row: 2 }, { column: 3, row: 3 }])).toBe(false);
  });
});

describe("reflectAcrossOrthogonalHinge", () => {
  it("reflects a square across each orthogonal edge", () => {
    const square = { column: 3, row: 6 };

    expect([
      reflectAcrossOrthogonalHinge(square, "north"),
      reflectAcrossOrthogonalHinge(square, "east"),
      reflectAcrossOrthogonalHinge(square, "south"),
      reflectAcrossOrthogonalHinge(square, "west"),
    ]).toEqual([
      { column: 3, row: 5 },
      { column: 4, row: 6 },
      { column: 3, row: 7 },
      { column: 2, row: 6 },
    ]);
  });
});

describe("getLegalOrthogonalFlips", () => {
  const board = { columns: 8, rows: 16 };

  it("offers every in-bounds adjacent destination", () => {
    expect(getLegalOrthogonalFlips(board, { column: 3, row: 6 }, [])).toEqual([
      { hinge: "north", destination: { column: 3, row: 5 } },
      { hinge: "east", destination: { column: 4, row: 6 } },
      { hinge: "south", destination: { column: 3, row: 7 } },
      { hinge: "west", destination: { column: 2, row: 6 } },
    ]);
  });

  it("rejects destinations beyond the board boundary", () => {
    expect(getLegalOrthogonalFlips(board, { column: 0, row: 0 }, [])).toEqual([
      { hinge: "east", destination: { column: 1, row: 0 } },
      { hinge: "south", destination: { column: 0, row: 1 } },
    ]);
  });

  it("rejects destinations occupied by unselected tiles", () => {
    const occupied: GridSquare[] = [
      { column: 3, row: 5 },
      { column: 4, row: 6 },
    ];

    expect(getLegalOrthogonalFlips(board, { column: 3, row: 6 }, occupied)).toEqual([
      { hinge: "south", destination: { column: 3, row: 7 } },
      { hinge: "west", destination: { column: 2, row: 6 } },
    ]);
  });

  it("rejects positions that do not map exactly to grid squares", () => {
    expect(getLegalOrthogonalFlips(board, { column: 3.5, row: 6 }, [])).toEqual([]);
  });

  it("deduplicates equivalent hinges and destinations", () => {
    const moves = getLegalOrthogonalFlips(
      board,
      { column: 3, row: 6 },
      [],
      ["north", "north", "west", "west"],
    );

    expect(moves).toEqual([
      { hinge: "north", destination: { column: 3, row: 5 } },
      { hinge: "west", destination: { column: 2, row: 6 } },
    ]);
  });
});


describe("group geometry", () => {
  const board = { columns: 8, rows: 16 };
  const group = [{ column: 3, row: 6 }, { column: 4, row: 6 }];

  it("uses exposed boundary edges and merges adjacent collinear segments", () => {
    const hinges = getExposedGroupHinges(group);
    expect(hinges).toContainEqual({ orientation: "horizontal", line: 6, start: 3, end: 5, side: "north" });
    expect(hinges).toContainEqual({ orientation: "horizontal", line: 7, start: 3, end: 5, side: "south" });
    expect(hinges).toHaveLength(4);
    expect(hinges.some(({ orientation, line }) => orientation === "vertical" && line === 4)).toBe(false);
  });

  it("reflects a complete rigid group across a supporting line", () => {
    expect(reflectGroupAcrossHinge(group, { orientation: "vertical", line: 5, start: 6, end: 7, side: "east" })).toEqual([{ column: 6, row: 6 }, { column: 5, row: 6 }]);
  });

  it("allows source-footprint reuse but rejects stationary collisions", () => {
    const sourceReuseGroup = [{ column: 3, row: 6 }, { column: 4, row: 6 }, { column: 3, row: 7 }];
    const moves = getLegalGroupFlips(board, sourceReuseGroup, []);
    expect(moves.some(({ destinations }) => destinations.every(({ column, row }) => ["3,6", "4,6", "4,7"].includes(column + "," + row)))).toBe(true);
    expect(getLegalGroupFlips(board, sourceReuseGroup, [{ column: 4, row: 7 }]).some(({ destinations }) => destinations.every(({ column, row }) => ["3,6", "4,6", "4,7"].includes(column + "," + row)))).toBe(false);
  });

  it("rejects the whole move at board boundaries or any destination collision", () => {
    expect(getLegalGroupFlips({ columns: 8, rows: 1 }, group, [])).toEqual([]);
    const partiallyBlocked = getLegalGroupFlips(board, group, [{ column: 3, row: 5 }]);
    expect(partiallyBlocked.some(({ hinge }) => hinge.orientation !== "diagonal" && hinge.side === "north")).toBe(false);
    expect(partiallyBlocked.length).toBeGreaterThan(0);
  });
});

describe("diagonal group geometry", () => {
  const board = { columns: 8, rows: 16 };
  const descendingL = [
    { column: 1, row: 1 },
    { column: 2, row: 1 },
    { column: 1, row: 2 },
  ];
  const ascendingL = [
    { column: 1, row: 1 },
    { column: 1, row: 2 },
    { column: 2, row: 2 },
  ];

  it("detects concavity and rejects convex or out-of-range groups", () => {
    expect(isConcaveTileGroup(descendingL)).toBe(true);
    expect(isConcaveTileGroup([{ column: 1, row: 1 }, { column: 2, row: 1 }, { column: 3, row: 1 }])).toBe(false);
    expect(isConcaveTileGroup([{ column: 1, row: 1 }, { column: 1, row: 2 }])).toBe(false);
    expect(isConcaveTileGroup([...descendingL, { column: 2, row: 2 }, { column: 3, row: 2 }, { column: 3, row: 3 }])).toBe(false);
  });

  it("finds contained 45-degree hinges whose endpoints belong to different tiles", () => {
    const hinges = getEligibleDiagonalHinges(descendingL);
    expect(hinges).toContainEqual({
      orientation: "diagonal",
      slope: -1,
      start: { x: 1, y: 3 },
      end: { x: 3, y: 1 },
    });
    expect(verticesBelongToDifferentTiles(descendingL, { x: 3, y: 1 }, { x: 1, y: 3 })).toBe(true);
    expect(verticesBelongToDifferentTiles([{ column: 0, row: 0 }], { x: 0, y: 0 }, { x: 1, y: 1 })).toBe(false);
    expect(getEligibleDiagonalHinges(ascendingL)).toContainEqual({
      orientation: "diagonal",
      slope: 1,
      start: { x: 1, y: 1 },
      end: { x: 3, y: 3 },
    });
  });

  it("rejects diagonal segments that cross unrelated empty space", () => {
    const separatedByNotch = [
      { column: 0, row: 0 },
      { column: 1, row: 0 },
      { column: 0, row: 1 },
      { column: 0, row: 2 },
      { column: 1, row: 2 },
    ];
    expect(getEligibleDiagonalHinges(separatedByNotch)).not.toContainEqual({
      orientation: "diagonal",
      slope: 1,
      start: { x: 0, y: 0 },
      end: { x: 2, y: 2 },
    });
  });

  it("reflects across the infinite supporting line in both diagonal orientations", () => {
    const descending = getEligibleDiagonalHinges(descendingL).find(
      ({ slope, start, end }) => slope === -1 && start.x === 1 && end.x === 3,
    )!;
    const ascending = getEligibleDiagonalHinges(ascendingL).find(
      ({ slope, start, end }) => slope === 1 && start.x === 1 && end.x === 3,
    )!;
    expect(reflectGroupAcrossHinge(descendingL, descending)).toEqual([
      { column: 2, row: 2 },
      { column: 2, row: 1 },
      { column: 1, row: 2 },
    ]);
    expect(reflectGroupAcrossHinge(ascendingL, ascending)).toEqual([
      { column: 1, row: 1 },
      { column: 2, row: 1 },
      { column: 2, row: 2 },
    ]);
  });

  it("combines orthogonal and diagonal moves while enforcing bounds and collisions", () => {
    const moves = getLegalGroupFlips(board, descendingL, []);
    const diagonal = moves.filter(({ hinge }) => hinge.orientation === "diagonal");
    const sourceKeys = new Set(descendingL.map(({ column, row }) => `${column},${row}`));
    const cornerFlip = diagonal.find(({ destinations }) => destinations.map(({ column, row }) => `${column},${row}`).sort().join(";") === "1,2;2,1;2,2");
    expect(cornerFlip).toBeDefined();
    expect(cornerFlip!.destinations.filter(({ column, row }) => sourceKeys.has(`${column},${row}`))).toHaveLength(2);
    expect(moves.some(({ hinge }) => hinge.orientation !== "diagonal")).toBe(true);

    const blocked = getLegalGroupFlips(board, descendingL, [{ column: 2, row: 2 }]);
    expect(blocked.some(({ destinations }) => destinations.some(({ column, row }) => column === 2 && row === 2))).toBe(false);
    const boundaryMoves = getLegalGroupFlips({ columns: 2, rows: 2 }, descendingL, []);
    expect(boundaryMoves.some(({ destinations }) => destinations.some(({ column, row }) => column < 0 || column >= 2 || row < 0 || row >= 2))).toBe(false);
  });

  it("maps every destination to integer squares and deduplicates equivalent results", () => {
    const hinges = getEligibleDiagonalHinges(descendingL);
    const supportingLines = hinges.map(({ slope, start }) => `${slope}:${slope === 1 ? start.y - start.x : start.y + start.x}`);
    expect(new Set(supportingLines).size).toBe(supportingLines.length);

    const diagonal = getLegalGroupFlips(board, descendingL, []).filter(
      ({ hinge }) => hinge.orientation === "diagonal",
    );
    expect(diagonal.every(({ destinations }) => destinations.every(({ column, row }) => Number.isInteger(column) && Number.isInteger(row)))).toBe(true);
    const footprints = diagonal.map(({ destinations }) => destinations.map(({ column, row }) => `${column},${row}`).sort().join(";"));
    expect(new Set(footprints).size).toBe(footprints.length);
  });
});
