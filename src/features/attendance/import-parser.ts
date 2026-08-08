import * as XLSX from "@e965/xlsx";
import { inflateRawSync } from "node:zlib";

import type { AttendanceStatus } from "@/types/database";

const MONTHS = new Map(
  [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december"
  ].map((month, index) => [month, index + 1])
);

const STATUS_MAP: Record<string, AttendanceStatus> = {
  P: "present",
  PRESENT: "present",
  A: "absent",
  ABSENT: "absent",
  HD: "half_day",
  HALFDAY: "half_day",
  LV: "leave",
  L: "leave",
  LEAVE: "leave",
  HL: "holiday",
  HOLIDAY: "holiday",
  WO: "holiday",
  WEEKOFF: "holiday",
  WEEKLYOFF: "holiday"
};

const XLSX_MAX_ARCHIVE_ENTRIES = 500;
const XLSX_MAX_EXPANDED_BYTES = 25 * 1024 * 1024;
const XLSX_MAX_ENTRY_BYTES = 10 * 1024 * 1024;
const XLSX_MAX_COMPRESSION_RATIO = 200;
const WORKBOOK_MAX_SHEETS = 20;
const SHEET_MAX_ROWS = 5000;
const SHEET_MAX_COLUMNS = 256;
const WORKBOOK_MAX_DECLARED_CELLS = 500_000;

export type ParsedAttendanceDay = {
  attendanceDate: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  sourceStatus: string;
  status: AttendanceStatus;
  totalHours: number | null;
};

export type ParsedAttendanceWorker = {
  blankStatusCount: number;
  days: ParsedAttendanceDay[];
  futureDateCount: number;
  sourceCode: string | null;
  sourceName: string;
  unknownStatusCount: number;
};

export type ParsedAttendanceWorkbook = {
  reportMonth: string;
  sourceWorkers: ParsedAttendanceWorker[];
  warnings: string[];
};

export type AttendanceWorkerMatch = ParsedAttendanceWorker & {
  matchState: "ambiguous" | "matched" | "unmatched";
  workerId: string | null;
  workerName: string | null;
};

type TenantWorkerReference = { id: string; name: string };
type CellValue = boolean | number | string | null | undefined;

function cleanCell(value: CellValue) {
  return String(value ?? "").replace(/\u00a0/g, " ").trim();
}

function compactLabel(value: CellValue) {
  return cleanCell(value).replace(/[.:\s_-]+/g, "").toLocaleLowerCase("en-IN");
}

function findLabel(row: CellValue[], label: string) {
  const target = compactLabel(label);
  return row.findIndex((value) => compactLabel(value) === target);
}

function nextValue(row: CellValue[], afterIndex: number) {
  for (let index = afterIndex + 1; index < row.length; index += 1) {
    const value = cleanCell(row[index]);
    if (value) return value;
  }
  return "";
}

function parseReportMonth(value: string) {
  const normalized = value.trim().toLocaleLowerCase("en-IN");
  const match = normalized.match(/^([a-z]+)[\s/-]+(\d{4})$/);
  if (!match) return null;
  const month = MONTHS.get(match[1]);
  if (!month) return null;
  return `${match[2]}-${String(month).padStart(2, "0")}`;
}

function validIsoDate(reportMonth: string, day: number) {
  const [year, month] = reportMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function parseClockTime(value: CellValue) {
  const text = cleanCell(value);
  if (!text || /^-+:-+$/.test(text)) return null;
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseDurationHours(value: CellValue) {
  const text = cleanCell(value);
  if (!text || /^-+:-+$/.test(text)) return null;
  const match = text.match(/^(\d{1,3}):(\d{2})(?::\d{2})?$/);
  if (match) {
    const minutes = Number(match[2]);
    if (minutes > 59) return null;
    return Math.round((Number(match[1]) + minutes / 60) * 100) / 100;
  }
  const numeric = Number(text);
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 24 ? Math.round(numeric * 100) / 100 : null;
}

function assertWorkbookSignature(buffer: Uint8Array, fileName: string) {
  const extension = fileName.toLocaleLowerCase("en-IN").split(".").pop();
  if (extension !== "xls" && extension !== "xlsx") {
    throw new Error("Choose a valid Excel workbook (.xls or .xlsx).");
  }
  const isLegacyXls = buffer.length >= 8 && [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((byte, index) => buffer[index] === byte);
  const isZipXlsx = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  if (!isLegacyXls && !isZipXlsx) throw new Error("Choose a valid Excel workbook (.xls or .xlsx).");
  const detectedExtension = isZipXlsx ? "xlsx" : "xls";
  if (extension !== detectedExtension) {
    throw new Error(`The workbook content is ${detectedExtension.toUpperCase()} but the file extension is .${extension}. Rename or export the file correctly.`);
  }
  return detectedExtension;
}

function preflightXlsxArchive(buffer: Uint8Array) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const minimumEocdOffset = Math.max(0, buffer.byteLength - 65_557);
  let eocdOffset = -1;
  for (let offset = buffer.byteLength - 22; offset >= minimumEocdOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("Choose a valid Excel workbook (.xlsx archive is incomplete).");

  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralDirectorySize = view.getUint32(eocdOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const commentLength = view.getUint16(eocdOffset + 20, true);
  if (eocdOffset + 22 + commentLength !== buffer.byteLength) {
    throw new Error("Choose a valid Excel workbook (.xlsx end record is invalid).");
  }
  if (entryCount === 0xffff || centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
    throw new Error("The workbook archive is too large. ZIP64 workbooks are not supported.");
  }
  if (entryCount === 0 || entryCount > XLSX_MAX_ARCHIVE_ENTRIES) {
    throw new Error(`The workbook archive must contain between 1 and ${XLSX_MAX_ARCHIVE_ENTRIES} files.`);
  }
  if (centralDirectoryOffset + centralDirectorySize > eocdOffset) {
    throw new Error("Choose a valid Excel workbook (.xlsx directory is invalid).");
  }

  let offset = centralDirectoryOffset;
  let expandedBytes = 0;
  const localHeaderOffsets = new Set<number>();
  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (offset + 46 > eocdOffset || view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("Choose a valid Excel workbook (.xlsx entry directory is invalid).");
    }
    const flags = view.getUint16(offset + 8, true);
    const compressionMethod = view.getUint16(offset + 10, true);
    const crc32 = view.getUint32(offset + 16, true);
    const compressedBytes = view.getUint32(offset + 20, true);
    const uncompressedBytes = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    if (compressedBytes === 0xffffffff || uncompressedBytes === 0xffffffff || localHeaderOffset === 0xffffffff) {
      throw new Error("The workbook archive is too large. ZIP64 entries are not supported.");
    }
    if ((flags & 0x1) !== 0) throw new Error("Encrypted workbook archives are not supported.");
    if (compressionMethod !== 0 && compressionMethod !== 8) {
      throw new Error("The workbook archive uses an unsupported compression method.");
    }
    if (uncompressedBytes > XLSX_MAX_ENTRY_BYTES) {
      throw new Error("The workbook archive contains an entry that expands beyond 10 MB.");
    }
    if (uncompressedBytes > 0 && (compressedBytes === 0 || uncompressedBytes / compressedBytes > XLSX_MAX_COMPRESSION_RATIO)) {
      throw new Error("The workbook archive has an unsafe compression ratio.");
    }
    expandedBytes += uncompressedBytes;
    if (expandedBytes > XLSX_MAX_EXPANDED_BYTES) {
      throw new Error("The workbook archive expands beyond the 25 MB safety limit.");
    }

    if (localHeaderOffsets.has(localHeaderOffset) || localHeaderOffset + 30 > centralDirectoryOffset) {
      throw new Error("Choose a valid Excel workbook (.xlsx local entry offset is invalid).");
    }
    localHeaderOffsets.add(localHeaderOffset);
    if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
      throw new Error("Choose a valid Excel workbook (.xlsx local entry header is invalid).");
    }
    const localFlags = view.getUint16(localHeaderOffset + 6, true);
    const localCompressionMethod = view.getUint16(localHeaderOffset + 8, true);
    const localCrc32 = view.getUint32(localHeaderOffset + 14, true);
    const localCompressedBytes = view.getUint32(localHeaderOffset + 18, true);
    const localUncompressedBytes = view.getUint32(localHeaderOffset + 22, true);
    const localFileNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const usesDataDescriptor = (flags & 0x8) !== 0;
    if (localFlags !== flags || localCompressionMethod !== compressionMethod) {
      throw new Error("Choose a valid Excel workbook (.xlsx entry headers disagree).");
    }
    if (
      (usesDataDescriptor && ![0, compressedBytes].includes(localCompressedBytes))
      || (usesDataDescriptor && ![0, uncompressedBytes].includes(localUncompressedBytes))
      || (usesDataDescriptor && ![0, crc32].includes(localCrc32))
      || (!usesDataDescriptor && (localCompressedBytes !== compressedBytes || localUncompressedBytes !== uncompressedBytes || localCrc32 !== crc32))
    ) {
      throw new Error("Choose a valid Excel workbook (.xlsx entry sizes or checksum disagree).");
    }
    if (localFileNameLength !== fileNameLength) {
      throw new Error("Choose a valid Excel workbook (.xlsx entry names disagree).");
    }
    const centralFileNameOffset = offset + 46;
    const localFileNameOffset = localHeaderOffset + 30;
    if (localFileNameOffset + localFileNameLength + localExtraLength > centralDirectoryOffset) {
      throw new Error("Choose a valid Excel workbook (.xlsx local entry length is invalid).");
    }
    for (let nameIndex = 0; nameIndex < fileNameLength; nameIndex += 1) {
      if (buffer[centralFileNameOffset + nameIndex] !== buffer[localFileNameOffset + nameIndex]) {
        throw new Error("Choose a valid Excel workbook (.xlsx entry names disagree).");
      }
    }
    const entryDataOffset = localFileNameOffset + localFileNameLength + localExtraLength;
    const entryDataEnd = entryDataOffset + compressedBytes;
    if (entryDataEnd > centralDirectoryOffset) {
      throw new Error("Choose a valid Excel workbook (.xlsx compressed entry is truncated).");
    }
    if (compressionMethod === 0) {
      if (compressedBytes !== uncompressedBytes) {
        throw new Error("Choose a valid Excel workbook (.xlsx stored entry size is invalid).");
      }
    } else {
      try {
        const inflated = inflateRawSync(buffer.subarray(entryDataOffset, entryDataEnd), {
          maxOutputLength: Math.max(1, uncompressedBytes),
        });
        if (inflated.byteLength !== uncompressedBytes) {
          throw new Error("expanded-size-mismatch");
        }
      } catch {
        throw new Error("The workbook archive contains an entry that exceeds or disagrees with its declared expanded size.");
      }
    }
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  if (offset !== centralDirectoryOffset + centralDirectorySize) {
    throw new Error("Choose a valid Excel workbook (.xlsx directory length is invalid).");
  }
}

function getDeclaredSheetSize(sheet: XLSX.WorkSheet) {
  if (!sheet["!ref"]) return { cells: 0, columns: 0, rows: 0 };
  let range: XLSX.Range;
  try {
    range = XLSX.utils.decode_range(sheet["!ref"]);
  } catch {
    throw new Error("Choose a valid Excel workbook (a worksheet range is invalid).");
  }
  const rows = range.e.r - range.s.r + 1;
  const columns = range.e.c - range.s.c + 1;
  return { cells: rows * columns, columns, rows };
}

export function normalizeWorkerName(value: string) {
  return value.normalize("NFKC").replace(/\u00a0/g, " ").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-IN");
}

export function resolveAttendanceStatus(value: CellValue): AttendanceStatus | null {
  const normalized = cleanCell(value).toLocaleUpperCase("en-IN").replace(/[\s_.-]+/g, "");
  return STATUS_MAP[normalized] ?? null;
}

export function matchAttendanceWorkers(sourceWorkers: ParsedAttendanceWorker[], tenantWorkers: TenantWorkerReference[]): AttendanceWorkerMatch[] {
  const workersByName = new Map<string, TenantWorkerReference[]>();
  const sourceNameCounts = new Map<string, number>();
  for (const sourceWorker of sourceWorkers) {
    const normalized = normalizeWorkerName(sourceWorker.sourceName);
    sourceNameCounts.set(normalized, (sourceNameCounts.get(normalized) ?? 0) + 1);
  }
  for (const worker of tenantWorkers) {
    const normalized = normalizeWorkerName(worker.name);
    if (!normalized) continue;
    workersByName.set(normalized, [...(workersByName.get(normalized) ?? []), worker]);
  }

  return sourceWorkers.map((sourceWorker) => {
    const normalizedSourceName = normalizeWorkerName(sourceWorker.sourceName);
    const candidates = workersByName.get(normalizedSourceName) ?? [];
    if ((sourceNameCounts.get(normalizedSourceName) ?? 0) > 1) {
      return { ...sourceWorker, matchState: "ambiguous", workerId: null, workerName: null };
    }
    if (candidates.length === 1) {
      return { ...sourceWorker, matchState: "matched", workerId: candidates[0].id, workerName: candidates[0].name };
    }
    return {
      ...sourceWorker,
      matchState: candidates.length > 1 ? "ambiguous" : "unmatched",
      workerId: null,
      workerName: null
    };
  });
}

export function parseAttendanceWorkbook(buffer: Uint8Array, fileName: string, todayIso: string): ParsedAttendanceWorkbook {
  const detectedExtension = assertWorkbookSignature(buffer, fileName);
  if (detectedExtension === "xlsx") preflightXlsxArchive(buffer);
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { cellDates: false, dense: false, type: "array" });
  } catch {
    throw new Error("Choose a valid Excel workbook (.xls or .xlsx).");
  }

  const sourceWorkers: ParsedAttendanceWorker[] = [];
  const warnings: string[] = [];
  let detectedReportMonth: string | null = null;
  let declaredWorkbookCells = 0;

  if (workbook.SheetNames.length > WORKBOOK_MAX_SHEETS) {
    throw new Error(`The workbook contains more than ${WORKBOOK_MAX_SHEETS} worksheets.`);
  }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const declaredSize = getDeclaredSheetSize(sheet);
    if (declaredSize.rows > SHEET_MAX_ROWS || declaredSize.columns > SHEET_MAX_COLUMNS) {
      throw new Error(`The workbook is too large. Each worksheet is limited to ${SHEET_MAX_ROWS} rows and ${SHEET_MAX_COLUMNS} columns.`);
    }
    declaredWorkbookCells += declaredSize.cells;
    if (declaredWorkbookCells > WORKBOOK_MAX_DECLARED_CELLS) {
      throw new Error("The workbook declares more than 500,000 cells.");
    }
    const rows = XLSX.utils.sheet_to_json<CellValue[]>(sheet, { defval: "", header: 1, raw: false });
    if (rows.length > SHEET_MAX_ROWS) throw new Error(`The workbook is too large. Upload a report with at most ${SHEET_MAX_ROWS} rows per worksheet.`);

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const departmentRow = rows[rowIndex] ?? [];
      if (findLabel(departmentRow, "Dept Name") < 0) continue;
      if (sourceWorkers.length >= 500) throw new Error("The workbook contains more than 500 worker sections.");

      const metadataRow = rows[rowIndex + 1] ?? [];
      const nameIndex = findLabel(metadataRow, "Name");
      const codeIndex = findLabel(metadataRow, "Empcode");
      const reportMonthIndex = findLabel(departmentRow, "Report Month");
      const sourceName = nameIndex >= 0 ? nextValue(metadataRow, nameIndex) : "";
      const reportMonthText = reportMonthIndex >= 0 ? nextValue(departmentRow, reportMonthIndex) : "";
      const reportMonth = parseReportMonth(reportMonthText);

      if (!sourceName || !reportMonth) {
        warnings.push(`Skipped an unreadable worker section near row ${rowIndex + 1} on ${sheetName}.`);
        continue;
      }
      if (detectedReportMonth && detectedReportMonth !== reportMonth) {
        throw new Error("The workbook contains more than one report month. Upload one month at a time.");
      }
      detectedReportMonth = reportMonth;

      const dateRow = rows[rowIndex + 2] ?? [];
      const inRow = rows[rowIndex + 4] ?? [];
      const outRow = rows[rowIndex + 5] ?? [];
      const workRow = rows[rowIndex + 6] ?? [];
      const statusRow = rows[rowIndex + 9] ?? [];
      const days: ParsedAttendanceDay[] = [];
      let blankStatusCount = 0;
      let futureDateCount = 0;
      let unknownStatusCount = 0;

      for (let columnIndex = 0; columnIndex < dateRow.length; columnIndex += 1) {
        const day = Number(cleanCell(dateRow[columnIndex]));
        if (!Number.isInteger(day) || day < 1 || day > 31) continue;
        const attendanceDate = validIsoDate(reportMonth, day);
        if (!attendanceDate) continue;
        if (attendanceDate > todayIso) {
          futureDateCount += 1;
          continue;
        }
        const sourceStatus = cleanCell(statusRow[columnIndex]);
        if (!sourceStatus) {
          blankStatusCount += 1;
          continue;
        }
        const status = resolveAttendanceStatus(sourceStatus);
        if (!status) {
          unknownStatusCount += 1;
          continue;
        }
        days.push({
          attendanceDate,
          checkInTime: parseClockTime(inRow[columnIndex]),
          checkOutTime: parseClockTime(outRow[columnIndex]),
          sourceStatus,
          status,
          totalHours: parseDurationHours(workRow[columnIndex])
        });
      }

      sourceWorkers.push({
        blankStatusCount,
        days,
        futureDateCount,
        sourceCode: codeIndex >= 0 ? nextValue(metadataRow, codeIndex) || null : null,
        sourceName,
        unknownStatusCount
      });
    }
  }

  if (!detectedReportMonth || !sourceWorkers.length) {
    throw new Error("The workbook does not contain recognizable attendance worker sections.");
  }

  return { reportMonth: detectedReportMonth, sourceWorkers, warnings };
}
