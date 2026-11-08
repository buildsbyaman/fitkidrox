export const INSTAGRAM_URL =
  'https://www.instagram.com/fitkidrox?exln=eWU4ZTA4eXltbnA%3D'
export const INSTAGRAM_HANDLE = '@fitkidrox'

/**
 * Official authentic Instagram icon in signature sunset gradient and white.
 */
export function InstagramIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="fkx-ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f09433" />
          <stop offset="25%" stopColor="#e6683c" />
          <stop offset="50%" stopColor="#dc2743" />
          <stop offset="75%" stopColor="#cc2366" />
          <stop offset="100%" stopColor="#bc1888" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="5.5"
        fill="url(#fkx-ig-grad)"
      />
      <rect
        x="5.5"
        y="5.5"
        width="13"
        height="13"
        rx="3.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.6"
      />
      <circle
        cx="12"
        cy="12"
        r="3.2"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.6"
      />
      <circle cx="15.8" cy="8.2" r="0.9" fill="#FFFFFF" />
    </svg>
  )
}

