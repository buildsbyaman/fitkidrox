import { Link } from '@tanstack/react-router'

import { EVENT } from '@/data/fixtures'
import { Logo } from './logo'

export function SiteFooter() {
  return (
    <footer className="bg-slate-900 text-slate-100 border-t border-slate-800">
      <div className="mx-auto grid max-w-content gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo inverted />
          <p className="font-display mt-6 text-3xl leading-tight font-extrabold uppercase text-slate-100">
            Young Minds. Stronger Bodies.
            <br />
            <span className="text-primary">Brighter Futures.</span>
          </p>
        </div>
        <div className="text-sm">
          <p className="mb-4 font-bold tracking-widest text-slate-400 uppercase text-xs">
            Event
          </p>
          <ul className="space-y-2.5 text-slate-300">
            <li>{EVENT.dateLabel}</li>
            <li>
              {EVENT.venue}, {EVENT.city}
            </li>
            <li className="text-slate-500 text-xs">{EVENT.venueStatus}</li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="mb-4 font-bold tracking-widest text-slate-400 uppercase text-xs">
            Get involved
          </p>
          <ul className="space-y-2.5 text-slate-300">
            <li>
              <Link
                to="/register"
                className="hover:text-primary transition-colors"
              >
                Register your child
              </Link>
            </li>
            <li>
              <Link
                to="/schools"
                className="hover:text-primary transition-colors"
              >
                School partnerships
              </Link>
            </li>
            <li>
              <Link
                to="/sponsors"
                className="hover:text-primary transition-colors"
              >
                Sponsor FITKIDROX
              </Link>
            </li>
            <li>
              <a
                href={`mailto:${EVENT.email}`}
                className="hover:text-primary transition-colors"
              >
                {EVENT.email}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-800/80">
        <p className="mx-auto max-w-content px-4 py-5 text-xs text-slate-500 sm:px-6">
          © 2026 PSSS · FITKIDROX · {EVENT.domain}. Event details, venue and
          fees are provisional until confirmed.
        </p>
      </div>
    </footer>
  )
}
