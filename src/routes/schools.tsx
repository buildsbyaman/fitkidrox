import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Check, Loader2, Users, X } from 'lucide-react'
import { toast } from 'sonner'

import { Field, fieldAria, PageHero } from '@/components/site/field'
import { PageShell } from '@/components/site/page-shell'
import { SuccessConfirmation } from '@/components/site/success-confirmation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EVENT } from '@/data/fixtures'
import {
  submitSchoolEntry,
  validateSchoolCoupon,
  createSchoolRazorpayOrder,
  verifySchoolRazorpayPayment,
  loadRazorpayCheckout,
  type CouponValidationResult,
  type RazorpayOrder,
  ApiError,
} from '@/data/api'
import { formatINR } from '@/lib/format'

const schoolsStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://www.fitkidrox.in/',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'School Entries',
      item: 'https://www.fitkidrox.in/schools',
    },
  ],
}

export const Route = createFileRoute('/schools')({
  head: () => ({
    meta: [
      {
        title: 'School Entries & Partnerships · FITKIDROX Chandigarh 2026',
      },
      {
        name: 'description',
        content:
          'Register your school team for FITKIDROX Chandigarh 2026. Inter-school youth fitness competition across Chandigarh, Mohali & Panchkula with dedicated school leaderboards and bulk entry.',
      },
      {
        property: 'og:title',
        content: 'School Entries & Partnerships · FITKIDROX Chandigarh 2026',
      },
      {
        property: 'og:description',
        content:
          'Empower your students with fitness, teamwork, and athletic confidence. Register school delegations for FITKIDROX 2026.',
      },
      { property: 'og:url', content: 'https://www.fitkidrox.in/schools' },
    ],
    links: [{ rel: 'canonical', href: 'https://www.fitkidrox.in/schools' }],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(schoolsStructuredData),
      },
    ],
  }),
  component: SchoolsPage,
})

interface SchoolForm {
  schoolName: string
  city: string
  coordinator: string
  phone: string
  email: string
  participants: string
}

function SchoolsPage() {
  const [school, setSchool] = useState<SchoolForm>({
    schoolName: '',
    city: 'Chandigarh',
    coordinator: '',
    phone: '',
    email: '',
    participants: '',
  })
  const [errors, setErrors] = useState<
    Partial<Record<keyof SchoolForm, string>>
  >({})
  const [submitting, setSubmitting] = useState(false)
  const [reference, setReference] = useState<string | null>(null)

  // Dynamic Coupon State (resolved & verified from backend only)
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] =
    useState<CouponValidationResult | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [finalPaidAmount, setFinalPaidAmount] = useState<number>(0)

  function setField(key: keyof SchoolForm, value: string) {
    setSchool((s) => ({ ...s, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const approxCount = Number.parseInt(school.participants, 10) || 0
  const grossTotal = approxCount * EVENT.entryFee

  // Recalculate discount based on backend validated coupon rules
  let discountAmount = 0
  if (appliedCoupon) {
    if (appliedCoupon.discountType === 'per_student_rate') {
      const targetTotal = approxCount * Math.max(0, appliedCoupon.discountValue)
      discountAmount = Math.max(0, grossTotal - targetTotal)
    } else if (appliedCoupon.discountType === 'percentage') {
      discountAmount = Math.round(
        (grossTotal * appliedCoupon.discountValue) / 100,
      )
    } else {
      discountAmount = Math.min(grossTotal, appliedCoupon.discountValue)
    }
  }
  const remainingAmount = Math.max(0, grossTotal - discountAmount)

  // Re-verify coupon dynamically if student count changes
  useEffect(() => {
    if (appliedCoupon && approxCount >= 1) {
      validateSchoolCoupon({
        code: appliedCoupon.code,
        participants: approxCount,
      })
        .then((res) => {
          setAppliedCoupon(res)
        })
        .catch(() => {
          setAppliedCoupon(null)
          setCouponError(
            'Coupon conditions no longer met with the updated student count.',
          )
        })
    }
  }, [approxCount])

  async function handleApplyCoupon() {
    const code = couponInput.trim()
    if (!code) return
    if (approxCount < 1) {
      setCouponError('Please enter the approximate number of students first.')
      return
    }

    setCouponLoading(true)
    setCouponError(null)

    try {
      const res = await validateSchoolCoupon({
        code,
        participants: approxCount,
      })
      setAppliedCoupon(res)
      toast.success(`Coupon ${res.code} applied!`, {
        description: `Discount of ${formatINR(res.discountAmount)} applied.`,
      })
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Invalid, expired, or inactive coupon code.'
      setCouponError(msg)
      toast.error(msg)
    } finally {
      setCouponLoading(false)
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null)
    setCouponInput('')
    setCouponError(null)
    toast.info('Coupon code removed.')
  }

  /**
   * Opens Razorpay Standard Checkout for the remaining amount
   */
  function openCheckout(
    order: RazorpayOrder,
    refCode: string,
    amountToPay: number,
  ) {
    let settled = false

    const rzp = new window.Razorpay({
      key: order.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      name: 'FITKIDROX',
      description: `School Delegation · ${school.schoolName} (~${approxCount} students)`,
      order_id: order.order_id,
      prefill: {
        name: school.coordinator,
        email: school.email,
        contact: school.phone,
      },
      theme: { color: '#f6641b' },
      handler: async (payment: {
        razorpay_payment_id: string
        razorpay_order_id: string
        razorpay_signature: string
      }) => {
        try {
          await verifySchoolRazorpayPayment({
            ...payment,
            reference: refCode,
          })
          settled = true
          setReference(refCode)
          setFinalPaidAmount(amountToPay)
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          toast.success('Registration & payment successful!', {
            description: `Reference: ${refCode}. Confirmation email sent to ${school.email}.`,
          })
        } catch {
          toast.error(
            'Payment verified, but recording failed. Please contact support.',
          )
        } finally {
          setSubmitting(false)
        }
      },
      modal: {
        ondismiss: () => {
          if (!settled) {
            toast.info(
              'Payment was cancelled. You can complete it whenever ready.',
            )
            setSubmitting(false)
          }
        },
      },
    })

    rzp.open()
  }

  async function submit() {
    const e: typeof errors = {}
    if (school.schoolName.trim().length < 3)
      e.schoolName = 'Enter the school name.'
    if (school.coordinator.trim().length < 2)
      e.coordinator = 'Enter the coordinator’s name.'
    if (!/^(\+91[\s-]?)?[6-9]\d{9}$/.test(school.phone.replace(/\s/g, '')))
      e.phone = 'Enter a valid 10-digit mobile number.'
    if (
      !/^[A-Za-z0-9_%+-]+(\.[A-Za-z0-9_%+-]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(
        school.email,
      )
    )
      e.email = 'Enter a valid email address.'
    if (!school.participants || approxCount < 1)
      e.participants =
        'Please provide an approximate number of students (minimum 1).'

    setErrors(e)
    if (Object.keys(e).length) return

    setSubmitting(true)

    try {
      // Step 1: Submit school registration with backend coupon verification
      const res = await submitSchoolEntry({
        schoolName: school.schoolName.trim(),
        city: school.city.trim(),
        coordinator: school.coordinator.trim(),
        phone: school.phone.trim(),
        email: school.email.trim(),
        participants: approxCount,
        couponCode: appliedCoupon?.code,
        roster: [],
      })

      const amountToPay =
        res.finalAmount !== undefined ? res.finalAmount : remainingAmount

      // If amount to pay is 0 (100% coupon discount/waived)
      if (!res.requiresPayment || amountToPay <= 0) {
        setReference(res.reference)
        setFinalPaidAmount(0)
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
        toast.success('School registration confirmed!', {
          description: `Reference: ${res.reference}. Confirmation email sent to ${school.email}.`,
        })
        setSubmitting(false)
        return
      }

      // Step 2: Load Razorpay Checkout modal
      await loadRazorpayCheckout()

      // Step 3: Create School Razorpay order for the remaining balance
      const order = await createSchoolRazorpayOrder(
        Math.round(amountToPay * 100),
        res.reference,
      )

      if (order.waived) {
        setReference(res.reference)
        setFinalPaidAmount(0)
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
        toast.success('Registration confirmed!', {
          description: `Reference: ${res.reference}`,
        })
        setSubmitting(false)
        return
      }

      // Step 4: Open Checkout
      openCheckout(order, res.reference, amountToPay)
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : 'Could not complete school registration. Please try again.',
      )
      setSubmitting(false)
    }
  }

  if (reference) {
    return (
      <SuccessConfirmation
        eyebrow="School Registration & Payment Confirmed"
        title={`${school.schoolName} is registered!`}
        description={
          <>
            Thank you! We have received and confirmed your school registration
            for approximately{' '}
            <strong className="text-foreground">{approxCount} students</strong>
            {finalPaidAmount > 0 ? (
              <>
                {' '}
                (Payment of{' '}
                <strong className="text-foreground">
                  {formatINR(finalPaidAmount)}
                </strong>{' '}
                confirmed via Razorpay)
              </>
            ) : appliedCoupon ? (
              <>
                {' '}
                (Registration fee waived with coupon{' '}
                <strong className="text-foreground">
                  {appliedCoupon.code}
                </strong>
                )
              </>
            ) : null}
            . A confirmation email has been dispatched to{' '}
            <strong className="text-foreground">{school.email}</strong>. Soon
            our official will contact{' '}
            <strong className="text-foreground">{school.coordinator}</strong>{' '}
            regarding the details of your registration, event heat slots, parent
            consent packets, and coordinator credentials.
          </>
        }
        reference={reference}
        referenceSubtext={`~${approxCount} students · City: ${school.city}${finalPaidAmount > 0 ? ` · Paid: ${formatINR(finalPaidAmount)}` : ''}`}
        recipientEmail={school.email}
        secondaryAction={{
          label: 'Submit another school',
          onClick: () => {
            setReference(null)
            setAppliedCoupon(null)
            setCouponInput('')
            setFinalPaidAmount(0)
            setSchool({
              schoolName: '',
              city: 'Chandigarh',
              coordinator: '',
              phone: '',
              email: '',
              participants: '',
            })
            window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
          },
        }}
      />
    )
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="School partnerships"
        title={
          <>
            Bring your <span className="text-primary">whole school</span>
          </>
        }
      >
        One coordinator, seamless bulk entry. Partner schools compete for the
        school-team trophy and get reserved slots at FITKIDROX.
      </PageHero>

      <div className="mx-auto grid max-w-content gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-8">
          <section
            className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm"
            aria-labelledby="school-details"
          >
            <div className="flex items-center gap-3">
              <div>
                <h2
                  id="school-details"
                  className="font-display text-3xl font-black uppercase text-foreground"
                >
                  School &amp; Delegation Details
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Provide your institution's info and estimated student
                  participation count.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <Field
                id="schoolName"
                label="School name"
                error={errors.schoolName}
                className="sm:col-span-2"
              >
                <Input
                  {...fieldAria('schoolName', errors.schoolName)}
                  value={school.schoolName}
                  onChange={(e) => setField('schoolName', e.target.value)}
                  placeholder="e.g. Doon Valley Senior Secondary School, Sector 22"
                />
              </Field>

              <Field id="city" label="City">
                <Select
                  value={school.city}
                  onValueChange={(v) => setField('city', v)}
                >
                  <SelectTrigger id="city" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      'Chandigarh',
                      'Mohali',
                      'Panchkula',
                      'Zirakpur',
                      'Other',
                    ].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                id="participants"
                label="Approximate number of students"
                error={errors.participants}
              >
                <Input
                  {...fieldAria('participants', errors.participants)}
                  type="number"
                  min="1"
                  max="10000"
                  value={school.participants}
                  onChange={(e) => setField('participants', e.target.value)}
                  placeholder="e.g. 50"
                />
              </Field>

              <Field
                id="coordinator"
                label="Sports coordinator / Lead teacher"
                error={errors.coordinator}
              >
                <Input
                  {...fieldAria('coordinator', errors.coordinator)}
                  value={school.coordinator}
                  onChange={(e) => setField('coordinator', e.target.value)}
                  placeholder="e.g. Ravi Sharma"
                />
              </Field>

              <Field id="phone" label="Mobile number" error={errors.phone}>
                <Input
                  {...fieldAria('phone', errors.phone)}
                  type="tel"
                  value={school.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="9876543210"
                />
              </Field>

              <Field
                id="email"
                label="Official email"
                error={errors.email}
                className="sm:col-span-2"
              >
                <Input
                  {...fieldAria('email', errors.email)}
                  type="email"
                  value={school.email}
                  onChange={(e) => setField('email', e.target.value)}
                  placeholder="coordinator@school.edu.in"
                />
              </Field>

              {/* Dynamic Coupon Code Section */}
              <div className="sm:col-span-2 rounded-xl border border-border/80 bg-muted/20 p-4">
                <label
                  htmlFor="couponCode"
                  className="block text-sm font-bold text-foreground"
                >
                  Coupon code
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Have an institutional partner code or promotional discount?
                  Enter it below.
                </p>
                <div className="mt-3 flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="couponCode"
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value.toUpperCase())
                        if (couponError) setCouponError(null)
                      }}
                      placeholder="Enter coupon code"
                      className="uppercase font-mono font-bold tracking-wider"
                      disabled={Boolean(appliedCoupon) || couponLoading}
                    />
                    {appliedCoupon && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                        <Check className="size-3" /> Applied
                      </span>
                    )}
                  </div>
                  {appliedCoupon ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRemoveCoupon}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <X className="size-4 mr-1" /> Remove
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleApplyCoupon}
                      disabled={
                        !couponInput.trim() || couponLoading || approxCount < 1
                      }
                      className="font-bold cursor-pointer"
                    >
                      {couponLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        'Apply'
                      )}
                    </Button>
                  )}
                </div>
                {couponError && (
                  <p className="mt-2 text-xs text-destructive font-medium">
                    {couponError}
                  </p>
                )}
                {appliedCoupon && (
                  <div className="mt-2.5 flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                    <span>
                      ✓{' '}
                      {appliedCoupon.description ||
                        `Coupon ${appliedCoupon.code}`}{' '}
                      ({appliedCoupon.discountType === 'per_student_rate'
                        ? `${formatINR(appliedCoupon.discountValue)} per student`
                        : appliedCoupon.discountType === 'percentage'
                        ? `${appliedCoupon.discountValue}% off`
                        : `${formatINR(appliedCoupon.discountValue)} discount`}
                      )
                    </span>
                    <span className="font-bold">
                      Saved {formatINR(discountAmount)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-border/80 bg-card p-6 shadow-sm lg:sticky lg:top-24">
          <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
            Delegation Summary
          </span>
          <div className="mt-4 flex items-baseline gap-2">
            <Users className="size-6 text-primary" />
            <p className="font-display text-5xl font-black text-foreground">
              {approxCount}
            </p>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            approx. students registered
          </p>

          <div className="mt-6 space-y-2.5 border-t border-border/70 pt-5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Standard fee</span>
              <span>{formatINR(grossTotal)}</span>
            </div>

            {appliedCoupon && (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>
                  Coupon ({appliedCoupon.code})
                  {appliedCoupon.discountType === 'per_student_rate' && (
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      {formatINR(appliedCoupon.discountValue)} / student
                    </span>
                  )}
                </span>
                <span>-{formatINR(discountAmount)}</span>
              </div>
            )}

            <div className="flex items-baseline justify-between pt-2 border-t border-border/50">
              <span className="font-bold text-foreground">Total to pay</span>
              <span className="font-display text-3xl font-black text-primary">
                {formatINR(remainingAmount)}
              </span>
            </div>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            {appliedCoupon?.discountType === 'per_student_rate'
              ? `Special delegation rate: ${formatINR(appliedCoupon.discountValue)} per student applied (Standard: ${formatINR(EVENT.entryFee)}).`
              : `${formatINR(EVENT.entryFee)} per student standard rate.`}
            {appliedCoupon
              ? ' Discount validated and applied.'
              : ''}
          </p>

          <Button
            size="lg"
            className="mt-6 w-full font-bold shadow-md shadow-primary/20 cursor-pointer"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" /> Processing…
              </>
            ) : remainingAmount > 0 ? (
              `Pay ${formatINR(remainingAmount)} & Register`
            ) : (
              'Complete Registration'
            )}
          </Button>
          <p className="mt-3 text-xs text-center text-muted-foreground">
            {remainingAmount > 0
              ? 'Secure payment via Razorpay. Official receipt emailed.'
              : 'Full discount applied. Confirmation email will be sent.'}
          </p>
        </aside>
      </div>
    </PageShell>
  )
}
