type GoogleIconProps = {
  className?: string;
};

export function GoogleIcon({ className }: GoogleIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.88c2.27-2.09 3.57-5.18 3.57-8.64Z"
        fill="#4285F4"
      />
      <path
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.88-3c-1.08.73-2.46 1.16-4.05 1.16-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A11.98 11.98 0 0 0 12 24Z"
        fill="#34A853"
      />
      <path
        d="M5.29 14.3A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.58.38-2.3V6.6H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.4l4.01-3.1Z"
        fill="#FBBC04"
      />
      <path
        d="M12 4.77c1.77 0 3.35.61 4.6 1.81l3.45-3.45C17.95 1.16 15.24 0 12 0 7.31 0 3.26 2.69 1.28 6.6l4.01 3.1c.94-2.84 3.59-4.93 6.71-4.93Z"
        fill="#EA4335"
      />
    </svg>
  );
}