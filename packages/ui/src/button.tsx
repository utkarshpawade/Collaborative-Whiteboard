"use client";

import { ReactNode } from "react";

interface ButtonProps {
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}

export const Button = ({
  className = "",
  onClick,
  children,
}: ButtonProps) => {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
