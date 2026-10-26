import * as React from 'react'
import { Link } from '@tanstack/react-router'
import {
  Calendar,
  CheckCircle2,
  Home,
  Mail,
  MapPin,
  RotateCcw,
} from 'lucide-react'
import { PageShell } from '@/components/site/page-shell'
import { Button } from '@/components/ui/button'
import { EVENT } from '@/data/fixtures'

export interface SuccessConfirmationProps {
  eyebrow?: string
  title: string
  description: React.ReactNode
  reference: string
  referenceSubtext?: React.ReactNode
  recipientEmail?: string
  bibNumber?: number | string
  heat?: number | string
  course?: string
  secondaryAction?: {
    label: string
    onClick: () => void
  }
}

export function SuccessConfirmation({
  eyebrow = 'Submission Confirmed',
  title,
  description,
  reference,
  referenceSubtext,
  recipientEmail,
  bibNumber,
  heat,
  course,
  secondaryAction,
}: SuccessConfirmationProps) {
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [])

  return (
    <PageShell>
      <section className="track-lines min-h-[calc(100vh-16rem)] py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          {/* Animated Celebration Icon */}
          <div className="relative mx-auto mb-6 flex size-20 items-center justify-center rounded-full border-2 border-primary/20 bg-primary/10 text-primary shadow-[0_0_40px_rgba(255,90,0,0.18)]">
            <CheckCircle2 className="size-10 stroke-[2.2]" />
          </div>

          {/* Eyebrow Badge */}
          {eyebrow && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-primary">
              <span>{eyebrow}</span>
            </div>
          )}

          {/* Main Title */}
          <h1 className="font-display mt-5 text-4xl font-black uppercase tracking-tight text-foreground sm:text-6xl sm:leading-[0.95]">
            {title}
          </h1>

          {/* Description */}
          <div className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg sm:leading-relaxed">
            {description}
          </div>

          {/* Athlete Bib Card (when bibNumber is assigned) or Reference Box */}
          {bibNumber ? (
            <div className="mx-auto mt-8 max-w-md rounded-2xl border-2 border-primary/40 bg-card p-6 shadow-md sm:px-8">
              <div className="flex items-center justify-between border-b border-border/80 pb-3">
                <span className="text-xs font-bold tracking-widest text-primary uppercase">
                  Athlete Participant ID
                </span>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                  Official Race Bib
                </span>
              </div>
              <div className="mt-4 flex flex-col items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                  Bib Number
                </span>
                <span className="font-display text-5xl font-black tracking-wider text-foreground sm:text-6xl select-all">
                  #{bibNumber}
                </span>
              </div>
              {(heat || course) && (
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/80 pt-3 text-center">
                  <div className="rounded-lg bg-muted/50 p-2">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Assigned Heat
                    </span>
                    <span className="text-sm font-black text-foreground">
                      Heat {heat}
                    </span>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Assigned Course
                    </span>
                    <span className="text-sm font-black text-primary">
                      {course}
                    </span>
                  </div>
                </div>
              )}
              {referenceSubtext && (
                <div className="mt-4 text-center text-xs text-muted-foreground border-t border-border/60 pt-2.5">
                  {referenceSubtext}
                </div>
              )}
            </div>
          ) : (
            <div className="mx-auto mt-8 max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-sm sm:px-8">
              <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                Official Reference Code
              </p>
              <div className="mt-2 flex items-center justify-center">
                <span className="font-display text-3xl font-black tracking-wider text-primary sm:text-4xl select-all">
                  {reference}
                </span>
              </div>
              {referenceSubtext && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
                  {referenceSubtext}
                </div>
              )}
            </div>
          )}

          {/* Key Details Cards Grid */}
          <div className="mx-auto mt-10 grid max-w-2xl gap-4 text-left sm:grid-cols-3">
            <div className="rounded-xl border border-border/80 bg-card/60 p-4 backdrop-blur-xs">
              <div className="flex items-center gap-2 text-primary">
                <Mail className="size-4 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Confirmation
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground break-all">
                {recipientEmail ? (
                  <>
                    Sent to{' '}
                    <strong className="text-foreground">{recipientEmail}</strong>
                  </>
                ) : (
                  'Details recorded & sent to your contact email'
                )}
              </p>
            </div>

            <div className="rounded-xl border border-border/80 bg-card/60 p-4 backdrop-blur-xs">
              <div className="flex items-center gap-2 text-primary">
                <Calendar className="size-4 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Event Dates
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                <strong className="text-foreground">{EVENT.dateLabel}</strong>
              </p>
            </div>

            <div className="rounded-xl border border-border/80 bg-card/60 p-4 backdrop-blur-xs">
              <div className="flex items-center gap-2 text-primary">
                <MapPin className="size-4 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Venue
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {EVENT.venue}, {EVENT.city}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {secondaryAction && (
              <Button
                variant="outline"
                size="lg"
                onClick={secondaryAction.onClick}
                className="gap-2 cursor-pointer"
              >
                <RotateCcw className="size-4" />
                {secondaryAction.label}
              </Button>
            )}
            <Button size="lg" asChild className="gap-2 cursor-pointer">
              <Link to="/">
                <Home className="size-4" />
                Back to home
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
