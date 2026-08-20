import { useEffect, useState } from "react";
import { ComposeEmailModal } from "../components/email/ComposeEmailModal";
import { EmailPreviewTable } from "../components/email/EmailPreviewTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ErrorState } from "../components/ui/ErrorState";
import { Spinner } from "../components/ui/Spinner";
import { Toast } from "../components/ui/Toast";
import { useAuth } from "../hooks/useAuth";
import { getApiErrorMessage } from "../services/api/errors";
import { emailService } from "../services/email.service";
import type {
  EmailRecord,
  PaginationMeta,
  ScheduleEmailsResponse
} from "../types";

export const DashboardPage = () => {
  const { user } = useAuth();
  const [scheduledEmails, setScheduledEmails] = useState<EmailRecord[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailRecord[]>([]);
  const [scheduledMeta, setScheduledMeta] = useState<PaginationMeta | null>(null);
  const [sentMeta, setSentMeta] = useState<PaginationMeta | null>(null);
  const [activeTab, setActiveTab] = useState<"scheduled" | "sent">("scheduled");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);

    try {
      const [scheduledResponse, sentResponse] = await Promise.all([
        emailService.listScheduledEmails({ page: 1, pageSize: 10 }),
        emailService.listSentEmails({ page: 1, pageSize: 10 })
      ]);

      setScheduledEmails(scheduledResponse.data);
      setSentEmails(sentResponse.data);
      setScheduledMeta(scheduledResponse.pagination);
      setSentMeta(sentResponse.pagination);
    } catch (loadError) {
      const message = getApiErrorMessage(loadError, "Unable to load emails right now.");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [successMessage]);

  const handleScheduled = async (result: ScheduleEmailsResponse) => {
    setActiveTab("scheduled");
    await loadDashboard();
    setSuccessMessage(`Scheduled ${result.createdCount} email${result.createdCount === 1 ? "" : "s"} successfully.`);
  };

  const activeEmails = activeTab === "scheduled" ? scheduledEmails : sentEmails;
  const activeCount = activeTab === "scheduled" ? scheduledMeta?.total ?? 0 : sentMeta?.total ?? 0;
  const activeTitle = activeTab === "scheduled" ? "Scheduled Emails" : "Sent Emails";
  const activeDescription =
    activeTab === "scheduled"
      ? "Emails queued for future delivery."
      : "Emails that have already completed delivery.";
  const scheduledCount = scheduledMeta?.total ?? scheduledEmails.length;
  const sentCount = sentMeta?.total ?? sentEmails.length;

  return (
    <>
      <Toast
        description="The scheduled email list has been refreshed."
        open={Boolean(successMessage)}
        title={successMessage ?? ""}
        tone="success"
      />

      <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Workspace</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{user?.name ?? "User"}</p>
              <p className="mt-1 text-xs text-slate-500">{user?.email}</p>
            </div>

            <Button
              className="mt-4 w-full rounded-xl bg-emerald-500 py-3 text-sm font-medium text-white hover:bg-emerald-600"
              onClick={() => setIsComposeOpen(true)}
            >
              Compose New Email
            </Button>

            <div className="mt-6 space-y-2">
              <button
                className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition ${
                  activeTab === "scheduled"
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => setActiveTab("scheduled")}
                type="button"
              >
                <span className="font-medium">Scheduled Emails</span>
                <span className="text-xs">{scheduledCount}</span>
              </button>
              <button
                className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition ${
                  activeTab === "sent"
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => setActiveTab("sent")}
                type="button"
              >
                <span className="font-medium">Sent Emails</span>
                <span className="text-xs">{sentCount}</span>
              </button>
            </div>
          </aside>

          <div className="min-w-0 p-4 md:p-6">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-slate-900">{activeTitle}</h2>
                  <Badge className="px-2 py-1 text-[10px] font-medium normal-case tracking-normal" tone="neutral">
                    {activeCount} total
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">{activeDescription}</p>
              </div>

              <div className="w-full md:w-auto">
                <div className="flex w-full items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 md:w-[260px]">
                  Search
                </div>
              </div>
            </div>

            <div className="mt-5">
              {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10">
                  <Spinner label={`Loading ${activeTab} emails...`} />
                </div>
              ) : error ? (
                <ErrorState
                  action={
                    <Button onClick={() => void loadDashboard()} size="sm">
                      Retry
                    </Button>
                  }
                  message={error}
                />
              ) : (
                <EmailPreviewTable
                  emails={activeEmails}
                  emptyDescription={
                    activeTab === "scheduled"
                      ? "Scheduled emails will appear here once you queue deliveries from the compose flow."
                      : "Sent emails will appear here after jobs complete successfully."
                  }
                  emptyTitle={
                    activeTab === "scheduled" ? "No scheduled emails yet" : "No sent emails yet"
                  }
                  variant={activeTab}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      <ComposeEmailModal
        onClose={() => setIsComposeOpen(false)}
        onScheduled={handleScheduled}
        open={isComposeOpen}
      />
    </>
  );
};
