import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [actions, dialog, migration, page, types, nextConfig] = await Promise.all([
  readFile(new URL("../src/features/attendance/import-actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/attendance/attendance-import-dialog.tsx", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260808110000_attendance_excel_import.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/app/(tenant)/attendance/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/types/database.ts", import.meta.url), "utf8"),
  readFile(new URL("../next.config.ts", import.meta.url), "utf8")
]);

assert.match(actions, /assertPermission\(context\.membership\.role, "attendance:manage"\)/);
assert.match(actions, /\.eq\("tenant_id", tenantId\)/);
assert.match(actions, /p_tenant_id: context\.tenant\.id/);
assert.match(actions, /matchAttendanceWorkers/);
assert.match(actions, /expectedFingerprint/);
assert.match(actions, /import_attendance_rows/);
assert.match(dialog, /Only exact worker-name matches are imported/i);
assert.match(dialog, /Unmatched and ambiguous names are skipped/i);
assert.match(dialog, /Blank status cells/i);
assert.match(dialog, /name="file"/);
assert.match(dialog, /formData\.set\("file", selectedFile\)/, "the previewed File must survive React form reset for confirmation");
assert.match(dialog, /data-preserve-dirty-on-submit="true"/);
assert.match(dialog, /delete formRef\.current\.dataset\.unsavedDirty/);
assert.match(dialog, /name="intent"[\s\S]{0,80}value="confirm"/);
assert.match(migration, /create table attendance_imports/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /attendance_imports_immutable/i);
assert.match(migration, /IMMUTABLE_AUDIT_RECORD/i);
assert.match(migration, /create or replace function import_attendance_rows/i);
assert.match(migration, /pg_advisory_xact_lock/i);
assert.match(migration, /attendance_date > timezone\('Asia\/Kolkata', now\(\)\)::date/i);
assert.match(migration, /status = 'active'/i);
assert.match(migration, /grant execute on function import_attendance_rows[\s\S]*to service_role/i);
assert.match(page, /AttendanceImportDialog/);
assert.match(types, /attendance_imports:/);
assert.match(types, /attendance_imports:[\s\S]*Update: never;/);
assert.match(types, /import_attendance_rows:/);
assert.match(nextConfig, /bodySizeLimit:\s*"6mb"/);

console.log("Attendance import tenant, atomicity, idempotency, and UI contracts passed.");
