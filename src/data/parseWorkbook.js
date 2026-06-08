import * as XLSX from "xlsx";

const FIELD_ALIASES = {
  majorCategory: ["major category", "major categories", "category"],
  subcategory: ["subcategory", "sub category", "sub-category"],
  questionTitle: ["question title", "question"],
  context: ["context"],
  whyItMatters: ["why it matters", "why this matters"],
  howToSolve: ["how to solve", "how it solve", "how"],
  subQuestions: ["sub questions", "sub-questions", "subquestions"],
  bestResources: ["best resources", "resources", "resource links"],
  lastUpdated: ["last updated", "updated", "date updated"],
};

const EMPTY_LABEL = "Uncategorized";

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stringifyCell(value) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function toDisplayDate(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }

  const text = stringifyCell(value);
  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  return text;
}

function buildHeaderMap(headerRow) {
  const normalizedHeaders = headerRow.map(normalizeHeader);

  return Object.fromEntries(
    Object.entries(FIELD_ALIASES).map(([field, aliases]) => {
      const index = aliases
        .map(normalizeHeader)
        .map((alias) => normalizedHeaders.indexOf(alias))
        .find((candidate) => candidate !== -1);

      return [field, index ?? -1];
    }),
  );
}

function getCell(row, headerMap, field) {
  const columnIndex = headerMap[field];
  if (columnIndex == null || columnIndex < 0) return "";
  return row[columnIndex];
}

function normalizeQuestion(row, headerMap, rowNumber) {
  const questionTitle = stringifyCell(getCell(row, headerMap, "questionTitle"));
  if (!questionTitle) return null;

  return {
    id: `q-${rowNumber}-${questionTitle.slice(0, 40).replace(/\W+/g, "-").toLowerCase()}`,
    majorCategory: stringifyCell(getCell(row, headerMap, "majorCategory")) || EMPTY_LABEL,
    subcategory: stringifyCell(getCell(row, headerMap, "subcategory")) || EMPTY_LABEL,
    questionTitle,
    context: stringifyCell(getCell(row, headerMap, "context")),
    whyItMatters: stringifyCell(getCell(row, headerMap, "whyItMatters")),
    howToSolve: stringifyCell(getCell(row, headerMap, "howToSolve")),
    subQuestions: stringifyCell(getCell(row, headerMap, "subQuestions")),
    bestResources: stringifyCell(getCell(row, headerMap, "bestResources")),
    lastUpdated: toDisplayDate(getCell(row, headerMap, "lastUpdated")),
  };
}

function parseRows(rows, sourceName) {
  const headerRowIndex = rows.findIndex((row) =>
    row.some((value) => normalizeHeader(value) === "question title"),
  );

  if (headerRowIndex === -1) {
    throw new Error("Could not find a header row containing 'Question Title'.");
  }

  const headerMap = buildHeaderMap(rows[headerRowIndex]);
  const missingRequired = ["majorCategory", "subcategory", "questionTitle"].filter(
    (field) => headerMap[field] < 0,
  );

  if (missingRequired.length > 0) {
    throw new Error(`Missing required column(s): ${missingRequired.join(", ")}`);
  }

  const questions = rows
    .slice(headerRowIndex + 1)
    .map((row, offset) => normalizeQuestion(row, headerMap, headerRowIndex + offset + 2))
    .filter(Boolean);

  return { questions, sheetName: sourceName };
}

function parseWorkbook(workbook) {
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("The workbook does not contain any worksheets.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: true,
  });

  return parseRows(rows, sheetName);
}

export function parseCsvText(csvText, sourceName = "Published CSV") {
  const workbook = XLSX.read(csvText, {
    type: "string",
    raw: true,
  });

  return { ...parseWorkbook(workbook), sheetName: sourceName };
}

export async function parseWorkbookFromArrayBuffer(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, {
    type: "array",
    cellDates: true,
  });

  return parseWorkbook(workbook);
}

export async function parseWorkbookFromFile(file) {
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
    const text = await file.text();
    return parseCsvText(text, file.name);
  }

  const buffer = await file.arrayBuffer();
  return parseWorkbookFromArrayBuffer(buffer);
}
