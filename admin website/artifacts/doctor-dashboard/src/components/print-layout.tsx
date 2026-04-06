import React from "react";

interface PrintLayoutProps {
  children: React.ReactNode;
  className?: string;
  innerRef?: React.RefObject<HTMLDivElement | null>;
}

export function PrintLayout({ children, className, innerRef }: PrintLayoutProps) {
  return (
    <div ref={innerRef} className={`print-content ${className ?? ""}`}>
      {children}
    </div>
  );
}

export function NoPrint({ children }: { children: React.ReactNode }) {
  return <span className="no-print">{children}</span>;
}
