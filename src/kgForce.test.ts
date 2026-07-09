import { describe, it, expect } from "vitest";
import { layout } from "./kgForce";

describe("kgForce", () => {
  it("결정적: 같은 입력 → 같은 좌표(시계·난수 없음)", () => {
    const nodes = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const edges = [{ src: "a", dst: "b" }, { src: "b", dst: "c" }];
    const a = layout(nodes, edges, 800, 600, 50);
    const b = layout(nodes, edges, 800, 600, 50);
    expect(a).toEqual(b);
    expect(a.a.x).toBeGreaterThan(0);
  });

  it("연결된 노드는 무한대로 흩어지지 않는다(경계 내)", () => {
    const nodes = [{ id: "a" }, { id: "b" }];
    const pos = layout(nodes, [{ src: "a", dst: "b" }], 800, 600, 100);
    for (const id of ["a", "b"]) {
      expect(pos[id].x).toBeGreaterThanOrEqual(0);
      expect(pos[id].x).toBeLessThanOrEqual(800);
    }
  });
});
