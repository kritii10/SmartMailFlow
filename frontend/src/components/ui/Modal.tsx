import type { PropsWithChildren, ReactNode } from "react";
import { Button } from "./Button";

type ModalProps = PropsWithChildren<{
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  footer?: ReactNode;
}>;

export const Modal = ({
  children,
  description,
  footer,
  onClose,
  open,
  title
}: ModalProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 px-4 py-8">
      <div className="surface-panel w-full max-w-2xl overflow-hidden rounded-[30px] bg-white">
        <div className="flex items-start justify-between gap-4 border-b border-black/5 px-6 py-5">
          <div>
            <h2 className="font-serif text-2xl text-ink">{title}</h2>
            {description ? <p className="mt-2 text-sm text-ink/65">{description}</p> : null}
          </div>
          <Button aria-label="Close modal" onClick={onClose} size="sm" variant="ghost">
            Close
          </Button>
        </div>
        <div className="px-6 py-6">{children}</div>
        {footer ? <div className="border-t border-black/5 px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
};
