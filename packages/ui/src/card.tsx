import { type JSX } from "react";

interface CardProps {
  className?: string;
  /** Optional heading rendered above the card body. */
  title?: string;
  children: React.ReactNode;
  /** External links open in a new tab, internal ones stay in this one. */
  href: string;
}

export function Card({
  className,
  title,
  children,
  href,
}: CardProps): JSX.Element {
  const isExternal = /^https?:\/\//.test(href);

  return (
    <a
      className={className}
      href={href}
      rel={isExternal ? "noopener noreferrer" : undefined}
      target={isExternal ? "_blank" : undefined}
    >
      {title ? <h2 className="text-xl font-semibold">{title}</h2> : null}
      <p>{children}</p>
    </a>
  );
}
