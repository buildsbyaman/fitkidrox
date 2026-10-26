import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Field, fieldAria, PageHero } from '@/components/site/field'
import { PageShell } from '@/components/site/page-shell'
import { SuccessConfirmation } from '@/components/site/success-confirmation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  EVENT,
  TSHIRT_SIZES,
  ageOnEventDay,
  categoryForAge,
} from '@/data/fixtures'
import {
  createRazorpayOrder,
  loadRazorpayCheckout,
  submitParticipantRegistration,
  verifyRazorpayPayment,
  ApiError,
  type RazorpayOrder,
} from '@/data/api'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'

const registerStructuredData = {
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
      name: 'Register Child',
      item: 'https://www.fitkidrox.in/register',
    },
  ],
}

export const Route = createFileRoute('/register')({
  head: () => ({
    meta: [
      {
        title:
          'Register Your Child · FITKIDROX Chandigarh 2026 Kids Fitness Race',
      },
      {
        name: 'description',
        content:
          'Pre-register your young athlete for FITKIDROX Chandigarh 2026. Ages 3 to 13+. Entry fee includes official event T-shirt, race bib, finisher medal, and digital certificate.',
      },
      {
        property: 'og:title',
        content:
          'Register Your Child · FITKIDROX Chandigarh 2026 Kids Fitness Race',
      },
      {
        property: 'og:description',
        content:
          'Secure your child’s spot in India’s premier youth fitness event on 28–29 November 2026 at Sector 10D Skating Rink, Chandigarh.',
      },
      { property: 'og:url', content: 'https://www.fitkidrox.in/register' },
    ],
    links: [{ rel: 'canonical', href: 'https://www.fitkidrox.in/register' }],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(registerStructuredData),
      },
    ],
  }),
  component: RegisterPage,
})

const STEPS = ['Participant', 'Parent & consent', 'Review', 'Payment'] as const

/** Matches --primary in styles.css — Razorpay wants a plain hex. */
const BRAND_COLOR = '#f6641b'

interface FormState {
  childName: string
  dob: string
  gender: string
  tshirt: string
  school: string
  guardianName: string
  guardianPhone: string
  guardianEmail: string
  relation: string
  medicalNotes: string
  consentParticipation: boolean
  consentMedical: boolean
  consentPhotos: boolean
}

const EMPTY: FormState = {
  childName: '',
  dob: '',
  gender: '',
  tshirt: '',
  school: '',
  guardianName: '',
  guardianPhone: '',
  guardianEmail: '',
  relation: 'Parent',
  medicalNotes: '',
  consentParticipation: false,
  consentMedical: false,
  consentPhotos: false,
}

type Errors = Partial<Record<keyof FormState, string>>

function validate(step: number, f: FormState): Errors {
  const e: Errors = {}
  if (step === 0) {
    if (f.childName.trim().length < 2)
      e.childName = 'Enter the child’s full name.'
    const age = f.dob ? ageOnEventDay(f.dob) : null
    if (age === null) e.dob = 'Enter a date of birth.'
    else if (age < 3)
      e.dob =
        'Participants must be at least 3 years old on event day (born on or before 28 Nov 2023).'
    else if (age > 18) e.dob = 'FITKIDROX is for participants up to 18 years.'
    if (!f.gender) e.gender = 'Choose one.'
    if (!f.tshirt) e.tshirt = 'Choose a T-shirt size.'
  }
  if (step === 1) {
    if (f.guardianName.trim().length < 2)
      e.guardianName = 'Enter your full name.'
    if (!/^(\+91[\s-]?)?[6-9]\d{9}$/.test(f.guardianPhone.replace(/\s/g, '')))
      e.guardianPhone = 'Enter a 10-digit Indian mobile number.'
    if (!/^[A-Za-z0-9_%+-]+(\.[A-Za-z0-9_%+-]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(f.guardianEmail))
      e.guardianEmail = 'Enter a valid email.'
    if (!f.consentParticipation)
      e.consentParticipation = 'Consent is required to take part.'
    if (!f.consentMedical)
      e.consentMedical = 'Please confirm the medical declaration.'
  }
  return e
}

function RegisterPage() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)
  const [reference, setReference] = useState<string | null>(null)
  const [bibInfo, setBibInfo] = useState<{
    bibNumber?: number
    heat?: number
    course?: 'Course A' | 'Course B'
  } | null>(null)
  // Set once the participant exists so a cancelled payment doesn't create a
  // duplicate record on retry — the retry pays against the same reference.
  const [createdReference, setCreatedReference] = useState<string | null>(null)

  const age = form.dob ? ageOnEventDay(form.dob) : null
  const category = age !== null ? categoryForAge(age) : null

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    if (key === 'dob' && typeof value === 'string' && value) {
      const calculatedAge = ageOnEventDay(value)
      if (calculatedAge !== null && calculatedAge < 3) {
        setErrors((e) => ({
          ...e,
          dob: 'Participants must be at least 3 years old on event day (born on or before 28 Nov 2023).',
        }))
        return
      }
      if (calculatedAge !== null && calculatedAge > 18) {
        setErrors((e) => ({
          ...e,
          dob: 'FITKIDROX is for participants up to 18 years old.',
        }))
        return
      }
    }
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function next() {
    const e = validate(step, form)
    setErrors(e)
    if (Object.keys(e).length === 0) {
      setStep((s) => s + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  /**
   * Step 4: save the participant (once), create the Razorpay order, then
   * open the checkout modal. `submitting` stays true while the modal is
   * open so a second click can't create a duplicate registration.
   */
  async function pay() {
    setSubmitting(true)

    let reference = createdReference
    if (!reference) {
      try {
        const res = await submitParticipantRegistration({
          ...form,
          category: category?.name ?? '',
        })
        reference = res.reference
        setCreatedReference(res.reference)
      } catch (err) {
        toast.error(
          err instanceof ApiError
            ? err.message
            : 'We couldn’t save your registration. Please try again.',
        )
        setSubmitting(false)
        return
      }
    }

    try {
      await loadRazorpayCheckout()
    } catch {
      toast.error(
        'The payment window could not be loaded. Check your connection and try again.',
      )
      setSubmitting(false)
      return
    }

    let order: RazorpayOrder
    try {
      order = await createRazorpayOrder(EVENT.entryFee * 100, reference)
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : 'We couldn’t start the payment. Please try again.',
      )
      setSubmitting(false)
      return
    }

    openCheckout(order, reference)
  }

  /** Opens Razorpay Standard Checkout and resolves the flow when it settles. */
  function openCheckout(order: RazorpayOrder, reference: string) {
    let settled = false
    let failed = false

    const settle = () => {
      if (!settled) {
        settled = true
        setSubmitting(false)
      }
    }

    const rzp = new window.Razorpay({
      key: order.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      name: 'FITKIDROX',
      description: `Entry fee · ${form.childName} · ${category?.name ?? ''}`,
      order_id: order.order_id,
      prefill: {
        name: form.guardianName,
        email: form.guardianEmail,
        contact: form.guardianPhone,
      },
      theme: { color: BRAND_COLOR },
      handler: async (payment) => {
        try {
          const verified = await verifyRazorpayPayment({
            ...payment,
            reference,
          })
          if (verified.bibNumber) {
            setBibInfo({
              bibNumber: verified.bibNumber,
              heat: verified.heat,
              course: verified.course,
            })
          }
          setReference(reference)
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          toast.success('Payment successful', {
            description: `${formatINR(EVENT.entryFee)} paid · ${
              verified.bibNumber ? `Assigned Bib #${verified.bibNumber}` : 'Registration confirmed'
            }`,
          })
        } catch {
          toast.error(
            `Your payment could not be verified, so the place is not confirmed. Please contact ${EVENT.email} for assistance.`,
          )
        } finally {
          settle()
        }
      },
      modal: {
        ondismiss: () => {
          if (!settled && !failed) {
            toast.warning(
              'Payment cancelled. Your details are saved — press Complete payment to try again.',
            )
          }
          settle()
        },
      },
    })

    rzp.on('payment.failed', (failure) => {
      failed = true
      toast.error(
        failure.error?.description
          ? `Payment failed — ${failure.error.description}`
          : 'Payment failed. Please try again with another method.',
      )
      settle()
    })

    rzp.open()
  }

  if (reference) {
    const childFirst = form.childName.trim()
      ? form.childName.trim().split(' ')[0]
      : 'Athlete'
    return (
      <SuccessConfirmation
        eyebrow="Registration Confirmed"
        title={`Registration confirmed, ${childFirst}!`}
        description={
          <>
            {form.childName.trim() ? `${childFirst}’s` : 'Your child’s'} spot in{' '}
            <strong className="text-foreground">{category?.name}</strong> is
            officially confirmed! We have sent a confirmation email to{' '}
            <strong className="text-foreground">{form.guardianEmail}</strong>.
            Please present your Bib Number at the athlete check-in desk on
            race day.
          </>
        }
        reference={reference}
        bibNumber={bibInfo?.bibNumber}
        heat={bibInfo?.heat}
        course={bibInfo?.course}
        referenceSubtext={`${formatINR(EVENT.entryFee)} paid · Finisher kit reserved`}
        recipientEmail={form.guardianEmail}
        secondaryAction={{
          label: 'Add a sibling / child',
          onClick: () => {
            setForm({
              ...EMPTY,
              guardianName: form.guardianName,
              guardianPhone: form.guardianPhone,
              guardianEmail: form.guardianEmail,
              relation: form.relation,
            })
            setReference(null)
            setCreatedReference(null)
            setBibInfo(null)
            setStep(0)
            window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
          },
        }}
      />
    )
  }

  return (
    <PageShell>
      <PageHero eyebrow={EVENT.dateLabel} title="Register your child">
        Registration is open for 28–29 November 2026. Fill in the details, pay
        the {formatINR(EVENT.entryFee)} entry fee and your child’s place is
        confirmed.
      </PageHero>

      <div className="mx-auto grid max-w-content gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_20rem]">
        <div>
          <Stepper step={step} />

          <div className="mt-8 rounded-2xl border border-border/80 bg-card p-6 shadow-sm sm:p-8">
            {step === 0 && (
              <div className="grid gap-6 sm:grid-cols-2">
                <Field
                  id="childName"
                  label="Child’s full name"
                  error={errors.childName}
                  className="sm:col-span-2"
                >
                  <Input
                    {...fieldAria('childName', errors.childName)}
                    value={form.childName}
                    onChange={(e) => set('childName', e.target.value)}
                    autoComplete="off"
                    placeholder="e.g. Ananya Sharma"
                  />
                </Field>
                <Field
                  id="dob"
                  label="Date of birth"
                  error={errors.dob}
                  hint="We use age on 28 Nov 2026 to place your child."
                >
                  <Input
                    {...fieldAria('dob', errors.dob, true)}
                    type="date"
                    value={form.dob}
                    onChange={(e) => set('dob', e.target.value)}
                    max="2023-11-28"
                  />
                </Field>
                <Field
                  id="category"
                  label="Category"
                  hint="Auto-selected based on age on event day."
                >
                  <div
                    id="category"
                    className={cn(
                      'flex h-9 items-center rounded-md border border-input px-3 text-sm transition-colors',
                      age !== null && age < 3
                        ? 'border-destructive/40 bg-destructive/5 text-destructive font-medium'
                        : category
                          ? 'bg-muted/30 text-foreground font-medium'
                          : 'bg-muted/30 text-muted-foreground',
                    )}
                    aria-live="polite"
                  >
                    {age !== null && age < 3
                      ? 'Not eligible · Minimum age is 3 years'
                      : category
                        ? `${category.name} · ${category.ages}`
                        : 'Auto-selected from date of birth'}
                  </div>
                </Field>
                <Field id="gender" label="Gender" error={errors.gender}>
                  <RadioGroup
                    id="gender"
                    value={form.gender}
                    onValueChange={(v) => set('gender', v)}
                    className="flex h-9 items-center gap-6"
                    aria-invalid={errors.gender ? true : undefined}
                  >
                    {['Girl', 'Boy', 'Other'].map((g) => (
                      <label
                        key={g}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <RadioGroupItem value={g} /> {g}
                      </label>
                    ))}
                  </RadioGroup>
                </Field>
                <Field id="tshirt" label="T-shirt size" error={errors.tshirt}>
                  <Select
                    value={form.tshirt}
                    onValueChange={(v) => set('tshirt', v)}
                  >
                    <SelectTrigger
                      {...fieldAria('tshirt', errors.tshirt)}
                      className="w-full"
                    >
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {TSHIRT_SIZES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  id="school"
                  label="School (optional)"
                  hint="Helps us count towards your school’s team ranking."
                  className="sm:col-span-2"
                >
                  <Input
                    {...fieldAria('school', undefined, true)}
                    value={form.school}
                    onChange={(e) => set('school', e.target.value)}
                    placeholder="e.g. Shivalik Public School, Sector 41"
                  />
                </Field>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-6 sm:grid-cols-2">
                <Field
                  id="guardianName"
                  label="Parent / guardian name"
                  error={errors.guardianName}
                >
                  <Input
                    {...fieldAria('guardianName', errors.guardianName)}
                    value={form.guardianName}
                    onChange={(e) => set('guardianName', e.target.value)}
                    autoComplete="name"
                  />
                </Field>
                <Field id="relation" label="Relationship">
                  <Select
                    value={form.relation}
                    onValueChange={(v) => set('relation', v)}
                  >
                    <SelectTrigger id="relation" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['Parent', 'Legal guardian', 'Grandparent'].map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  id="guardianPhone"
                  label="Mobile number"
                  error={errors.guardianPhone}
                >
                  <Input
                    {...fieldAria('guardianPhone', errors.guardianPhone)}
                    type="tel"
                    inputMode="tel"
                    value={form.guardianPhone}
                    onChange={(e) => set('guardianPhone', e.target.value)}
                    autoComplete="tel"
                    placeholder="98XXXXXXXX"
                  />
                </Field>
                <Field
                  id="guardianEmail"
                  label="Email"
                  error={errors.guardianEmail}
                >
                  <Input
                    {...fieldAria('guardianEmail', errors.guardianEmail)}
                    type="email"
                    value={form.guardianEmail}
                    onChange={(e) => set('guardianEmail', e.target.value)}
                    autoComplete="email"
                  />
                </Field>
                <Field
                  id="medicalNotes"
                  label="Medical conditions or allergies (optional)"
                  className="sm:col-span-2"
                >
                  <Textarea
                    id="medicalNotes"
                    value={form.medicalNotes}
                    onChange={(e) => set('medicalNotes', e.target.value)}
                    placeholder="Asthma, allergies, recent injuries — anything our first-aid team should know."
                  />
                </Field>

                <fieldset className="grid gap-4 rounded-xl bg-muted p-5 sm:col-span-2">
                  <legend className="sr-only">Consent</legend>
                  <ConsentBox
                    id="consentParticipation"
                    checked={form.consentParticipation}
                    onChange={(v) => set('consentParticipation', v)}
                    error={errors.consentParticipation}
                  >
                    I give consent for my child to take part in FITKIDROX
                    activities under the supervision of event staff, following
                    the age-appropriate rules for their category.
                  </ConsentBox>
                  <ConsentBox
                    id="consentMedical"
                    checked={form.consentMedical}
                    onChange={(v) => set('consentMedical', v)}
                    error={errors.consentMedical}
                  >
                    My child is fit to participate, and I have shared any
                    medical conditions above. I agree to on-site first aid if
                    needed.
                  </ConsentBox>
                  <ConsentBox
                    id="consentPhotos"
                    checked={form.consentPhotos}
                    onChange={(v) => set('consentPhotos', v)}
                  >
                    Optional: FITKIDROX may use event photos of my child in
                    official results and galleries.
                  </ConsentBox>
                </fieldset>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-6">
                <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  <Summary label="Participant" value={form.childName} />
                  <Summary
                    label="Category"
                    value={`${category?.name} (${age} yrs on event day)`}
                  />
                  <Summary label="T-shirt" value={form.tshirt} />
                  <Summary label="School" value={form.school || '—'} />
                  <Summary label={form.relation} value={form.guardianName} />
                  <Summary
                    label="Contact"
                    value={`${form.guardianPhone} · ${form.guardianEmail}`}
                  />
                  <Summary
                    label="Photo consent"
                    value={form.consentPhotos ? 'Yes' : 'No'}
                  />
                  <Summary
                    label="Medical notes"
                    value={form.medicalNotes || 'None'}
                  />
                </dl>
                <Alert className="border-primary/40 bg-primary/5">
                  <AlertTitle className="font-bold">
                    Check the details before you pay
                  </AlertTitle>
                  <AlertDescription>
                    Nothing is charged yet. On the next step you’ll pay the{' '}
                    {formatINR(EVENT.entryFee)} entry fee by UPI or card, and
                    your child’s place is confirmed the moment it succeeds.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-6">
                <div className="rounded-xl border border-border/80 bg-muted/60 p-6">
                  <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                    Amount due
                  </p>
                  <p className="font-display mt-1 text-5xl font-black text-foreground">
                    {formatINR(EVENT.entryFee)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Entry for {form.childName} · {category?.name ?? 'FITKIDROX'}{' '}
                    · {EVENT.dateLabel}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
                    <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <CreditCard className="size-4 text-primary" /> UPI or card
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Pay securely — your place is confirmed instantly.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-card p-4">
                    <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <Check className="size-4 text-primary" /> What’s included
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      T-shirt, race bib, finisher medal and digital certificate.
                    </p>
                  </div>
                </div>

                <Alert>
                  <AlertTitle className="font-bold">
                    One confirmation email
                  </AlertTitle>
                  <AlertDescription>
                    A receipt and your assigned Bib Number are emailed to{' '}
                    {form.guardianEmail} as soon as the payment completes.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between gap-3 border-t pt-6">
              {step > 0 ? (
                <Button
                  variant="ghost"
                  // Once the server has a record, editing the form would leave
                  // the payment crediting a stale copy — freeze navigation.
                  onClick={() => setStep((s) => s - 1)}
                  disabled={submitting || createdReference !== null}
                >
                  <ArrowLeft /> Back
                </Button>
              ) : (
                <span />
              )}
              {step < 3 ? (
                <Button onClick={next} size="lg" className="font-bold">
                  {step === 2 ? 'Continue to payment' : 'Continue'}{' '}
                  <ArrowRight />
                </Button>
              ) : (
                <Button
                  onClick={pay}
                  size="lg"
                  className="font-bold"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" /> Processing payment…
                    </>
                  ) : (
                    <>
                      <CreditCard /> Complete payment{' '}
                      {formatINR(EVENT.entryFee)}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-border/80 bg-card p-6 shadow-sm lg:sticky lg:top-24">
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
            Your entry
          </p>
          <p className="font-display mt-2 text-3xl font-black uppercase text-foreground">
            {age !== null && age < 3
              ? 'Not eligible'
              : (category?.name ?? 'Choose a date of birth')}
          </p>
          {age !== null && age < 3 ? (
            <p className="mt-1 text-sm text-destructive font-medium">
              Must be at least 3 years on race day
            </p>
          ) : category ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {category.format}
            </p>
          ) : null}
          <ul className="mt-6 space-y-2.5 border-t border-border/70 pt-5 text-sm text-foreground/85">
            {[
              'Event T-shirt & race bib',
              'Finisher medal',
              'Digital certificate',
              'Supervised course & first aid',
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <div className="flex size-4 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="size-3 text-primary stroke-[3]" />
                </div>
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-baseline justify-between border-t border-border/70 pt-5">
            <span className="text-sm text-muted-foreground">Entry fee</span>
            <span className="font-display text-3xl font-black text-primary">
              {formatINR(EVENT.entryFee)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {EVENT.feeStatus}
          </p>
        </aside>
      </div>
    </PageShell>
  )
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex gap-2" aria-label="Registration steps">
      {STEPS.map((label, i) => (
        <li
          key={label}
          className="flex-1"
          aria-current={i === step ? 'step' : undefined}
        >
          <div
            className={cn(
              'h-1.5 rounded-full bg-border transition-colors motion-reduce:transition-none',
              i <= step && 'bg-primary',
            )}
          />
          <p
            className={cn(
              'mt-2 text-xs font-bold tracking-wider uppercase',
              i === step ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <span className="mr-1 text-primary">{i + 1}</span> {label}
          </p>
        </li>
      ))}
    </ol>
  )
}

function ConsentBox({
  id,
  checked,
  onChange,
  error,
  children,
}: {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(v) => onChange(v === true)}
          className="mt-0.5 bg-card"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <label htmlFor={id} className="text-sm leading-relaxed">
          {children}
        </label>
      </div>
      {error && (
        <p
          id={`${id}-error`}
          className="mt-1 ml-7 text-sm font-medium text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  )
}
