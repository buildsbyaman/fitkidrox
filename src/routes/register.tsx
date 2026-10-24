import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  PartyPopper,
} from 'lucide-react'
import { toast } from 'sonner'

import { Field, fieldAria, PageHero } from '@/components/site/field'
import { PageShell } from '@/components/site/page-shell'
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
import { submitParticipantInterest } from '@/data/api'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/register')({
  head: () => ({
    meta: [{ title: 'Register interest · FITKIDROX Chandigarh 2026' }],
  }),
  component: RegisterPage,
})

const STEPS = ['Participant', 'Parent & consent', 'Review'] as const

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
      e.dob = 'Participants must be at least 3 years old on 28 Nov 2026.'
    else if (age > 18) e.dob = 'FITKIDROX is for participants up to 18 years.'
    if (!f.gender) e.gender = 'Choose one.'
    if (!f.tshirt) e.tshirt = 'Choose a T-shirt size.'
  }
  if (step === 1) {
    if (f.guardianName.trim().length < 2)
      e.guardianName = 'Enter your full name.'
    if (!/^(\+91[\s-]?)?[6-9]\d{9}$/.test(f.guardianPhone.replace(/\s/g, '')))
      e.guardianPhone = 'Enter a 10-digit Indian mobile number.'
    if (!/^\S+@\S+\.\S+$/.test(f.guardianEmail))
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

  const age = form.dob ? ageOnEventDay(form.dob) : null
  const category = age !== null ? categoryForAge(age) : null

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
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

  async function submit() {
    setSubmitting(true)
    try {
      const res = await submitParticipantInterest({
        ...form,
        category: category?.name ?? '',
      })
      setReference(res.reference)
    } catch {
      toast.error('We couldn’t save your registration. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (reference) {
    return (
      <PageShell>
        <section className="track-lines">
          <div className="mx-auto max-w-reading px-4 py-24 text-center sm:px-6">
            <PartyPopper className="mx-auto size-12 text-primary" />
            <h1 className="font-display mt-6 text-6xl leading-[0.9] font-black uppercase">
              You’re on the list, {form.childName.split(' ')[0]}!
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              We’ve saved your interest for{' '}
              <strong className="text-foreground">{category?.name}</strong>.
              We’ll email {form.guardianEmail} as soon as paid registration
              opens.
            </p>
            <div className="mx-auto mt-8 inline-block rounded-2xl border border-border/80 bg-card px-8 py-5 shadow-sm">
              <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                Reference Code
              </p>
              <p className="font-display text-4xl font-black tracking-wider text-primary">
                {reference}
              </p>
            </div>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setForm({
                    ...EMPTY,
                    guardianName: form.guardianName,
                    guardianPhone: form.guardianPhone,
                    guardianEmail: form.guardianEmail,
                    relation: form.relation,
                  })
                  setReference(null)
                  setStep(0)
                }}
              >
                Add a sibling
              </Button>
              <Button asChild>
                <Link to="/">Back to home</Link>
              </Button>
            </div>
          </div>
        </section>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHero eyebrow={EVENT.dateLabel} title="Register your interest">
        Paid registration opens once the venue and fees are confirmed.
        Pre-register now to secure early access for your child.
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
                <div className="grid gap-2">
                  <span className="text-sm font-semibold">Category</span>
                  <div
                    className={cn(
                      'flex min-h-9 items-center rounded-md border border-dashed px-3 text-sm transition-colors',
                      category &&
                        'border-solid border-primary/50 bg-primary/10 text-primary font-bold',
                    )}
                    aria-live="polite"
                  >
                    {category
                      ? `${category.name} · ${category.ages}`
                      : 'Auto-selected from date of birth'}
                  </div>
                </div>
                <Field id="gender" label="Gender" error={errors.gender}>
                  <RadioGroup
                    id="gender"
                    value={form.gender}
                    onValueChange={(v) => set('gender', v)}
                    className="flex gap-5 pt-1"
                    aria-invalid={errors.gender ? true : undefined}
                  >
                    {['Girl', 'Boy', 'Other'].map((g) => (
                      <label
                        key={g}
                        className="flex items-center gap-2 text-sm"
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
                    No payment today
                  </AlertTitle>
                  <AlertDescription>
                    This is a pre-registration. When paid registration opens
                    you’ll receive a link to pay the entry fee (proposed{' '}
                    {formatINR(EVENT.entryFee)}) by UPI or card and get a
                    digital receipt.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between gap-3 border-t pt-6">
              {step > 0 ? (
                <Button
                  variant="ghost"
                  onClick={() => setStep((s) => s - 1)}
                  disabled={submitting}
                >
                  <ArrowLeft /> Back
                </Button>
              ) : (
                <span />
              )}
              {step < 2 ? (
                <Button onClick={next} size="lg" className="font-bold">
                  Continue <ArrowRight />
                </Button>
              ) : (
                <Button
                  onClick={submit}
                  size="lg"
                  className="font-bold"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      Confirm pre-registration <Check />
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
            {category?.name ?? 'Choose a date of birth'}
          </p>
          {category && (
            <p className="mt-1 text-sm text-muted-foreground">
              {category.format}
            </p>
          )}
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
            <span className="text-sm text-muted-foreground">
              Proposed entry
            </span>
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
