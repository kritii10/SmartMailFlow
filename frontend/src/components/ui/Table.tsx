import type {
  HTMLAttributes,
  PropsWithChildren,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes
} from "react";
import { cn } from "../../utils/cn";

export const Table = ({
  children,
  className,
  ...props
}: PropsWithChildren<TableHTMLAttributes<HTMLTableElement>>) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="overflow-x-auto">
      <table className={cn("min-w-full border-collapse text-left text-sm", className)} {...props}>
        {children}
      </table>
    </div>
  </div>
);

export const TableHead = ({
  children,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLTableSectionElement>>) => (
  <thead className={cn("bg-slate-50 text-slate-600", className)} {...props}>
    {children}
  </thead>
);

export const TableBody = ({
  children,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLTableSectionElement>>) => (
  <tbody className={cn(className)} {...props}>
    {children}
  </tbody>
);

export const TableRow = ({
  children,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLTableRowElement>>) => (
  <tr className={cn("border-t border-slate-100", className)} {...props}>
    {children}
  </tr>
);

export const TableHeader = ({
  children,
  className,
  ...props
}: PropsWithChildren<ThHTMLAttributes<HTMLTableCellElement>>) => (
  <th className={cn("px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em]", className)} {...props}>
    {children}
  </th>
);

export const TableCell = ({
  children,
  className,
  ...props
}: PropsWithChildren<TdHTMLAttributes<HTMLTableCellElement>>) => (
  <td className={cn("px-4 py-4 text-sm text-slate-700", className)} {...props}>
    {children}
  </td>
);
