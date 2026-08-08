"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  matchAttendanceWorkers,
  parseAttendanceWorkbook,
  type AttendanceWorkerMatch,
  type ParsedAttendanceDay
} from "@/features/attendance/import-parser";
import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";
import type { AttendanceStatus, Json } from "@/types/database";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const confirmSchema = z.object({
  expectedFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  idempotencyKey: z.string().uuid()
});

export type AttendanceImportPreviewWorker = {
  ambiguous: boolean;
  blankStatusCount: number;
  futureDateCount: number;
  insertCount: number;
  matchState: AttendanceWorkerMatch["matchState"];
  sourceCode: string | null;
  sourceName: string;
  unknownStatusCount: number;
  updateCount: number;
  workerName: string | null;
};

export type AttendanceImportPreview = {
  ambiguousWorkerCount: number;
  blankStatusCount: number;
  fingerprint: string;
  futureDateCount: number;
  idempotencyKey: string;
  insertCount: number;
  matchedWorkerCount: number;
  reportMonth: string;
  skippedCount: number;
  sourceWorkerCount: number;
  unknownStatusCount: number;
  unmatchedWorkerCount: number;
  updateCount: number;
  workers: AttendanceImportPreviewWorker[];
};

export type AttendanceImportState =
  | { message: string; status: "error" }
  | { message: string; preview: AttendanceImportPreview; status: "preview" }
  | {
      message: string;
      result: AttendanceImportPreview & { idempotentReplay: boolean };
      status: "success";
    };

type ImportRow = {
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  source_status: string;
  status: AttendanceStatus;
  total_hours: number | null;
  worker_id: string;
};

function todayIsoDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Kolkata",
    year: "numeric"
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function cleanFileName(name: string) {
  return name.replace(/[\\/]/g, "_").trim().slice(0, 180) || "attendance.xlsx";
}

async function readWorkbookFile(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || !value.name || value.size === 0) {
    throw new Error("Choose an attendance .xls or .xlsx file first.");
  }
  if (value.size > MAX_FILE_BYTES) {
    throw new Error("The attendance workbook must be 5 MB or smaller.");
  }
  const bytes = Buffer.from(await value.arrayBuffer());
  return {
    bytes,
    fileName: cleanFileName(value.name),
    fingerprint: createHash("sha256").update(bytes).digest("hex")
  };
}

function toImportRow(workerId: string, day: ParsedAttendanceDay): ImportRow {
  return {
    attendance_date: day.attendanceDate,
    check_in_time: day.checkInTime,
    check_out_time: day.checkOutTime,
    source_status: day.sourceStatus,
    status: day.status,
    total_hours: day.totalHours,
    worker_id: workerId
  };
}

async function buildPreview(tenantId: string, bytes: Buffer, fileName: string, fingerprint: string, idempotencyKey: string) {
  const parsed = parseAttendanceWorkbook(bytes, fileName, todayIsoDate());
  const supabase = createSupabaseServiceRoleClient();
  const workersResult = await supabase
    .from("workers")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .is("deleted_at", null);
  if (workersResult.error) throw new Error(`Unable to validate worker profiles: ${workersResult.error.message}`);

  const matches = matchAttendanceWorkers(parsed.sourceWorkers, workersResult.data ?? []);
  const rows = matches.flatMap((match) =>
    match.matchState === "matched" && match.workerId
      ? match.days.map((day) => toImportRow(match.workerId as string, day))
      : []
  );
  const matchedWorkerIds = Array.from(new Set(rows.map((row) => row.worker_id)));
  const existingKeys = new Set<string>();

  if (matchedWorkerIds.length && rows.length) {
    const dates = rows.map((row) => row.attendance_date).sort();
    const existingResult = await supabase
      .from("attendance")
      .select("worker_id, attendance_date")
      .eq("tenant_id", tenantId)
      .in("worker_id", matchedWorkerIds)
      .gte("attendance_date", dates[0])
      .lte("attendance_date", dates[dates.length - 1])
      .is("deleted_at", null);
    if (existingResult.error) throw new Error(`Unable to compare existing attendance: ${existingResult.error.message}`);
    for (const existing of existingResult.data ?? []) existingKeys.add(`${existing.worker_id}:${existing.attendance_date}`);
  }

  let insertCount = 0;
  let updateCount = 0;
  for (const row of rows) {
    if (existingKeys.has(`${row.worker_id}:${row.attendance_date}`)) updateCount += 1;
    else insertCount += 1;
  }

  const workers: AttendanceImportPreviewWorker[] = matches.map((match) => {
    const workerRows = match.matchState === "matched" && match.workerId ? match.days.map((day) => toImportRow(match.workerId as string, day)) : [];
    const workerUpdateCount = workerRows.filter((row) => existingKeys.has(`${row.worker_id}:${row.attendance_date}`)).length;
    return {
      ambiguous: match.matchState === "ambiguous",
      blankStatusCount: match.blankStatusCount,
      futureDateCount: match.futureDateCount,
      insertCount: workerRows.length - workerUpdateCount,
      matchState: match.matchState,
      sourceCode: match.sourceCode,
      sourceName: match.sourceName,
      unknownStatusCount: match.unknownStatusCount,
      updateCount: workerUpdateCount,
      workerName: match.workerName
    };
  });
  const futureDateCount = matches.reduce((sum, match) => sum + match.futureDateCount, 0);
  const blankStatusCount = matches.reduce((sum, match) => sum + match.blankStatusCount, 0);
  const unknownStatusCount = matches.reduce((sum, match) => sum + match.unknownStatusCount, 0);
  const unmatchedDayCount = matches.reduce(
    (sum, match) => sum + (match.matchState === "matched" ? 0 : match.days.length),
    0
  );

  const preview: AttendanceImportPreview = {
    ambiguousWorkerCount: matches.filter((match) => match.matchState === "ambiguous").length,
    blankStatusCount,
    fingerprint,
    futureDateCount,
    idempotencyKey,
    insertCount,
    matchedWorkerCount: matches.filter((match) => match.matchState === "matched").length,
    reportMonth: parsed.reportMonth,
    skippedCount: blankStatusCount + futureDateCount + unknownStatusCount + unmatchedDayCount,
    sourceWorkerCount: matches.length,
    unknownStatusCount,
    unmatchedWorkerCount: matches.filter((match) => match.matchState === "unmatched").length,
    updateCount,
    workers
  };
  return { preview, rows };
}

function safeErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) return "The import confirmation is invalid. Preview the workbook again.";
  if (error instanceof Error) {
    if (error.message.includes("IDEMPOTENCY_KEY_FILE_MISMATCH")) return "This confirmation belongs to a different file. Preview the workbook again.";
    if (error.message.includes("WORKER_NOT_ACTIVE_IN_TENANT")) return "A matched worker changed after preview. Preview the workbook again.";
    return error.message;
  }
  return "Attendance could not be imported. The workbook was not changed.";
}

export async function attendanceImportAction(formData: FormData): Promise<AttendanceImportState> {
  try {
    const context = await requireTenantContext();
    assertPermission(context.membership.role, "attendance:manage");
    const intent = String(formData.get("intent") ?? "preview");
    if (intent !== "preview" && intent !== "confirm") throw new Error("Unknown attendance import action.");
    const file = await readWorkbookFile(formData.get("file"));
    const confirmation = intent === "confirm"
      ? confirmSchema.parse({
          expectedFingerprint: formData.get("expectedFingerprint"),
          idempotencyKey: formData.get("idempotencyKey")
        })
      : { expectedFingerprint: file.fingerprint, idempotencyKey: randomUUID() };
    if (confirmation.expectedFingerprint !== file.fingerprint) {
      throw new Error("The selected workbook changed after preview. Preview it again before importing.");
    }

    const { preview, rows } = await buildPreview(
      context.tenant.id,
      file.bytes,
      file.fileName,
      file.fingerprint,
      confirmation.idempotencyKey
    );
    if (intent === "preview") {
      return {
        message: rows.length ? "Preview ready. Review exact matches and skipped rows before importing." : "No attendance rows can be imported from exact worker-name matches.",
        preview,
        status: "preview"
      };
    }
    if (!rows.length) throw new Error("There are no exact worker-name matches with attendance rows to import.");

    const supabase = createSupabaseServiceRoleClient();
    const summary: Json = {
      ambiguousWorkerCount: preview.ambiguousWorkerCount,
      futureDateCount: preview.futureDateCount,
      matchedWorkerCount: preview.matchedWorkerCount,
      skippedCount: preview.skippedCount,
      sourceWorkerCount: preview.sourceWorkerCount,
      unknownStatusCount: preview.unknownStatusCount,
      unmatchedWorkerCount: preview.unmatchedWorkerCount
    };
    const result = await supabase.rpc("import_attendance_rows", {
      p_actor_id: context.membership.clerk_user_id,
      p_file_hash: file.fingerprint,
      p_file_name: file.fileName,
      p_idempotency_key: confirmation.idempotencyKey,
      p_report_month: `${preview.reportMonth}-01`,
      p_rows: rows as unknown as Json,
      p_summary: summary,
      p_tenant_id: context.tenant.id
    });
    if (result.error) throw new Error(`Unable to import attendance: ${result.error.message}`);
    const resultObject = (result.data ?? {}) as Record<string, Json | undefined>;
    const finalResult = {
      ...preview,
      idempotentReplay: resultObject.idempotentReplay === true,
      insertedCount: Number(resultObject.insertedCount ?? preview.insertCount),
      updatedCount: Number(resultObject.updatedCount ?? preview.updateCount)
    };

    revalidatePath("/attendance");
    revalidatePath("/dashboard");
    revalidatePath("/salary");
    revalidatePath("/workers");
    return {
      message: finalResult.idempotentReplay
        ? "This workbook confirmation was already imported; no duplicate attendance was created."
        : `Attendance imported: ${finalResult.insertedCount} created and ${finalResult.updatedCount} updated.`,
      result: finalResult,
      status: "success"
    };
  } catch (error) {
    return { message: safeErrorMessage(error), status: "error" };
  }
}
