import { type JSX } from "react";

interface CardProps {
  className?: string;
  /** Optional heading rendered above the card body. */
  title?: string;
  children: React.ReactNode;
  /**
   * When provided the card becomes a link. External links open in a new tab,
   * internal ones stay in the current tab.
   */
  href?: string;
}

export function Card({
  className,
  title,
  children,
  href,
}: CardProps): JSX.Element {
  const content = (
    <>
      {title ? <h2 className="text-xl font-semibold">{title}</h2> : null}
      <p>{children}</p>
    </>
  );

  if (!href) {
    return <div className={className}>{content}</div>;
  }

  const isExternal = /^https?:\/\//.test(href);

  return (
    <a
      className={className}
      href={href}
      rel={isExternal ? "noopener noreferrer" : undefined}
      target={isExternal ? "_blank" : undefined}
    >
      {content}
    </a>
  );
}
