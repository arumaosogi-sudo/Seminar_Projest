/**
 * Small inline SVG icons for the student area (no icon library → zero extra KB).
 * All icons are decorative (aria-hidden); give the surrounding control an accessible name.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 24, ...rest }: IconProps): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: false,
    ...rest,
  };
}

export function HouseIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9v10.5h13V9" />
      <path d="M10 19.5v-5h4v5" />
    </svg>
  );
}

export function BalloonIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 15.5c3.3 0 5.8-3 5.8-6.4A5.8 5.8 0 0 0 12 3.2a5.8 5.8 0 0 0-5.8 5.9c0 3.4 2.5 6.4 5.8 6.4Z" />
      <path d="m10.9 15.4.2 1.3h1.8l.2-1.3" />
      <path d="M12 16.7c0 1.6-1.4 2-1.4 3.3 0 .6.3 1 .7 1.3" />
      <path d="M9.4 7.4a2.8 2.8 0 0 1 1.8-1.6" />
    </svg>
  );
}

export function CubeIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 2.8 20 7.2v9.6l-8 4.4-8-4.4V7.2l8-4.4Z" />
      <path d="M4 7.2 12 11.6l8-4.4" />
      <path d="M12 11.6v9.6" />
    </svg>
  );
}

export function ChecklistIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
      <path d="m7.5 8.5 1.3 1.3 2.4-2.6" />
      <path d="M13.5 9h3.5" />
      <path d="m7.5 14.5 1.3 1.3 2.4-2.6" />
      <path d="M13.5 15h3.5" />
    </svg>
  );
}

export function LockIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function CheckIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function InfoIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.6v.1" />
    </svg>
  );
}

export function ArrowLeftIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </svg>
  );
}

export function ArrowRightIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function ChevronLeftIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m15 5-7 7 7 7" />
    </svg>
  );
}

export function ClockIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function XIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}
