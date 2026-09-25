import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { getSessionUser } from "@/lib/session";
import { can } from "@/server/admin";
import { openReports } from "@/server/reports";
import { REPORT_REASONS } from "@/lib/report-reasons";
import { readUrl } from "@/server/evidence";
import { ReviewForm } from "./review-form";

// The one place an admin sees a photograph, and only because a member asked
// them to. Everything else in the console counts behaviour and never reads it.
export default async function AdminReports() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if (!(await can(user.id, "users.disable"))) redirect("/admin");

  const reports = await openReports();

  return (
    <>
      <section className="flex flex-col gap-2.5">
        <h2 className="text-sm font-semibold tracking-wider">OPEN REPORTS</h2>

        {reports.length === 0 ? (
          <p className="text-sm text-muted">Nothing reported.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {reports.map((report) => (
              <div key={report.id} className="flex flex-col gap-3 border border-rule p-[13px]">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm">
                    {REPORT_REASONS[report.reason as keyof typeof REPORT_REASONS] ??
                      report.reason}
                  </span>
                  <span className="text-2xs text-muted">
                    {DateTime.fromJSDate(report.createdAt).toFormat("d LLL, h:mm a")}
                  </span>
                </div>

                <span className="text-2xs leading-relaxed text-muted">
                  {report.reporterName} reported {report.subjectName}
                  {report.groupName ? ` in ${report.groupName}` : ""}.
                  {report.note ? ` "${report.note}"` : ""}
                </span>

                {report.objectKey ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={readUrl(report.objectKey)}
                    alt="The reported photo"
                    className="max-h-[280px] w-full border border-rule object-contain"
                  />
                ) : (
                  <span className="text-2xs text-muted">
                    The photo is already gone.
                  </span>
                )}

                <ReviewForm
                  reportId={report.id}
                  subjectId={report.subjectId}
                  subjectName={report.subjectName}
                  hasPhoto={report.objectKey !== null}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
