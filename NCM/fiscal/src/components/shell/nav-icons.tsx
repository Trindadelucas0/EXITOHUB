import type { ReactNode } from "react";

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconComoUsar(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 4h9a2 2 0 0 1 2 2v14l-4-2-4 2V6a2 2 0 0 1 2-2Z" />
      <path d="M9 9h6" />
      <path d="M9 13h4" />
    </Svg>
  );
}

export function IconPanorama(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </Svg>
  );
}

export function IconConsultar(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </Svg>
  );
}

export function IconDivergencias(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 4.7 2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.7a2 2 0 0 0-3.4 0Z" />
    </Svg>
  );
}

export function IconBaseFiscal(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 19V7l8-4 8 4v12" />
      <path d="M4 11h16" />
      <path d="M12 7v12" />
    </Svg>
  );
}

export function IconImportar(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v12" />
      <path d="M8 11l4 4 4-4" />
      <path d="M5 21h14" />
    </Svg>
  );
}

export function IconEmpresas(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 21h18" />
      <path d="M5 21V5h8v16" />
      <path d="M13 10h6v11" />
      <path d="M8 8h2" />
      <path d="M8 12h2" />
      <path d="M8 16h2" />
    </Svg>
  );
}

export function IconUsuarios(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M21 20a4.5 4.5 0 0 0-5-4.4" />
    </Svg>
  );
}
