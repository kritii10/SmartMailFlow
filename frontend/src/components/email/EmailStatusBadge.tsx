import type { EmailStatus } from "../../types";
import { Badge } from "../ui/Badge";

const toneByStatus: Record<EmailStatus, "warning" | "info" | "success" | "danger"> = {
  SCHEDULED: "warning",
  PROCESSING: "info",
  SENT: "success",
  FAILED: "danger"
};

export const EmailStatusBadge = ({ status }: { status: EmailStatus }) => (
  <Badge
    className="border border-current/10 px-2.5 py-1 text-[11px] font-medium normal-case tracking-normal"
    tone={toneByStatus[status]}
  >
    {status === "PROCESSING" ? "Processing" : status === "SENT" ? "Sent" : status === "FAILED" ? "Failed" : "Scheduled"}
  </Badge>
);
