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

const initialFormState = (): ComposeFormState => ({
  senderEmail: "",
  senderName: "",
  subject: "",
  body: "",
  recipientSource: "",
  startTime: "",
  delayMs: "2000",
  hourlyLimit: ""
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
    errors.recipientSource = "Upload or paste CSV/text content containing email addresses.";
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

  const parsedRecipients = useMemo(
    () => parseRecipientInput(form.recipientSource),
    [form.recipientSource]
  );

  const formErrors = useMemo(
    () =>
      validateComposeForm(
        form,
        parsedRecipients.recipients,
        parsedRecipients.invalidEntries
      ),
    [form, parsedRecipients.invalidEntries, parsedRecipients.recipients]
  );

  const resetForm = () => {
    setForm({
      ...initialFormState(),
      startTime: toFutureLocalDateTime()
    });
    setSubmitAttempted(false);
    setSubmitting(false);
    setSubmitError(null);
    setUploadedFileName(null);
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

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    setSubmitError(null);

    if (Object.keys(formErrors).length > 0 || submitting) {
      return;
    }

    setSubmitting(true);

    try {
      const result = await emailService.scheduleEmails({
        senderEmail: form.senderEmail.trim() || undefined,
        senderName: form.senderName.trim() || undefined,
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

  const previewRecipients = parsedRecipients.recipients.slice(0, 6);

  return (
    <Modal
      description="Upload a CSV or paste text, review the detected recipients, then schedule the batch through the backend queue."
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Detected {parsedRecipients.recipients.length} email address
            {parsedRecipients.recipients.length === 1 ? "" : "es"}
          </p>
          <div className="flex gap-3">
            <Button disabled={submitting} onClick={onClose} variant="ghost">
              Cancel
            </Button>
            <Button disabled={submitting} onClick={() => void handleSubmit()}>
              {submitting ? "Scheduling..." : "Schedule Emails"}
            </Button>
          </div>
        </div>
      }
      onClose={onClose}
      open={open}
      title="Compose New Email"
    >
      <div className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            error={submitAttempted ? formErrors.senderEmail : undefined}
            helperText="Optional. Use a different sender identity for this batch."
            label="Sender email"
            onChange={(event) => updateField("senderEmail", event.target.value)}
            placeholder="team@reachinbox.dev"
            value={form.senderEmail}
          />
          <Input
            helperText="Optional display name for the sender."
            label="Sender name"
            onChange={(event) => updateField("senderName", event.target.value)}
            placeholder="Growth Team"
            value={form.senderName}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            error={submitAttempted ? formErrors.subject : undefined}
            label="Subject"
            onChange={(event) => updateField("subject", event.target.value)}
            placeholder="Welcome to ReachInbox"
            value={form.subject}
          />
          <Input
            error={submitAttempted ? formErrors.startTime : undefined}
            label="Start time"
            min={toFutureLocalDateTime()}
            onChange={(event) => updateField("startTime", event.target.value)}
            type="datetime-local"
            value={form.startTime}
          />
        </div>

        <Textarea
          error={submitAttempted ? formErrors.body : undefined}
          label="Body"
          onChange={(event) => updateField("body", event.target.value)}
          placeholder="Write the email body that every detected recipient should receive."
          rows={7}
          value={form.body}
        />

        <div className="grid gap-3">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">CSV/text upload</p>
              <p className="mt-1 text-xs text-slate-500">
                Upload a `.csv` or `.txt` file, or paste raw email text below.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
              Upload File
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
            </label>
          </div>

          <Textarea
            error={submitAttempted ? formErrors.recipientSource : undefined}
            helperText={
              uploadedFileName
                ? `Loaded from ${uploadedFileName}`
                : "Paste CSV rows, comma-separated values, or free-form text containing email addresses."
            }
            label="Recipients source"
            onChange={(event) => updateField("recipientSource", event.target.value)}
            placeholder={"email\njohn@example.com\njane@example.com"}
            rows={8}
            value={form.recipientSource}
          />

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-medium text-slate-900">
                Detected {parsedRecipients.recipients.length} email address
                {parsedRecipients.recipients.length === 1 ? "" : "es"}
              </p>
              {parsedRecipients.duplicateCount > 0 ? (
                <span className="text-xs text-amber-700">
                  Removed {parsedRecipients.duplicateCount} duplicate
                  {parsedRecipients.duplicateCount === 1 ? "" : "s"}
                </span>
              ) : null}
              {parsedRecipients.invalidEntries.length > 0 ? (
                <span className="text-xs text-rose-700">
                  {parsedRecipients.invalidEntries.length} invalid entr
                  {parsedRecipients.invalidEntries.length === 1 ? "y" : "ies"} found
                </span>
              ) : null}
            </div>

            {previewRecipients.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {previewRecipients.map((recipient) => (
                  <span
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                    key={recipient}
                  >
                    {recipient}
                  </span>
                ))}
                {parsedRecipients.recipients.length > previewRecipients.length ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                    +{parsedRecipients.recipients.length - previewRecipients.length} more
                  </span>
                ) : null}
              </div>
            ) : null}

            {parsedRecipients.invalidEntries.length > 0 ? (
              <p className="mt-3 text-xs text-rose-700">
                Invalid entries: {parsedRecipients.invalidEntries.slice(0, 5).join(", ")}
                {parsedRecipients.invalidEntries.length > 5 ? "..." : ""}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            error={submitAttempted ? formErrors.delayMs : undefined}
            helperText="Milliseconds between scheduled emails."
            label="Delay between emails"
            min="0"
            onChange={(event) => updateField("delayMs", event.target.value)}
            placeholder="2000"
            step="1"
            type="number"
            value={form.delayMs}
          />
          <Input
            error={submitAttempted ? formErrors.hourlyLimit : undefined}
            helperText="Optional cap for how many emails should be scheduled in one hour window."
            label="Hourly limit"
            min="1"
            onChange={(event) => updateField("hourlyLimit", event.target.value)}
            placeholder="100"
            step="1"
            type="number"
            value={form.hourlyLimit}
          />
        </div>

        {submitError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-900">
            {submitError}
          </div>
        ) : null}
      </div>
    </Modal>
  );
};
