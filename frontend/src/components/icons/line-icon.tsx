export function LineIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M12 2.5C6.48 2.5 2 6.08 2 10.5c0 3.96 3.51 7.27 8.26 7.89.32.07.76.21.87.49.1.25.06.64.03.9l-.14.84c-.04.25-.2.98.86.53 1.06-.44 5.71-3.36 7.79-5.76C21.11 13.81 22 12.23 22 10.5c0-4.42-4.48-8-10-8Z"
        fill="#049F44"
      />
      <path
        d="M6.4 8.4v4.2h2.1M9.7 8.4v4.2M11.1 12.6V8.4l2.4 4.2V8.4M17.5 8.4h-2.4v4.2h2.4M15.1 10.5h2"
        stroke="#FFFFFF"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default LineIcon;
