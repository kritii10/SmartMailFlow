import type { PropsWithChildren, ReactNode } from "react";
import { Button } from "./Button";

type ModalProps = PropsWithChildren<{
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  footer?: ReactNode;
  maxWidthClassName?: string;
}>;

export const Modal = ({
  children,
  description,
  footer,
  maxWidthClassName = "max-w-2xl",
  onClose,
  open,
  title
}: ModalProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-4 py-6 backdrop-blur-[2px] md:py-10">
      <div className="flex min-h-full items-center justify-center">
        <div
          className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_28px_70px_rgba(15,23,42,0.18)] ${maxWidthClassName}`}
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
            <div>
              <h2 className="font-serif text-[22px] text-ink">{title}</h2>
              {description ? <p className="mt-1.5 text-sm text-ink/65">{description}</p> : null}
            </div>
            <Button
              aria-label="Close modal"
              className="border-transparent bg-transparent px-3 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              onClick={onClose}
              size="sm"
              variant="ghost"
            >
              Close
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
          {footer ? <div className="border-t border-slate-200 px-6 py-4">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
};
