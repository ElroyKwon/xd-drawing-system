export type SheetDisciplineCode = "A" | "E" | "M" | "P";

export type BuildProject = {
  id: string;
  name: string;
};

export type Sheet = {
  id: string;
  projectId: string;
  number: string;
  title: string;
  version: string;
  versionSet: string;
  disciplineCode: SheetDisciplineCode;
  disciplineLabel: string;
  tag: string;
  lastUpdatedBy: string;
};

export const selectedBuildProject: BuildProject = {
  id: "project-study",
  name: "Study_Project"
};

export const initialSheets: Sheet[] = [
  {
    id: "sheet-a001",
    projectId: selectedBuildProject.id,
    number: "A001",
    title: "ARCHITECTURAL- GRAPHIC SYMBOLS& ABBREVIATIONS",
    version: "1",
    versionSet: "Addendum 1",
    disciplineCode: "A",
    disciplineLabel: "A (건축)",
    tag: "architectural",
    lastUpdatedBy: "Forma Sample Proj..."
  },
  {
    id: "sheet-a101",
    projectId: selectedBuildProject.id,
    number: "A101",
    title: "OFFICE- FLOOR PLAN- LEVEL1",
    version: "1",
    versionSet: "Addendum 1",
    disciplineCode: "A",
    disciplineLabel: "A (건축)",
    tag: "architectural",
    lastUpdatedBy: "Forma Sample Proj..."
  },
  {
    id: "sheet-a102",
    projectId: selectedBuildProject.id,
    number: "A102",
    title: "OFFICE- FLOOR PLAN- LEVEL 2,3&4",
    version: "1",
    versionSet: "Addendum 1",
    disciplineCode: "A",
    disciplineLabel: "A (건축)",
    tag: "architectural",
    lastUpdatedBy: "Forma Sample Proj..."
  },
  {
    id: "sheet-e101",
    projectId: selectedBuildProject.id,
    number: "E101",
    title: "OFFICE- POWER PLAN- LEVEL1",
    version: "1",
    versionSet: "Addendum 1",
    disciplineCode: "E",
    disciplineLabel: "E (전기)",
    tag: "electrical",
    lastUpdatedBy: "Forma Sample Proj..."
  },
  {
    id: "sheet-m101",
    projectId: selectedBuildProject.id,
    number: "M101",
    title: "OFFICE- MECHANICAL PLAN- LEVEL1",
    version: "1",
    versionSet: "Addendum 1",
    disciplineCode: "M",
    disciplineLabel: "M (기계)",
    tag: "mechanical",
    lastUpdatedBy: "Forma Sample Proj..."
  },
  {
    id: "sheet-p101",
    projectId: selectedBuildProject.id,
    number: "P101",
    title: "OFFICE- PLUMBING PLAN- LEVEL1",
    version: "1",
    versionSet: "Addendum 1",
    disciplineCode: "P",
    disciplineLabel: "P (배관)",
    tag: "plumbing",
    lastUpdatedBy: "Forma Sample Proj..."
  }
];

export function filterSheets(projectId: string, sheets: Sheet[], query: string): Sheet[] {
  const projectSheets = sheets.filter((sheet) => sheet.projectId === projectId);
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return projectSheets;
  }

  return projectSheets.filter((sheet) => {
    return [sheet.number, sheet.title, sheet.disciplineLabel, sheet.tag].some((value) =>
      value.toLowerCase().includes(normalized)
    );
  });
}
