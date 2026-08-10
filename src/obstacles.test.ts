import { describe, expect, it } from "vitest";
import { createAdjacentPairPool, generateObstacles, hasLegalOpeningMove } from "./obstacles";

const board = { columns: 8, rows: 16 };
const movingTiles = [
  { column: 2, row: 14 }, { column: 3, row: 14 }, { column: 4, row: 14 },
  { column: 3, row: 15 }, { column: 4, row: 15 },
];

describe("obstacle generation", () => {
  it("builds unique orthogonally adjacent pairs inside the middle rows", () => {
    const pool = createAdjacentPairPool(board);
    const keys = pool.map(([first, second]) => `${first.column},${first.row}:${second.column},${second.row}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(pool.length).toBe(172);
    for (const [first, second] of pool) {
      expect(first.row).toBeGreaterThanOrEqual(2);
      expect(second.row).toBeLessThan(14);
      expect(Math.abs(first.column - second.column) + Math.abs(first.row - second.row)).toBe(1);
    }
  });

  it("returns exactly 32 unique eligible cells with a legal opening move", () => {
    const obstacles = generateObstacles(board, movingTiles, 32, seededRandom(15));
    expect(new Set(obstacles.map(({ column, row }) => `${column},${row}`)).size).toBe(32);
    expect(obstacles.every(({ column, row }) => column >= 0 && column < 8 && row >= 2 && row < 14)).toBe(true);
    expect(hasLegalOpeningMove(board, movingTiles, obstacles)).toBe(true);
  });

  it("rejects an impossible obstacle count", () => {
    expect(() => generateObstacles(board, movingTiles, 97)).toThrow(/exceeds/);
  });
});

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };
}
