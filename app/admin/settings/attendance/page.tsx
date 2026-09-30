import { redirect } from "next/navigation";

// Attendance & leave settings are part of Settings → HR (docs/bos/28 §5).
export default async function AttendanceSettingsRedirect() {
  redirect("/admin/settings/hr?s=attendance");
}
