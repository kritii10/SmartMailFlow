import { useEffect, useMemo, useState } from "react";
import type { ScheduleEmailsResponse } from "../../types";
import { emailService } from "../../services/email.service";
import { getApiErrorMessage } from "../../services/api/errors";
import { parseRecipientInput } from "../../utils/recipientParser";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { Textarea } from "../ui/Textarea";

type ComposeEmailModalProps = {
  open: boolean;
  onClose: () => void;
  onScheduled: (result: ScheduleEmailsResponse) => Promise<void> | void;
};

type ComposeFormState = {
  senderEmail: string;
  senderName: string;
  subject: string;
  body: string;
  recipientSource: string;
  startTime: string;
  delayMs: string;
  hourlyLimit: string;
};

type ComposeFormErrors = Partial<Record<keyof ComposeFormState, string>>;

const delayOptions = [
  { value: "1000", label: "1 second", summaryLabel: "1 sec between emails" },
  { value: "2000", label: "2 seconds", summaryLabel: "2 sec between emails" },
  { value: "5000", label: "5 seconds", summaryLabel: "5 sec between emails" },
  { value: "10000", label: "10 seconds", summaryLabel: "10 sec between emails" },
  { value: "30000", label: "30 seconds", summaryLabel: "30 sec between emails" },
  { value: "60000", label: "1 minute", summaryLabel: "1 min between emails" }
] as const;

const hourlyLimitOptions = [
  { value: "50", label: "50 emails / hour" },
  { value: "100", label: "100 emails / hour" },
  { value: "250", label: "250 emails / hour" },
  { value: "500", label: "500 emails / hour" }
] as const;

const initialFormState = (): ComposeFormState => ({
  senderEmail: "",
  senderName: "",
  subject: "",
  body: "",
  recipientSource: "",
  startTime: "",
  delayMs: "2000",
  hourlyLimit: "100"
});

const toFutureLocalDateTime = () => {
  const date = new Date(Date.now() + 5 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatStartTimeSummary = (value: string) => {
  if (!value) {
    return "Select a start time";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Select a valid start time";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
};

const getDelaySummaryLabel = (delayMs: string) =>
  delayOptions.find((option) => option.value === delayMs)?.summaryLabel ?? "Custom delay";

const validateComposeForm = (
  state: ComposeFormState,
  detectedRecipients: string[],
  invalidEntries: string[]
): ComposeFormErrors => {
  const errors: ComposeFormErrors = {};

  if (!state.subject.trim()) {
    errors.subject = "Subject is required.";
  }

  if (state.senderEmail.trim()) {
    const isValidSenderEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.senderEmail.trim());

    if (!isValidSenderEmail) {
      errors.senderEmail = "Sender email must be a valid email address.";
    }
  }

  if (!state.body.trim()) {
    errors.body = "Body is required.";
  }

  if (!state.recipientSource.trim()) {
    errors.recipientSource = "Upload a CSV or paste text containing recipient email addresses.";
  } else if (invalidEntries.length > 0) {
    errors.recipientSource = `Found ${invalidEntries.length} invalid email entr${
      invalidEntries.length === 1 ? "y" : "ies"
    }.`;
  } else if (detectedRecipients.length === 0) {
    errors.recipientSource = "No valid email addresses were detected.";
  }

  if (!state.startTime) {
    errors.startTime = "Start time is required.";
  } else {
    const startTime = new Date(state.startTime);

    if (Number.isNaN(startTime.getTime()) || startTime.getTime() <= Date.now()) {
      errors.startTime = "Start time must be in the future.";
    }
  }

  if (!state.delayMs.trim()) {
    errors.delayMs = "Delay between emails is required.";
  } else {
    const delayMs = Number(state.delayMs);

    if (!Number.isInteger(delayMs) || delayMs < 0) {
      errors.delayMs = "Delay must be a whole number of milliseconds.";
    }
  }

  if (state.hourlyLimit.trim()) {
    const hourlyLimit = Number(state.hourlyLimit);

    if (!Number.isInteger(hourlyLimit) || hourlyLimit <= 0) {
      errors.hourlyLimit = "Hourly limit must be a positive whole number.";
    }
  }

  return errors;
};

export const ComposeEmailModal = ({
  onClose,
  onScheduled,
  open
}: ComposeEmailModalProps) => {
  const [form, setForm] = useState<ComposeFormState>(initialFormState);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [showSenderOverride, setShowSenderOverride] = useState(false);

  const parsedRecipients = useMemo(
    () => parseRecipientInput(form.recipientSource),
    [form.recipientSource]
  );

  const formErrors = useMemo(
    () =>
      validateComposeForm(form, parsedRecipients.recipients, parsedRecipients.invalidEntries),
    [form, parsedRecipients.invalidEntries, parsedRecipients.recipients]
  );

  const selectedSenderName = form.senderName.trim() || "ReachInbox Scheduler";
  const selectedSenderDetail = form.senderEmail.trim() || "Uses workspace sender configuration";
  const hasSenderSelection = !showSenderOverride || Boolean(form.senderEmail.trim());
  const canSubmit =
    !submitting && hasSenderSelection && Object.keys(formErrors).length === 0;
  const previewRecipients = parsedRecipients.recipients.slice(0, 8);

  const resetForm = () => {
    setForm({
      ...initialFormState(),
      startTime: toFutureLocalDateTime()
    });
    setSubmitAttempted(false);
    setSubmitting(false);
    setSubmitError(null);
    setUploadedFileName(null);
    setIsDraggingFile(false);
    setShowSenderOverride(false);
  };

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  const updateField = <K extends keyof ComposeFormState>(key: K, value: ComposeFormState[K]) => {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  };

  const handleFileUpload = async (file: File | null) => {
    if (!file) {
      return;
    }

    const content = await file.text();

    setUploadedFileName(file.name);
    updateField("recipientSource", content);
    setSubmitError(null);
  };

  const handleDrop = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDraggingFile(false);

    const file = event.dataTransfer.files?.[0] ?? null;
    await handleFileUpload(file);
  };

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    setSubmitError(null);

    if (!canSubmit) {
      return;
    }

    setSubmitting(true);

    try {
      const result = await emailService.scheduleEmails({
        senderEmail:
          showSenderOverride && form.senderEmail.trim() ? form.senderEmail.trim() : undefined,
        senderName:
          showSenderOverride && form.senderName.trim() ? form.senderName.trim() : undefined,
        subject: form.subject.trim(),
        body: form.body.trim(),
        startTime: new Date(form.startTime).toISOString(),
        delayMs: Number(form.delayMs),
        hourlyLimit: form.hourlyLimit.trim() ? Number(form.hourlyLimit) : undefined,
        recipients: parsedRecipients.recipients
      });

      await onScheduled(result);
      resetForm();
      onClose();
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, "Unable to schedule emails right now."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      description="Create and schedule a personalized email batch."
      footer={
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="font-medium text-slate-900">
              {parsedRecipients.recipients.length} recipient
              {parsedRecipients.recipients.length === 1 ? "" : "s"}
            </span>
            <span className="text-slate-300">·</span>
            <span>
              Starts <span className="font-medium text-slate-900">{formatStartTimeSummary(form.startTime)}</span>
            </span>
            <span className="text-slate-300">·</span>
            <span>
              <span className="font-medium text-slate-900">{getDelaySummaryLabel(form.delayMs)}</span>
            </span>
            <span className="text-slate-300">·</span>
            <span>
              <span className="font-medium text-slate-900">{form.hourlyLimit || "100"}</span>/hour
            </span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500">
              Delivery settings will apply to the entire batch.
            </div>
            <div className="flex gap-3">
              <Button disabled={submitting} onClick={onClose} variant="ghost">
                Cancel
              </Button>
              <Button
                className="min-w-[190px] justify-center"
                disabled={!canSubmit}
                onClick={() => void handleSubmit()}
                size="lg"
              >
                {submitting ? "Scheduling..." : "Schedule campaign →"}
              </Button>
            </div>
          </div>
        </div>
      }
      maxWidthClassName="max-w-[900px]"
      onClose={onClose}
      open={open}
      title="New email campaign"
    >
      <div className="grid gap-6">
        <section className="grid gap-4 border-b border-slate-200 pb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">Message</h3>
              <p className="mt-1 text-sm text-slate-500">
                Write the content that each recipient in this batch will receive.
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <span className="text-[13px] font-medium text-slate-700">From</span>
            <button
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-white"
              onClick={() => setShowSenderOverride((current) => !current)}
              type="button"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 text-sm text-slate-400">✉</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{selectedSenderName}</p>
                  <p className="truncate text-xs text-slate-500">{selectedSenderDetail}</p>
                </div>
              </div>
              <span className="ml-4 text-sm text-slate-400">{showSenderOverride ? "▴" : "▾"}</span>
            </button>
          </div>

          {showSenderOverride ? (
            <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 md:grid-cols-2">
              <Input
                error={submitAttempted ? formErrors.senderEmail : undefined}
                label="From email"
                onChange={(event) => updateField("senderEmail", event.target.value)}
                placeholder="team@reachinbox.dev"
                value={form.senderEmail}
              />
              <Input
                label="From name"
                onChange={(event) => updateField("senderName", event.target.value)}
                placeholder="Growth Team"
                value={form.senderName}
              />
              {!hasSenderSelection && submitAttempted ? (
                <p className="md:col-span-2 text-xs text-rose-700">
                  Select a sender before scheduling this campaign.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              error={submitAttempted ? formErrors.subject : undefined}
              label="Subject"
              onChange={(event) => updateField("subject", event.target.value)}
              placeholder="Welcome to ReachInbox"
              value={form.subject}
            />

            <label className="grid gap-2 text-sm text-ink/78">
              <span className="font-medium">Start time</span>
              <input
                className={`field-base ${
                  submitAttempted && formErrors.startTime
                    ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                    : ""
                }`}
                min={toFutureLocalDateTime()}
                onChange={(event) => updateField("startTime", event.target.value)}
                type="datetime-local"
                value={form.startTime}
              />
              {submitAttempted && formErrors.startTime ? (
                <span className="text-xs text-rose-700">{formErrors.startTime}</span>
              ) : (
                <span className="text-xs text-ink/55">{formatStartTimeSummary(form.startTime)}</span>
              )}
            </label>
          </div>

          <Textarea
            error={submitAttempted ? formErrors.body : undefined}
            label="Email body"
            onChange={(event) => updateField("body", event.target.value)}
            placeholder="Write a clear message for every recipient in this campaign."
            rows={5}
            value={form.body}
          />
        </section>

        <section className="grid gap-4 border-b border-slate-200 pb-6">
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">Recipients</h3>
            <p className="mt-1 text-sm text-slate-500">
              Upload a CSV or paste email addresses. We'll detect, deduplicate,
              and validate recipients automatically.
            </p>
          </div>

          <label
            className={`block min-h-[120px] cursor-pointer rounded-[22px] border-2 border-dashed px-6 py-6 text-center transition ${
              isDraggingFile
                ? "border-coral bg-coral/5"
                : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
            }`}
            onDragEnter={() => setIsDraggingFile(true)}
            onDragLeave={() => setIsDraggingFile(false)}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDraggingFile(true);
            }}
            onDrop={(event) => void handleDrop(event)}
          >
            <input
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void handleFileUpload(file);
                event.target.value = "";
              }}
              type="file"
            />
            <div className="mx-auto flex max-w-xl flex-col items-center gap-2">
              <p className="text-base font-semibold text-slate-900">Upload recipient list</p>
              <p className="text-sm text-slate-500">Drag & drop CSV/TXT or click here</p>
              <p className="text-xs text-slate-400">CSV and TXT supported</p>
              {uploadedFileName ? (
                <p className="text-sm font-medium text-emerald-700">Loaded {uploadedFileName}</p>
              ) : null}
            </div>
          </label>

          <Textarea
            error={submitAttempted ? formErrors.recipientSource : undefined}
            helperText="Paste CSV rows, comma-separated values, or free-form text containing email addresses."
            label="Or paste email addresses"
            onChange={(event) => updateField("recipientSource", event.target.value)}
            placeholder={"email\njohn@example.com\njane@example.com"}
            rows={3}
            value={form.recipientSource}
          />

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">
              {parsedRecipients.recipients.length === 0
                ? "0 valid recipients"
                : `✓ ${parsedRecipients.recipients.length} valid`}
            </span>
            <span className="rounded-full bg-amber-50 px-3 py-1.5 font-medium text-amber-700">
              {parsedRecipients.duplicateCount} duplicate
              {parsedRecipients.duplicateCount === 1 ? "" : "s"} removed
            </span>
            <span className="rounded-full bg-rose-50 px-3 py-1.5 font-medium text-rose-700">
              {parsedRecipients.invalidEntries.length} invalid
            </span>
          </div>

          {previewRecipients.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {previewRecipients.map((recipient) => (
                <span
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
                  key={recipient}
                >
                  {recipient}
                </span>
              ))}
              {parsedRecipients.recipients.length > previewRecipients.length ? (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500">
                  +{parsedRecipients.recipients.length - previewRecipients.length} more
                </span>
              ) : null}
            </div>
          ) : null}

          {parsedRecipients.invalidEntries.length > 0 ? (
            <p className="text-xs text-rose-700">
              Invalid entries: {parsedRecipients.invalidEntries.slice(0, 5).join(", ")}
              {parsedRecipients.invalidEntries.length > 5 ? "..." : ""}
            </p>
          ) : null}
        </section>

        <section className="grid gap-4">
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">Schedule</h3>
            <p className="mt-1 text-sm text-slate-500">
              Configure pacing and the hourly limit for this batch.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2 text-sm text-ink/78">
              <span className="font-medium">Delay between emails</span>
              <select
                className={`field-base appearance-none ${
                  submitAttempted && formErrors.delayMs
                    ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                    : ""
                }`}
                onChange={(event) => updateField("delayMs", event.target.value)}
                value={form.delayMs}
              >
                {delayOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {submitAttempted && formErrors.delayMs ? (
                <span className="text-xs text-rose-700">{formErrors.delayMs}</span>
              ) : (
                <span className="text-xs text-ink/55">
                  Applied uniformly between scheduled sends.
                </span>
              )}
            </label>

            <label className="grid gap-2 text-sm text-ink/78">
              <span className="font-medium">Hourly limit</span>
              <select
                className={`field-base appearance-none ${
                  submitAttempted && formErrors.hourlyLimit
                    ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                    : ""
                }`}
                onChange={(event) => updateField("hourlyLimit", event.target.value)}
                value={form.hourlyLimit}
              >
                {hourlyLimitOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {submitAttempted && formErrors.hourlyLimit ? (
                <span className="text-xs text-rose-700">{formErrors.hourlyLimit}</span>
              ) : (
                <span className="text-xs text-ink/55">
                  Future sends are rescheduled when this cap is reached.
                </span>
              )}
            </label>
          </div>
        </section>

        {submitError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-900">
            {submitError}
          </div>
        ) : null}
      </div>
    </Modal>
  );
};
