import "./SkipLink.css";

export interface SkipLinkProps {
  /** Id of the element that receives focus, without the leading "#". */
  targetId: string;
  children?: string;
}

/**
 * "Skip to graveyard" link. It must be the first focusable element on the page.
 * Hidden until it has keyboard focus, then shown with a visible focus ring.
 * The target needs tabIndex={-1} so focus actually moves there.
 */
export function SkipLink({
  targetId,
  children = "Skip to graveyard",
}: SkipLinkProps) {
  return (
    <a className="skip-link" href={`#${targetId}`}>
      {children}
    </a>
  );
}
