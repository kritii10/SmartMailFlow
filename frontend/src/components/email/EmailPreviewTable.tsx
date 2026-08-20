import type { EmailRecord } from "../../types";
import { formatDateTime } from "../../utils/format";
import { EmptyState } from "../ui/EmptyState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/Table";
import { EmailStatusBadge } from "./EmailStatusBadge";

type EmailPreviewTableProps = {
  emails: EmailRecord[];
  variant: "scheduled" | "sent";
  emptyTitle: string;
  emptyDescription: string;
};

export const EmailPreviewTable = ({
  emails,
  emptyDescription,
  emptyTitle,
  variant
}: EmailPreviewTableProps) => {
  if (emails.length === 0) {
    return <EmptyState description={emptyDescription} title={emptyTitle} />;
  }

  const timeLabel = variant === "scheduled" ? "Scheduled time" : "Sent time";
  const resolveTime = (email: EmailRecord) =>
    variant === "scheduled" ? email.scheduledAt : email.sentAt ?? email.createdAt;

  return (
    <Table>
      <TableHead>
        <TableRow className="border-none bg-transparent">
          <TableHeader className="bg-slate-50 text-slate-500">Email</TableHeader>
          <TableHeader className="bg-slate-50 text-slate-500">Subject</TableHeader>
          <TableHeader className="bg-slate-50 text-slate-500">{timeLabel}</TableHeader>
          <TableHeader className="bg-slate-50 text-slate-500">Status</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {emails.map((email) => (
          <TableRow key={email.id} className="border-slate-100">
            <TableCell className="font-medium text-slate-900">
              <div className="min-w-[180px]">
                <p className="text-sm font-medium text-slate-900">{email.recipientEmail}</p>
                <p className="mt-1 text-xs text-slate-500">Sender: {email.senderName ?? email.senderEmail}</p>
              </div>
            </TableCell>
            <TableCell className="max-w-[380px]">
              <div className="min-w-[220px]">
                <p className="truncate text-sm font-medium text-slate-900">{email.subject}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{email.body}</p>
              </div>
            </TableCell>
            <TableCell className="whitespace-nowrap text-sm text-slate-600">
              {formatDateTime(resolveTime(email))}
            </TableCell>
            <TableCell>
              <EmailStatusBadge status={email.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
