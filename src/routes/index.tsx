import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  HeartPulse,
  MapPin,
  School,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  Users,
} from 'lucide-react'

import { PageShell } from '@/components/site/page-shell'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CATEGORIES,
  EVENT,
  FAQS,
  SAFETY_POINTS,
  categoryForAge,
} from '@/data/fixtures'
import { formatINR } from '@/lib/format'
import { cdnImage } from '@/lib/image'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <PageShell>
      <Hero />
      <Marquee />
      <About />
      <Categories />
      <Safety />
      <Audiences />
      <RoadToRaceDay />
      <Faq />
    </PageShell>
  )
}

function useCountdown(target: string) {
  const [now, setNow] = useState<number | null>(() =>
    typeof window !== 'undefined' ? Date.now() : null,
  )
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000 * 30)
    return () => clearInterval(id)
  }, [])
  if (now === null) return null
  const diff = Math.max(0, new Date(target).getTime() - now)
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
  }
}

function Hero() {
  const countdown = useCountdown(EVENT.startDate)
  return (
    <section className="track-lines relative overflow-hidden">
      <div className="mx-auto grid max-w-content items-center gap-10 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-16 lg:pb-24">
        <div className="animate-rise motion-reduce:animate-none">
          <Badge className="mb-6 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-bold tracking-widest text-primary uppercase">
            {EVENT.edition}
          </Badge>
          <h1 className="font-display text-[clamp(4.5rem,13vw,9.5rem)] leading-[0.82] font-black tracking-tight uppercase">
            Fit<span className="text-primary">kid</span>rox
          </h1>
          <p className="font-display mt-5 text-2xl leading-tight font-extrabold uppercase sm:text-3xl text-foreground">
            Young Minds. Stronger Bodies.{' '}
            <span className="text-primary">Brighter Futures.</span>
          </p>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">
            A supervised fitness race for children aged 3 to 13+, inspired by
            the HYROX format and scaled for every age. Run, crawl, jump, carry
            and relay with your school.
          </p>

          <div className="mt-7 flex flex-wrap gap-3 text-sm font-semibold">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card px-4 py-2 shadow-sm">
              <CalendarDays className="size-4 text-primary" />
              {EVENT.dateLabel}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card px-4 py-2 shadow-sm">
              <MapPin className="size-4 text-primary" />
              {EVENT.venue}, {EVENT.city}
            </span>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="h-12 px-7 text-base font-bold shadow-md shadow-primary/20"
            >
              <Link to="/register">
                Register interest <ArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 px-7 text-base font-bold bg-card"
            >
              <Link to="/schools">Enter as a school</Link>
            </Button>
          </div>
        </div>

        <div className="relative animate-rise [animation-delay:150ms] motion-reduce:animate-none">
          <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl shadow-slate-900/10">
            <img
              src={cdnImage('/img/hero.png', 1100)}
              alt="Children in orange and navy race bibs running through a hurdle course while coaches supervise"
              width={1100}
              height={614}
              className="aspect-[4/3] w-full object-cover transition-transform duration-700 hover:scale-[1.02]"
              fetchPriority="high"
            />
          </div>

          {/* Race countdown badge */}
          <div className="absolute -bottom-6 -left-2 w-64 rounded-2xl border border-border/90 bg-card/95 backdrop-blur-md p-4 shadow-xl shadow-slate-900/10 sm:-left-6">
            <div className="flex items-center justify-between text-[0.65rem] font-bold tracking-widest text-muted-foreground uppercase">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                Race day in
              </span>
              <span className="font-semibold text-foreground/80">
                CHD · 2026
              </span>
            </div>
            <div className="font-display mt-1 flex items-baseline justify-between font-black text-foreground">
              <CountUnit value={countdown?.days} label="days" />
              <CountUnit value={countdown?.hours} label="hrs" />
              <CountUnit value={countdown?.minutes} label="min" />
            </div>
            <div className="mt-2.5 h-1.5 rounded-full bg-primary/20 overflow-hidden">
              <div className="h-full w-2/3 rounded-full bg-primary" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function CountUnit({ value, label }: { value?: number; label: string }) {
  return (
    <span className="flex items-baseline gap-0.5">
      <span className="text-4xl tabular-nums">
        {value === undefined ? '--' : String(value).padStart(2, '0')}
      </span>
      <span className="text-xs text-muted-foreground uppercase">{label}</span>
    </span>
  )
}

const MOVES = [
  'Run',
  'Crawl',
  'Jump',
  'Carry',
  'Balance',
  'Relay',
  'Push',
  'Finish',
]

function Marquee() {
  const items = [...MOVES, ...MOVES]
  return (
    <div
      className="relative flex overflow-hidden border-y border-border bg-primary py-3.5 text-primary-foreground select-none shadow-sm"
      aria-hidden
    >
      <div className="animate-marquee flex shrink-0 items-center gap-8 pr-8 min-w-full motion-reduce:animate-none">
        {items.map((m, i) => (
          <span
            key={`m1-${i}`}
            className="font-display flex items-center gap-8 text-2xl font-black uppercase tracking-wider"
          >
            {m}
            <span className="size-2 rounded-full bg-primary-foreground/40" />
          </span>
        ))}
      </div>
      <div className="animate-marquee flex shrink-0 items-center gap-8 pr-8 min-w-full motion-reduce:animate-none">
        {items.map((m, i) => (
          <span
            key={`m2-${i}`}
            className="font-display flex items-center gap-8 text-2xl font-black uppercase tracking-wider"
          >
            {m}
            <span className="size-2 rounded-full bg-primary-foreground/40" />
          </span>
        ))}
      </div>
    </div>
  )
}

function About() {
  const stats = [
    { value: '2', label: 'Event days' },
    { value: '4', label: 'Age categories' },
    {
      value: EVENT.targetParticipants.toLocaleString('en-IN'),
      label: 'Participant target',
    },
    { value: formatINR(EVENT.entryFee), label: 'Proposed entry' },
  ]
  return (
    <section className="mx-auto max-w-content px-4 py-20 mt-4 sm:px-6">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="text-sm font-bold tracking-[0.25em] text-primary uppercase">
            What is FITKIDROX
          </p>
          <h2 className="font-display mt-3 text-5xl leading-[0.9] font-black uppercase sm:text-6xl">
            A real race day, built for growing bodies
          </h2>
        </div>
        <div className="space-y-5 text-lg text-muted-foreground">
          <p>
            FITKIDROX takes the fitness-race idea and turns it into
            age-appropriate, fun and competitive challenges for children and
            teenagers. Schools host teams, parents cheer from the stands, and
            every finisher takes home a medal.
          </p>
          <p>
            Our goal is an annual event that schools build into their calendar,
            parents trust, and children look forward to every year, starting
            with the flagship weekend in Chandigarh.
          </p>
        </div>
      </div>

      <dl className="mt-12 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
          >
            <dt className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
              {s.label}
            </dt>
            <dd className="font-display mt-2 text-5xl font-black text-foreground">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        Participant figure is a planning target. Entry fee is proposed and
        subject to final approval.
      </p>
    </section>
  )
}

function Categories() {
  const [age, setAge] = useState(8)
  const match = categoryForAge(age)
  return (
    <section
      id="categories"
      className="track-lines scroll-mt-16 border-y border-border/70 py-24"
    >
      <div className="mx-auto max-w-content px-4 sm:px-6">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-bold tracking-[0.25em] text-primary uppercase">
              Four categories
            </p>
            <h2 className="font-display mt-3 text-5xl leading-[0.9] font-black uppercase sm:text-6xl">
              A course for every age
            </h2>
          </div>

          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-sm">
            <label
              htmlFor="age-finder"
              className="flex items-baseline justify-between text-sm font-bold"
            >
              <span>Find your child’s category</span>
              <span className="font-display text-3xl font-black text-primary">
                {age}
                {age === 16 ? '+' : ''} yrs
              </span>
            </label>
            <input
              id="age-finder"
              type="range"
              min={3}
              max={16}
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
              className="mt-3 w-full accent-[var(--primary)] cursor-pointer"
            />
            <p className="mt-2 text-sm text-muted-foreground">
              Age on 28 Nov 2026 →{' '}
              <span className="font-bold text-foreground">{match?.name}</span>
            </p>
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 md:pb-10">
          {CATEGORIES.map((c, i) => {
            const active = match?.id === c.id
            return (
              <article
                key={c.id}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border bg-card transition-all duration-300 motion-reduce:transition-none',
                  active
                    ? 'border-primary ring-2 ring-primary/20 shadow-xl shadow-primary/10'
                    : 'border-border/80 hover:border-border hover:shadow-md',
                  i % 2 === 1 && 'md:translate-y-8',
                )}
              >
                <div className="relative h-52 overflow-hidden">
                  <img
                    src={cdnImage(c.image, 800)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-secondary/90 via-secondary/40 to-transparent" />
                  <span className="font-display absolute bottom-3 left-4 text-6xl font-black text-secondary-foreground">
                    {c.ages.replace(' years', '')}
                    <span className="ml-1 text-xl">yrs</span>
                  </span>
                  {active && (
                    <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground font-bold shadow-sm">
                      Your category
                    </Badge>
                  )}
                </div>
                <div className="p-6">
                  <h3 className="font-display text-3xl font-black uppercase text-foreground">
                    {c.name}
                  </h3>
                  <p className="mt-2 text-muted-foreground">{c.focus}</p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {c.stations.map((s) => (
                      <li
                        key={s}
                        className="rounded-full border border-border/60 bg-muted/70 px-3 py-1 text-xs font-semibold text-foreground/80"
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 border-t border-border/70 pt-4 text-sm font-semibold text-foreground">
                    {c.format}
                  </p>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

const SAFETY_ICONS = [ShieldCheck, UserCheck, Stethoscope, HeartPulse]

function Safety() {
  return (
    <section
      id="safety"
      className="relative scroll-mt-16 overflow-hidden bg-background py-24 text-foreground border-t border-border/70"
    >
      <div className="mx-auto grid max-w-content gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-bold tracking-[0.25em] text-primary uppercase">
            Parents first
          </p>
          <h2 className="font-display mt-3 text-5xl leading-[0.9] font-black uppercase text-foreground sm:text-6xl">
            Competitive. Fun.
            <br />
            Always supervised.
          </h2>
          <p className="mt-6 max-w-md text-muted-foreground leading-relaxed">
            Every activity follows age-appropriate rules with trained
            supervision, first-aid arrangements and parental consent. Our full
            event safety plan is published before registration opens.
          </p>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2">
          {SAFETY_POINTS.map((p, i) => {
            const Icon = SAFETY_ICONS[i]
            return (
              <li
                key={p.title}
                className="rounded-2xl border border-border bg-card p-6 shadow-sm hover:border-primary/40 transition-colors"
              >
                <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="size-6 text-primary" />
                </div>
                <h3 className="font-display mt-4 text-2xl font-extrabold uppercase text-foreground">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {p.body}
                </p>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

function Audiences() {
  return (
    <section className="track-lines border-y border-border/70 py-24">
      <div className="mx-auto max-w-content px-4 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="relative overflow-hidden rounded-3xl bg-primary p-8 text-primary-foreground sm:p-10 shadow-lg shadow-primary/15">
            <School className="size-10" />
            <h2 className="font-display mt-6 text-5xl leading-[0.9] font-black uppercase">
              Schools, bring your team
            </h2>
            <p className="mt-4 max-w-md text-primary-foreground/90">
              Submit your whole roster at once, get one consolidated invoice and
              compete for the school-team trophy. Partner schools are invited
              back every year.
            </p>
            <ul className="mt-6 space-y-2 text-sm font-semibold">
              {[
                'Bulk entries with one coordinator',
                'School-team rankings and trophy',
                'Recurring annual event slot',
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="size-4" /> {t}
                </li>
              ))}
            </ul>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="mt-8 h-12 px-6 font-bold bg-white text-slate-900 hover:bg-slate-100 shadow-sm"
            >
              <Link to="/schools">
                Start a school entry <ArrowRight />
              </Link>
            </Button>
            <Users
              className="absolute -right-10 -bottom-10 size-64 opacity-10"
              aria-hidden
            />
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex-1 rounded-3xl border border-border bg-card p-8 shadow-sm hover:border-primary/40 hover:shadow-md transition-all">
              <Building2 className="size-9 text-primary" />
              <h2 className="font-display mt-5 text-4xl leading-[0.9] font-black uppercase text-foreground">
                Sponsors, meet Chandigarh’s families
              </h2>
              <p className="mt-3 text-muted-foreground">
                Title, T-shirt and associate packages with logo placements on
                shirts, medals and the finish arch.
              </p>
              <Button
                asChild
                variant="link"
                className="mt-3 px-0 font-bold text-primary"
              >
                <Link to="/sponsors">
                  View sponsor packages <ArrowRight />
                </Link>
              </Button>
            </div>

            <div className="rounded-3xl border border-border bg-card p-8 shadow-sm hover:border-primary/40 hover:shadow-md transition-all">
              <Badge
                variant="outline"
                className="border-primary/30 text-primary font-bold"
              >
                Parents &amp; Guardians
              </Badge>
              <p className="font-display mt-3 text-4xl leading-[0.9] font-black uppercase text-foreground">
                Pre-register early
              </p>
              <p className="mt-3 text-muted-foreground">
                Register your interest today. We’ll email you the moment paid
                registration opens, before public announcement.
              </p>
              <Button
                asChild
                className="mt-5 font-bold shadow-sm"
                size="default"
              >
                <Link to="/register">Register interest</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const MILESTONES = [
  {
    label: 'Venue confirmation',
    detail: 'Sector 10D Skating Rink booking and suitability check',
    status: 'In progress',
  },
  {
    label: 'Budget & safety plan',
    detail: 'Station design, supervision ratios, first-aid and insurance',
    status: 'In progress',
  },
  {
    label: 'School partners',
    detail: 'Recruiting partner schools across Chandigarh tricity',
    status: 'Open',
  },
  {
    label: 'Sponsors on board',
    detail: 'Title, T-shirt and associate partners',
    status: 'Open',
  },
  {
    label: 'Paid registration opens',
    detail: 'UPI and card payments with digital receipts',
    status: 'Upcoming',
  },
  { label: 'Race weekend', detail: EVENT.dateLabel, status: 'Upcoming' },
]

function RoadToRaceDay() {
  return (
    <section className="py-24 bg-background">
      <div className="mx-auto max-w-content px-4 sm:px-6">
        <p className="text-sm font-bold tracking-[0.25em] text-primary uppercase">
          Road to race day
        </p>
        <h2 className="font-display mt-3 text-5xl leading-[0.9] font-black uppercase sm:text-6xl text-foreground">
          Where we are now
        </h2>
        <ol className="mt-12 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {MILESTONES.map((m, i) => (
            <li
              key={m.label}
              className="relative rounded-2xl border border-border/80 bg-card p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
            >
              <span className="font-display text-5xl font-black text-primary/25">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-2 font-bold text-foreground">{m.label}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{m.detail}</p>
              <Badge
                variant="outline"
                className={cn(
                  'mt-4 font-semibold text-xs',
                  m.status === 'In progress' &&
                    'border-primary/30 bg-primary/10 text-primary',
                  m.status === 'Open' &&
                    'border-emerald-200 bg-emerald-50 text-emerald-700',
                  m.status === 'Upcoming' &&
                    'border-border bg-muted/60 text-muted-foreground',
                )}
              >
                {m.status}
              </Badge>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Faq() {
  return (
    <section
      id="faq"
      className="track-lines scroll-mt-16 border-t border-border/70 py-24"
    >
      <div className="mx-auto max-w-content px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <h2 className="font-display text-5xl leading-[0.9] font-black uppercase sm:text-6xl">
            Questions from parents
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((f) => (
              <AccordionItem key={f.q} value={f.q}>
                <AccordionTrigger className="text-left text-lg font-bold">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
