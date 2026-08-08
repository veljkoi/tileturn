import { describe, expect, it } from "vitest";

import {
  getLegalOrthogonalFlips,
  isEdgeConnected,
  reflectAcrossOrthogonalHinge,
  type GridSquare,
  canAddToGroup,
  canRemoveFromGroup,
  getConvexHull,
  getGroupHinges,
  getLegalGroupFlips,
  reflectGroupAcrossHinge,
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


describe("convex-hull group geometry", () => {
  const board = { columns: 8, rows: 16 };
  const pair = [{ column: 3, row: 6 }, { column: 4, row: 6 }];
  const lGroup = [
    { column: 1, row: 1 }, { column: 2, row: 1 }, { column: 1, row: 2 },
  ];

  it("builds a hull from tile corners and removes intermediate collinear vertices", () => {
    expect(getConvexHull([
      { column: 0, row: 0 }, { column: 1, row: 0 }, { column: 2, row: 0 },
    ])).toEqual([
      { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 0, y: 1 },
    ]);
  });

  it("uses each maximal orthogonal hull edge as one hinge", () => {
    expect(getGroupHinges(pair)).toEqual(expect.arrayContaining([
      { orientation: "horizontal", line: 6, start: 3, end: 5, side: "north" },
      { orientation: "vertical", line: 5, start: 6, end: 7, side: "east" },
      { orientation: "horizontal", line: 7, start: 3, end: 5, side: "south" },
      { orientation: "vertical", line: 3, start: 6, end: 7, side: "west" },
    ]));
    expect(getGroupHinges(pair)).toHaveLength(4);
  });

  it("includes exact 45-degree hull edges", () => {
    expect(getGroupHinges(lGroup)).toContainEqual({
      orientation: "diagonal", slope: -1,
      start: { x: 2, y: 3 }, end: { x: 3, y: 2 },
    });
  });

  it("ignores hull edges at other angles", () => {
    const irregular = [
      { column: 0, row: 0 }, { column: 1, row: 0 },
      { column: 2, row: 0 }, { column: 0, row: 1 },
    ];
    const hinges = getGroupHinges(irregular);
    expect(getConvexHull(irregular)).toContainEqual({ x: 3, y: 1 });
    expect(hinges.some((hinge) => hinge.orientation === "diagonal")).toBe(false);
    expect(hinges).toHaveLength(4);
  });

  it("requires 1 to 5 edge-connected integer-positioned tiles", () => {
    expect(getGroupHinges([])).toEqual([]);
    expect(getGroupHinges(Array.from({ length: 6 }, (_, column) => ({ column, row: 0 })))).toEqual([]);
    expect(getGroupHinges([{ column: 0, row: 0 }, { column: 1, row: 1 }])).toEqual([]);
    expect(getGroupHinges([{ column: 0, row: 0 }, { column: 1.5, row: 0 }])).toEqual([]);
  });



  it("turns one tile over each legal edge", () => {
    const square = { column: 3, row: 6 };
    expect(getGroupHinges([square])).toEqual(expect.arrayContaining([
      { orientation: "horizontal", line: 6, start: 3, end: 4, side: "north" },
      { orientation: "vertical", line: 4, start: 6, end: 7, side: "east" },
      { orientation: "horizontal", line: 7, start: 3, end: 4, side: "south" },
      { orientation: "vertical", line: 3, start: 6, end: 7, side: "west" },
    ]));
    expect(getLegalGroupFlips(board, [square], []).map(({ destinations }) => destinations[0])).toEqual(expect.arrayContaining([
      { column: 3, row: 5 }, { column: 4, row: 6 },
      { column: 3, row: 7 }, { column: 2, row: 6 },
    ]));
  });

  it("filters blocked and out-of-bounds single-tile turns", () => {
    const moves = getLegalGroupFlips(
      { columns: 2, rows: 2 },
      [{ column: 0, row: 0 }],
      [{ column: 1, row: 0 }],
    );
    expect(moves).toHaveLength(1);
    expect(moves[0].destinations).toEqual([{ column: 0, row: 1 }]);
  });

  it("reflects the rigid group across the infinite supporting line", () => {
    const diagonal = getGroupHinges(lGroup).find((hinge) => hinge.orientation === "diagonal")!;
    expect(reflectGroupAcrossHinge(lGroup, diagonal)).toEqual([
      { column: 3, row: 3 }, { column: 3, row: 2 }, { column: 2, row: 3 },
    ]);
  });

  it("separates hinge discovery from atomic legal-turn filtering", () => {
    const diagonal = getGroupHinges(lGroup).find((hinge) => hinge.orientation === "diagonal");
    expect(diagonal).toBeDefined();
    expect(getLegalGroupFlips(board, lGroup, []).some((move) => move.hinge.orientation === "diagonal")).toBe(true);
    expect(getLegalGroupFlips(board, lGroup, [{ column: 3, row: 3 }]).some((move) => move.hinge.orientation === "diagonal")).toBe(false);
    expect(getLegalGroupFlips({ columns: 3, rows: 3 }, lGroup, []).some((move) => move.hinge.orientation === "diagonal")).toBe(false);
  });

  it("rejects an entire orthogonal turn after one collision", () => {
    const moves = getLegalGroupFlips(board, pair, [{ column: 3, row: 5 }]);
    expect(moves.some(({ hinge }) => hinge.orientation !== "diagonal" && hinge.side === "north")).toBe(false);
    expect(moves.length).toBeGreaterThan(0);
  });
});
