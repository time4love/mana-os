"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

export type SheetContentSide = "start" | "end" | "top" | "bottom";

interface SheetContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheetContext() {
  const ctx = React.useContext(SheetContext);
  if (!ctx) throw new Error("Sheet components must be used within Sheet");
  return ctx;
}

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function Sheet({ open, onOpenChange, children }: SheetProps) {
  const value = React.useMemo(
    () => ({ open, onOpenChange }),
    [open, onOpenChange]
  );
  return (
    <SheetContext.Provider value={value}>{children}</SheetContext.Provider>
  );
}

function SheetTrigger({
  children,
  asChild,
  ...props
}: {
  children: React.ReactNode;
  asChild?: boolean;
} & React.HTMLAttributes<HTMLButtonElement>) {
  const { onOpenChange } = useSheetContext();
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: () => onOpenChange(true),
    });
  }
  return (
    <button type="button" onClick={() => onOpenChange(true)} {...props}>
      {children}
    </button>
  );
}

interface SheetContentProps {
  side?: SheetContentSide;
  className?: string;
  children: React.ReactNode;
  /** When true, clicking the backdrop does not close the sheet. User must use an explicit close control. */
  preventBackdropClose?: boolean;
  /** Called when user interacts outside the panel (e.g. backdrop click). Call e.preventDefault() to block closing. */
  onInteractOutside?: (e: React.MouseEvent) => void;
}

function SheetContent({
  side = "end",
  className = "",
  children,
  preventBackdropClose = false,
  onInteractOutside,
}: SheetContentProps) {
  const { open, onOpenChange } = useSheetContext();
  const isHorizontal = side === "start" || side === "end";
  const sizeClass = isHorizontal
    ? "h-full w-full max-w-sm sm:max-w-md"
    : "w-full max-h-[85vh]";
  const positionClass = isHorizontal
    ? side === "end"
      ? "inset-y-0 end-0"
      : "inset-y-0 start-0"
    : side === "top"
      ? "inset-x-0 top-0"
      : "inset-x-0 bottom-0";

  const handleOverlayClick = (e: React.MouseEvent) => {
    onInteractOutside?.(e);
    if (e.defaultPrevented || preventBackdropClose) return;
    onOpenChange(false);
  };

  React.useEffect(() => {
    if (!open) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [open, onOpenChange]);

  if (typeof document === "undefined") return null;

  const overlay = (
    <motion.div
      key="sheet-overlay"
      role="presentation"
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[1200] bg-overlay"
      onClick={handleOverlayClick}
    />
  );

  const panel = (
    <motion.div
      key="sheet-panel"
      role="dialog"
      aria-modal
      initial={
        isHorizontal
          ? { x: side === "end" ? "100%" : "-100%" }
          : { y: side === "bottom" ? "100%" : "-100%" }
      }
      animate={isHorizontal ? { x: 0 } : { y: 0 }}
      exit={
        isHorizontal
          ? { x: side === "end" ? "100%" : "-100%" }
          : { y: side === "bottom" ? "100%" : "-100%" }
      }
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] as const }}
      className={`fixed z-[1200] flex flex-col gap-4 bg-card text-card-foreground shadow-soft-md border border-border ${positionClass} ${sizeClass} ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </motion.div>
  );

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {overlay}
          {panel}
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

function SheetClose({
  children,
  asChild,
  ...props
}: {
  children: React.ReactNode;
  asChild?: boolean;
} & React.HTMLAttributes<HTMLButtonElement>) {
  const { onOpenChange } = useSheetContext();
  const handleClose = () => onOpenChange(false);
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: handleClose,
    });
  }
  return (
    <button type="button" onClick={handleClose} {...props}>
      {children}
    </button>
  );
}

const SheetPortal = ({ children }: { children: React.ReactNode }) => <>{children}</>;

function SheetHeader({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex flex-col gap-1.5 p-6 pb-4 text-center sm:text-start ${className}`}
      {...props}
    />
  );
}

function SheetTitle({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={`text-lg font-semibold leading-none text-foreground ${className}`}
      {...props}
    />
  );
}

function SheetDescription({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-sm text-muted-foreground ${className}`} {...props} />
  );
}

function SheetBody({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex-1 overflow-y-auto px-6 pb-6 ${className}`}
      {...props}
    />
  );
}

function SheetFooter({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex flex-col-reverse gap-2 p-6 pt-4 sm:flex-row sm:justify-end ${className}`}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
  SheetPortal,
};
