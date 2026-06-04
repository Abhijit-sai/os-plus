"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";
import type { AttendanceStatus } from "@/types/database";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null));

const attendanceStatusSchema = z.enum(["present", "absent", "half_day", "leave", "holiday"]);

const markAttendanceSchema = z.object({
  workerId: z.string().uuid(),
  attendanceDate: z.string().min(1),
  status: attendanceStatusSchema,
  checkInTime: optionalText,
  checkOutTime: optionalText,
  totalHours: z.coerce.number().min(0).nullable(),
  notes: optionalText
});

const markAttendanceSheetSchema = z.object({
  attendanceDate: z.string().min(1),
  workerIds: z.array(z.string().uuid()).min(1)
});

async function getAuthorizedAttendanceContext() {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "attendance:manage");
  return context;
}

function parseTotalHours(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  return raw ? Number(raw) : null;
}

function calculateHoursFromTimes(checkInTime: string | null, checkOutTime: string | null) {
  if (!checkInTime || !checkOutTime) {
    return null;
  }

  const [inHour, inMinute] = checkInTime.split(":").map(Number);
  const [outHour, outMinute] = checkOutTime.split(":").map(Number);
  const startMinutes = inHour * 60 + inMinute;
  let endMinutes = outHour * 60 + outMinute;

  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  return Math.round(((endMinutes - startMinutes) / 60) * 100) / 100;
}

function defaultHoursForStatus(status: AttendanceStatus) {
  if (status === "present") {
    return 8;
  }

  if (status === "half_day") {
    return 4;
  }

  return 0;
}

function resolveTotalHours(status: AttendanceStatus, checkInTime: string | null, checkOutTime: string | null, manualHours: number | null) {
  if (manualHours !== null) {
    return manualHours;
  }

  return calculateHoursFromTimes(checkInTime, checkOutTime) ?? defaultHoursForStatus(status);
}

async function validateWorkersForTenant(tenantId: string, workerIds: string[]) {
  const supabase = createSupabaseServiceRoleClient();
  const uniqueWorkerIds = Array.from(new Set(workerIds));

  if (!uniqueWorkerIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("workers")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("id", uniqueWorkerIds)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Unable to validate workers: ${error.message}`);
  }

  if ((data ?? []).length !== uniqueWorkerIds.length) {
    throw new Error("One or more workers do not belong to this tenant.");
  }

  return uniqueWorkerIds;
}

export async function markAttendanceAction(formData: FormData) {
  const context = await getAuthorizedAttendanceContext();
  const parsed = markAttendanceSchema.parse({
    workerId: formData.get("workerId"),
    attendanceDate: formData.get("attendanceDate"),
    status: formData.get("status") || "present",
    checkInTime: formData.get("checkInTime"),
    checkOutTime: formData.get("checkOutTime"),
    totalHours: parseTotalHours(formData.get("totalHours")),
    notes: formData.get("notes")
  });

  const supabase = createSupabaseServiceRoleClient();
  const worker = await supabase
    .from("workers")
    .select("id")
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.workerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (worker.error) {
    throw new Error(`Unable to validate worker: ${worker.error.message}`);
  }

  if (!worker.data) {
    throw new Error("Worker does not belong to this tenant.");
  }

  const existing = await supabase
    .from("attendance")
    .select("id")
    .eq("tenant_id", context.tenant.id)
    .eq("worker_id", parsed.workerId)
    .eq("attendance_date", parsed.attendanceDate)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`Unable to check existing attendance: ${existing.error.message}`);
  }

  if (existing.data) {
    const { error } = await supabase
      .from("attendance")
      .update({
        status: parsed.status as AttendanceStatus,
        check_in_time: parsed.checkInTime,
        check_out_time: parsed.checkOutTime,
        total_hours: parsed.totalHours,
        marked_by: context.membership.clerk_user_id,
        notes: parsed.notes
      })
      .eq("tenant_id", context.tenant.id)
      .eq("id", existing.data.id);

    if (error) {
      throw new Error(`Unable to update attendance: ${error.message}`);
    }
  } else {
    const { error } = await supabase.from("attendance").insert({
      tenant_id: context.tenant.id,
      worker_id: parsed.workerId,
      attendance_date: parsed.attendanceDate,
      status: parsed.status as AttendanceStatus,
      check_in_time: parsed.checkInTime,
      check_out_time: parsed.checkOutTime,
      total_hours: parsed.totalHours,
      marked_by: context.membership.clerk_user_id,
      notes: parsed.notes
    });

    if (error) {
      throw new Error(`Unable to mark attendance: ${error.message}`);
    }
  }

  revalidatePath("/attendance");
}

export async function markAttendanceSheetAction(formData: FormData) {
  const context = await getAuthorizedAttendanceContext();
  const parsed = markAttendanceSheetSchema.parse({
    attendanceDate: formData.get("attendanceDate"),
    workerIds: formData
      .getAll("workerIds")
      .map((value) => String(value))
      .filter(Boolean)
  });
  const workerIds = await validateWorkersForTenant(context.tenant.id, parsed.workerIds);
  const supabase = createSupabaseServiceRoleClient();

  const rows = workerIds
    .map((workerId) => {
      const statusValue = String(formData.get(`status_${workerId}`) ?? "unmarked");

      if (statusValue === "unmarked") {
        return null;
      }

      const status = attendanceStatusSchema.parse(statusValue) as AttendanceStatus;
      const checkInTime = optionalText.parse(formData.get(`checkInTime_${workerId}`));
      const checkOutTime = optionalText.parse(formData.get(`checkOutTime_${workerId}`));
      const notes = optionalText.parse(formData.get(`notes_${workerId}`));
      const totalHours = resolveTotalHours(status, checkInTime, checkOutTime, parseTotalHours(formData.get(`totalHours_${workerId}`)));

      return {
        tenant_id: context.tenant.id,
        worker_id: workerId,
        attendance_date: parsed.attendanceDate,
        status,
        check_in_time: checkInTime,
        check_out_time: checkOutTime,
        total_hours: totalHours,
        marked_by: context.membership.clerk_user_id,
        notes
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (rows.length) {
    const { data: existingRows, error: existingRowsError } = await supabase
      .from("attendance")
      .select("id, worker_id")
      .eq("tenant_id", context.tenant.id)
      .eq("attendance_date", parsed.attendanceDate)
      .in(
        "worker_id",
        rows.map((row) => row.worker_id)
      )
      .is("deleted_at", null);

    if (existingRowsError) {
      throw new Error(`Unable to check existing attendance sheet: ${existingRowsError.message}`);
    }

    const existingByWorkerId = new Map((existingRows ?? []).map((row) => [row.worker_id, row.id]));
    const rowsToInsert = rows.filter((row) => !existingByWorkerId.has(row.worker_id));
    const rowsToUpdate = rows.filter((row) => existingByWorkerId.has(row.worker_id));

    if (rowsToInsert.length) {
      const { error } = await supabase.from("attendance").insert(rowsToInsert);

      if (error) {
        throw new Error(`Unable to insert attendance sheet rows: ${error.message}`);
      }
    }

    for (const row of rowsToUpdate) {
      const existingId = existingByWorkerId.get(row.worker_id);

      if (!existingId) {
        continue;
      }

      const { error } = await supabase
        .from("attendance")
        .update({
          status: row.status,
          check_in_time: row.check_in_time,
          check_out_time: row.check_out_time,
          total_hours: row.total_hours,
          marked_by: row.marked_by,
          notes: row.notes
        })
        .eq("tenant_id", context.tenant.id)
        .eq("id", existingId);

      if (error) {
        throw new Error(`Unable to update attendance sheet row: ${error.message}`);
      }
    }
  }

  revalidatePath("/attendance");
}
