import { describe, expect, it } from "vitest";
import { filterSheets, initialSheets, selectedBuildProject } from "./buildSheetsData";

describe("build sheets data helpers", () => {
  it("provides six local mock sheets for the selected project", () => {
    const rows = filterSheets(selectedBuildProject.id, initialSheets, "");

    expect(rows).toHaveLength(6);
    expect(rows.map((sheet) => sheet.number)).toEqual(["A001", "A101", "A102", "E101", "M101", "P101"]);
  });

  it("filters sheets by number, title, discipline, and tag", () => {
    expect(filterSheets(selectedBuildProject.id, initialSheets, "A101").map((sheet) => sheet.number)).toEqual(["A101"]);
    expect(filterSheets(selectedBuildProject.id, initialSheets, "level1").map((sheet) => sheet.number)).toEqual([
      "A101",
      "E101",
      "M101",
      "P101"
    ]);
    expect(filterSheets(selectedBuildProject.id, initialSheets, "기계").map((sheet) => sheet.number)).toEqual(["M101"]);
    expect(filterSheets(selectedBuildProject.id, initialSheets, "plumbing").map((sheet) => sheet.number)).toEqual(["P101"]);
  });

  it("does not return sheets from another project", () => {
    const rows = filterSheets("project-seaport", initialSheets, "");

    expect(rows).toHaveLength(0);
  });
});
