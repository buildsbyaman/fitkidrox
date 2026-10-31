import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trophy,
} from 'lucide-react'
import { toast } from 'sonner'

import { GoogleIcon } from '@/components/site/google-icon'
import { GoogleSignInButton } from '@/components/site/google-sign-in-button'
import { PageHero } from '@/components/site/field'
import { PageShell } from '@/components/site/page-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  createRazorpayOrder,
  getMyRegistrations,
  loadRazorpayCheckout,
  verifyRazorpayPayment,
  ApiError,
  type ParticipantRecord,
  type RazorpayOrder,
} from '@/data/api'
import { EVENT, ageOnEventDay } from '@/data/fixtures'
import { useAuth } from '@/lib/auth-context'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/dashboard')({
  head: () => ({
    meta: [
      {
        title: 'Parent Dashboard · My Registrations · FITKIDROX Chandigarh 2026',
      },
      {
        name: 'robots',
        content: 'noindex, nofollow, noarchive',
      },
    ],
  }),
  component: DashboardPage,
})

const BRAND_COLOR = '#f6641b'

function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const [registrations, setRegistrations] = useState<ParticipantRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [payingRef, setPayingRef] = useState<string | null>(null)
  const [selectedPass, setSelectedPass] = useState<ParticipantRecord | null>(null)

  const fetchRegistrations = useCallback(async () => {
    setRefreshing(true)
    try {
      const data = await getMyRegistrations()
      setRegistrations(data)
    } catch {
      toast.error('Could not refresh registrations. Please try again.')
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      return
    }
    let active = true
    getMyRegistrations()
      .then((data) => {
        if (active) {
          setRegistrations(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) {
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [user])

  /** Allows a parent to complete a pending/failed payment directly from dashboard */
  async function handlePayNow(record: ParticipantRecord) {
    setPayingRef(record.reference)

    try {
      await loadRazorpayCheckout()
    } catch {
      toast.error('The payment window could not be loaded. Please try again.')
      setPayingRef(null)
      return
    }

    let order: RazorpayOrder
    try {
      order = await createRazorpayOrder(EVENT.entryFee * 100, record.reference)
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : 'Could not initialize payment order.',
      )
      setPayingRef(null)
      return
    }

    const rzp = new window.Razorpay({
      key: order.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      name: 'FITKIDROX',
      description: `Entry fee · ${record.childName} · ${record.category}`,
      order_id: order.order_id,
      prefill: {
        name: record.guardianName,
        email: user?.email || record.guardianEmail,
        contact: record.guardianPhone,
      },
      theme: { color: BRAND_COLOR },
      handler: async (payment) => {
        try {
          const verified = await verifyRazorpayPayment({
            ...payment,
            reference: record.reference,
          })
          toast.success('Payment verified successfully!', {
            description: verified.bibNumber
              ? `Assigned Bib #${verified.bibNumber}`
              : 'Spot confirmed!',
          })
          await fetchRegistrations()
        } catch {
          toast.error(
            'Payment verification failed. Please contact support if money was debited.',
          )
        } finally {
          setPayingRef(null)
        }
      },
      modal: {
        ondismiss: () => {
          setPayingRef(null)
        },
      },
    })

    rzp.open()
  }

  // 1. Auth loading state
  if (authLoading) {
    return (
      <PageShell>
        <PageHero
          eyebrow="Parent Portal"
          title="Parent Dashboard"
        >
          Loading your account...
        </PageHero>
        <div className="mx-auto flex max-w-content items-center justify-center py-28">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span className="text-sm font-semibold">Verifying your session...</span>
          </div>
        </div>
      </PageShell>
    )
  }

  // 2. Unauthenticated state — prompt Google login
  if (!user) {
    return (
      <PageShell>
        <PageHero
          eyebrow="Parent Portal"
          title="Parent Dashboard"
        >
          Sign in to view your registered young athletes, allotted race bib numbers,
          and official entry passes.
        </PageHero>

        <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
          <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-6 shadow-sm sm:p-10">
            <div className="pointer-events-none absolute -top-24 -right-24 size-48 rounded-full bg-primary/10 blur-2xl" />

            <div className="flex flex-col items-center text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-muted/40 shadow-xs">
                <GoogleIcon className="size-7" />
              </div>

              <h2 className="font-display mt-5 text-3xl font-black uppercase tracking-tight text-foreground sm:text-4xl">
                Sign in to view registrations
              </h2>

              <p className="mt-2 text-sm text-muted-foreground sm:text-base max-w-md">
                Please sign in with the Google account you used to register your child.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center">
                <GoogleSignInButton text="continue_with" />
              </div>

              <div className="mt-10 border-t border-border/60 pt-6 text-center text-xs text-muted-foreground">
                Need to register for the first time?{' '}
                <Link to="/register" className="font-bold text-primary hover:underline">
                  Register your child &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </PageShell>
    )
  }

  const paidCount = registrations.filter((r) => r.payment?.status === 'paid').length
  const bibCount = registrations.filter((r) => Boolean(r.bibNumber)).length

  return (
    <PageShell>
      <PageHero
        eyebrow={`Parent Portal · ${user.name}`}
        title="My Registrations"
      >
        Track your child’s race entry, check allocated race bib numbers, and access official
        entry passes for FITKIDROX Chandigarh 2026.
      </PageHero>

      <main className="mx-auto max-w-content px-4 py-10 sm:px-6 sm:py-12">
        {/* Top Control Bar: User identity, Refresh & Add child action */}
        <div className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="size-10 rounded-full object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="truncate text-sm font-bold text-foreground">
                {user.name}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email} · Google Verified
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchRegistrations()}
              disabled={refreshing}
              className="gap-2 font-bold text-xs"
            >
              <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
              <span>{refreshing ? 'Updating...' : 'Refresh'}</span>
            </Button>

            <Button
              asChild
              size="sm"
              className="gap-2 font-bold text-xs shadow-xs"
            >
              <Link to="/register">
                <Plus className="size-4" />
                <span>Register Another Child</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs">
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              Registered Children
            </span>
            <p className="font-display mt-1 text-3xl font-black text-foreground sm:text-4xl">
              {registrations.length}
            </p>
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs">
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              Confirmed Entries
            </span>
            <p className="font-display mt-1 text-3xl font-black text-emerald-600 dark:text-emerald-400 sm:text-4xl">
              {paidCount}
            </p>
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs">
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              Allotted Bibs
            </span>
            <p className="font-display mt-1 text-3xl font-black text-primary sm:text-4xl">
              {bibCount}
            </p>
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs">
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              Race Dates
            </span>
            <p className="mt-2 text-xs font-bold text-foreground">
              {EVENT.dateLabel}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {EVENT.venue}
            </p>
          </div>
        </div>

        {/* Content Section: Loading | Empty | Registration Cards */}
        {loading ? (
          <div className="mt-12 flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="size-7 animate-spin text-primary" />
            <p className="mt-3 text-sm font-semibold">Loading your registrations...</p>
          </div>
        ) : registrations.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border/80 bg-card/60 p-8 text-center sm:p-14">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Trophy className="size-8 stroke-[1.8]" />
            </div>
            <h3 className="font-display mt-4 text-2xl font-black uppercase tracking-tight text-foreground sm:text-3xl">
              No registrations found
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              You haven't registered any children under <strong className="text-foreground">{user.email}</strong> yet.
              Register your young athlete today to confirm their place and reserve their official race kit!
            </p>
            <Button asChild size="lg" className="mt-6 font-bold shadow-md shadow-primary/20">
              <Link to="/register">
                Register Your Child Now <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-6">
            {registrations.map((record) => {
              const isPaid = record.payment?.status === 'paid'
              const calculatedAge = record.dob ? ageOnEventDay(record.dob) : null

              return (
                <div
                  key={record._id}
                  className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-6 shadow-sm transition hover:border-foreground/20 sm:p-7"
                >
                  {/* Top Bar: Athlete name, Category badge & Payment status badge */}
                  <div className="flex flex-col gap-3 border-b border-border/70 pb-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="font-display text-2xl font-black uppercase tracking-wide text-foreground sm:text-3xl">
                          {record.childName}
                        </h2>
                        <Badge
                          variant="outline"
                          className="border-primary/40 bg-primary/5 text-primary font-bold text-xs"
                        >
                          {record.category || 'Athlete'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Registration Ref: <strong className="font-mono text-foreground">{record.reference}</strong>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {isPaid ? (
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-3.5" />
                          <span>Confirmed · {formatINR(record.payment?.amount ?? EVENT.entryFee)} Paid</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                          <Clock className="size-3.5" />
                          <span>Payment Pending · {formatINR(EVENT.entryFee)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle Section: Bib Allotment Spotlight (or pending payment action) */}
                  <div className="my-5 rounded-xl border border-border/60 bg-muted/20 p-4 sm:p-5">
                    {isPaid && record.bibNumber ? (
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-primary/40 bg-card px-4 py-2 text-center shadow-xs">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                              Bib Number
                            </span>
                            <span className="font-display text-3xl font-black tracking-wider text-foreground sm:text-4xl">
                              #{record.bibNumber}
                            </span>
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              {record.heat && (
                                <span className="inline-flex items-center rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs font-bold text-sky-700 dark:text-sky-300">
                                  Heat {record.heat}
                                </span>
                              )}
                              {record.course && (
                                <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                  {record.course}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                • {record.checkedIn ? 'Checked-in on Race Day' : 'Ready for athlete check-in'}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Present your Bib Number at athlete desk at Sector 10D Skating Rink, Chandigarh.
                            </p>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPass(record)}
                          className="shrink-0 gap-1.5 font-bold text-xs"
                        >
                          <FileText className="size-3.5" />
                          <span>View Race Pass</span>
                        </Button>
                      </div>
                    ) : isPaid ? (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <ShieldCheck className="size-5 shrink-0 text-primary" />
                        <div>
                          <p className="font-bold text-foreground">Entry fee confirmed & kit reserved</p>
                          <p>Your official Bib Number and Heat assignment will be allotted shortly before race day.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                          <AlertCircle className="size-5 shrink-0 text-amber-500" />
                          <div>
                            <p className="font-bold text-foreground">Complete payment to finalize spot</p>
                            <p>Registration is saved, but Bib Numbers are only allotted once entry fee is settled.</p>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          disabled={payingRef === record.reference}
                          onClick={() => handlePayNow(record)}
                          className="gap-2 font-bold shadow-xs shrink-0"
                        >
                          {payingRef === record.reference ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              <span>Opening payment...</span>
                            </>
                          ) : (
                            <>
                              <CreditCard className="size-3.5" />
                              <span>Pay {formatINR(EVENT.entryFee)}</span>
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Athlete Details Grid */}
                  <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 md:grid-cols-4 text-xs">
                    <div>
                      <span className="font-bold text-muted-foreground uppercase tracking-wider block text-[10px]">
                        Date of Birth / Age
                      </span>
                      <span className="mt-0.5 font-semibold text-foreground">
                        {record.dob} {calculatedAge !== null ? `(${calculatedAge} yrs)` : ''} · {record.gender}
                      </span>
                    </div>

                    <div>
                      <span className="font-bold text-muted-foreground uppercase tracking-wider block text-[10px]">
                        T-Shirt Size
                      </span>
                      <span className="mt-0.5 font-semibold text-foreground">
                        {record.tshirt || '—'}
                      </span>
                    </div>

                    <div>
                      <span className="font-bold text-muted-foreground uppercase tracking-wider block text-[10px]">
                        School / Team
                      </span>
                      <span className="mt-0.5 font-semibold text-foreground truncate block">
                        {record.school || 'Individual Entry'}
                      </span>
                    </div>

                    <div>
                      <span className="font-bold text-muted-foreground uppercase tracking-wider block text-[10px]">
                        Registered Guardian
                      </span>
                      <span className="mt-0.5 font-semibold text-foreground truncate block">
                        {record.guardianName} ({record.relation || 'Parent'})
                      </span>
                    </div>
                  </div>

                  {record.medicalNotes && (
                    <div className="mt-3 rounded-md bg-muted/40 p-2.5 text-xs text-muted-foreground">
                      <strong className="text-foreground">Medical Notes:</strong> {record.medicalNotes}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        
      </main>

      {/* Race Pass Modal Dialog */}
      <Dialog open={Boolean(selectedPass)} onOpenChange={(open) => !open && setSelectedPass(null)}>
        <DialogContent className="max-w-md p-6 text-foreground sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <span className="text-xs font-bold tracking-widest text-primary uppercase">
                Official Athlete Race Pass
              </span>
              <span className="text-xs font-bold text-muted-foreground">
                FITKIDROX 2026
              </span>
            </div>
            <DialogTitle className="font-display mt-2 text-3xl font-black uppercase tracking-tight text-foreground">
              {selectedPass?.childName}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Official Entry Pass · {selectedPass?.category}
            </DialogDescription>
          </DialogHeader>

          {selectedPass && (
            <div className="space-y-4 py-2">
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-primary/40 bg-muted/30 p-5 text-center">
                <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  Athlete Race Bib
                </span>
                <span className="font-display text-5xl font-black text-foreground select-all sm:text-6xl">
                  #{selectedPass.bibNumber}
                </span>

                <div className="mt-3 flex items-center justify-center gap-3">
                  {selectedPass.heat && (
                    <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-700 dark:text-sky-300">
                      Heat {selectedPass.heat}
                    </span>
                  )}
                  {selectedPass.course && (
                    <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      {selectedPass.course}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-muted/40 p-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Venue
                  </span>
                  <span className="font-semibold text-foreground">
                    Sector 10D Skating Rink, Chandigarh
                  </span>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Dates
                  </span>
                  <span className="font-semibold text-foreground">
                    28–29 November 2026
                  </span>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Parent / Guardian
                  </span>
                  <span className="font-semibold text-foreground">
                    {selectedPass.guardianName} ({selectedPass.guardianPhone})
                  </span>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Registration Ref
                  </span>
                  <span className="font-semibold font-mono text-foreground">
                    {selectedPass.reference}
                  </span>
                </div>
              </div>

              <p className="text-center text-[11px] text-muted-foreground">
                Please present this screen or your Bib Number at the athlete check-in desk.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
