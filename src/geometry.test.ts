import { describe, expect, it } from "vitest";

import {
  getLegalOrthogonalFlips,
  reflectAcrossOrthogonalHinge,
  type GridSquare,
} from "./geometry";

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
