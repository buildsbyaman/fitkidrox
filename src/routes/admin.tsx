import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Loader2,
  LogOut,
  Pencil,
  Phone,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  CATEGORIES,
  SPONSOR_PACKAGES,
  TSHIRT_SIZES,
  ageOnEventDay,
  categoryForAge,
} from '@/data/fixtures'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin')({
  head: () => ({
    meta: [
      {
        name: 'robots',
        content: 'noindex, nofollow, noarchive',
      },
      {
        name: 'googlebot',
        content: 'noindex, nofollow, noarchive',
      },
      {
        title: 'Admin Portal · FITKIDROX',
      },
    ],
  }),
  component: AdminPage,
})

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'participants' | 'heats' | 'schools' | 'sponsors'

interface Participant {
  _id: string
  reference: string
  bibNumber?: number
  heat?: number
  course?: string
  checkedIn?: boolean
  checkedInAt?: string
  isManual?: boolean
  childName: string
  dob: string
  gender: string
  tshirt: string
  school: string
  category: string
  guardianName: string
  guardianPhone: string
  guardianEmail: string
  relation: string
  medicalNotes: string
  consentParticipation: boolean
  consentMedical: boolean
  consentPhotos: boolean
  payment?: {
    status?: 'unpaid' | 'paid' | 'failed' | string
    amount?: number
    orderId?: string
    paymentId?: string
    paidAt?: string
  }
  paymentStatus?: string
  paymentAmount?: number
  'payment.status'?: string
  'payment.amount'?: number
  createdAt: string
}

interface School {
  _id: string
  reference: string
  schoolName: string
  city: string
  coordinator: string
  phone: string
  email: string
  participants: number
  createdAt: string
}

interface Sponsor {
  _id: string
  reference: string
  company: string
  contact: string
  email: string
  phone: string
  packageId: string
  message: string
  createdAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function age(dob: string) {
  if (!dob) return '—'
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)) + 'y'
}

function exportCsv(rows: object[], filename: string, label = 'records') {
  if (!rows.length) {
    toast.error('Nothing to export', {
      description: `There are 0 ${label} matching current filters.`,
    })
    return
  }

  /**
   * RFC4180 cell: quoted, inner quotes doubled — JSON.stringify's `\"` is not
   * valid CSV and corrupts exports. Leading = + - @ (tab/CR too) are prefixed
   * with a quote so Excel/Sheets treat them as text instead of executing them:
   * child and guardian names come from the public form, so a value like
   * `=cmd|'/C calc'!A0` would otherwise run on the admin's machine.
   */
  const cell = (value: unknown) => {
    const text =
      value === null || value === undefined
        ? ''
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value)
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
    return `"${safe.replace(/"/g, '""')}"`
  }

  const keys = Object.keys(rows[0])
  const csv = [
    keys.map(cell).join(','),
    ...rows.map((r) =>
      keys.map((k) => cell((r as Record<string, unknown>)[k])).join(','),
    ),
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  toast.success('CSV Downloaded', {
    description: `Exported ${rows.length} ${label} to ${filename}.`,
  })
}

function copyToClipboard(text: string, label: string) {
  if (!text) return
  void navigator.clipboard.writeText(text)
  toast.success(`Copied ${label}`, { description: text })
}

// ─────────────────────────────────────────────────────────────────────────────
// API calls
// ─────────────────────────────────────────────────────────────────────────────

async function apiLogin(email: string, password: string) {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(
      (data as { error?: string }).error ?? 'Invalid email or password',
    )
  }
  return res.json()
}

async function apiLogout() {
  await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' })
}

async function apiCheckSession() {
  const res = await fetch('/api/admin/me', { credentials: 'include' })
  return res.ok
}

async function apiCollection<T>(collection: string): Promise<T[]> {
  const res = await fetch(`/api/admin/${collection}?limit=1000`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Failed to fetch ${collection}`)
  const data = (await res.json()) as { docs: T[] }
  return data.docs
}

async function apiUpdateRecord<T>(
  collection: string,
  id: string,
  updates: Partial<T>,
): Promise<T> {
  const res = await fetch(`/api/admin/${collection}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(
      (data as { error?: string }).error ?? 'Failed to update record',
    )
  }
  const data = (await res.json()) as { ok: boolean; doc: T }
  return data.doc
}

async function apiCreateParticipant(
  payload: Record<string, unknown>,
): Promise<Participant> {
  const res = await fetch('/api/admin/participants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(
      (data as { error?: string }).error ??
        'Failed to create student registration',
    )
  }
  const data = (await res.json()) as { ok: boolean; doc: Participant }
  return data.doc
}

// ─────────────────────────────────────────────────────────────────────────────
// Login Screen (Clean, Plain White Theme)
// ─────────────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await apiLogin(email, password)
      toast.success('Signed in successfully', {
        description: 'Welcome to FITKIDROX Admin Panel.',
      })
      onLogin()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      setError(msg)
      toast.error('Authentication failed', { description: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            FITKIDROX
          </h1>
          <p className="mt-1 text-sm text-slate-500">Administrator Sign In</p>
        </div>

        <div className="mt-8 bg-white py-8 px-6 border border-slate-200 rounded-lg shadow-sm sm:px-10">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200 flex items-center gap-2">
                <AlertCircle size={16} className="text-red-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="admin-email"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Email address
              </label>
              <input
                ref={emailRef}
                id="admin-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@fitkidrox.in"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <button
              id="admin-login-btn"
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sort / Filter hook & Table Header
// ─────────────────────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc'

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part) => {
    if (acc != null && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, obj)
}

function PaymentBadge({ status }: { status?: string }) {
  const s = (status || 'unpaid').toLowerCase()
  if (s === 'paid') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 size={12} className="text-emerald-600" />
        Paid
      </span>
    )
  }
  if (s === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
        <XCircle size={12} className="text-red-600" />
        Failed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      <Clock size={12} className="text-amber-600" />
      Unpaid
    </span>
  )
}

function useSortFilter<T extends Record<string, unknown>>(data: T[]) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<string>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = data.filter((row) =>
    JSON.stringify(row).toLowerCase().includes(query.toLowerCase()),
  )

  const sorted = [...filtered].sort((a, b) => {
    const av = getNestedValue(a, sortKey)
    const bv = getNestedValue(b, sortKey)
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = String(av).localeCompare(String(bv), undefined, {
      numeric: true,
    })
    return sortDir === 'asc' ? cmp : -cmp
  })

  return { query, setQuery, sorted, sortKey, sortDir, handleSort }
}

function Th({
  label,
  field,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string
  field: string
  sortKey: string
  sortDir: SortDir
  onSort: (k: string) => void
}) {
  const active = sortKey === field
  return (
    <th
      onClick={() => onSort(field)}
      className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap"
    >
      <div className="inline-flex items-center gap-1.5">
        <span>{label}</span>
        <span className="text-slate-400">
          {active ? (
            sortDir === 'asc' ? (
              <ChevronUp size={13} className="text-slate-900" />
            ) : (
              <ChevronDown size={13} className="text-slate-900" />
            )
          ) : (
            <ChevronDown size={13} className="opacity-30" />
          )}
        </span>
      </div>
    </th>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Editable Cell Components (Edit Mode)
// ─────────────────────────────────────────────────────────────────────────────

function EditableText({
  value,
  onChange,
  onEnter,
  className = '',
  type = 'text',
  placeholder = '',
  isDirty = false,
}: {
  value: string | number
  onChange: (val: string) => void
  onEnter?: () => void
  className?: string
  type?: string
  placeholder?: string
  isDirty?: boolean
}) {
  return (
    <div className="relative inline-flex items-center w-full min-w-[110px]">
      <input
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onEnter?.()
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full rounded border px-2 py-1 text-xs transition-all outline-none',
          isDirty
            ? 'bg-amber-50/90 border-amber-400 text-slate-900 font-medium ring-1 ring-amber-300 shadow-xs'
            : 'bg-slate-50/60 border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500',
          className,
        )}
      />
    </div>
  )
}

function EditableSelect({
  value,
  options,
  onChange,
  className = '',
  isDirty = false,
}: {
  value: string
  options: { label: string; value: string }[]
  onChange: (val: string) => void
  className?: string
  isDirty?: boolean
}) {
  return (
    <div className="relative inline-flex items-center w-full min-w-[120px]">
      <select
        value={value}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full rounded border px-2 py-1 text-xs transition-all outline-none cursor-pointer',
          isDirty
            ? 'bg-amber-50/90 border-amber-400 text-slate-900 font-medium ring-1 ring-amber-300 shadow-xs'
            : 'bg-slate-50/60 border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500',
          className,
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Manual Student Registration Modal
// ─────────────────────────────────────────────────────────────────────────────

interface AddStudentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newParticipant: Participant) => void
}

function AddStudentModal({ isOpen, onClose, onSuccess }: AddStudentModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState<{
    childName: string
    dob: string
    gender: string
    category: string
    tshirt: string
    school: string
    guardianName: string
    guardianPhone: string
    guardianEmail: string
    relation: string
    medicalNotes: string
    paymentStatus: string
    paymentAmount: string
    paymentId: string
    consentParticipation: boolean
    consentMedical: boolean
    consentPhotos: boolean
  }>({
    childName: '',
    dob: '',
    gender: 'Boy',
    category: '',
    tshirt: TSHIRT_SIZES[2] || 'M (7-8 yrs)',
    school: '',
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
    relation: 'Parent',
    medicalNotes: '',
    paymentStatus: 'paid',
    paymentAmount: '1250',
    paymentId: '',
    consentParticipation: true,
    consentMedical: true,
    consentPhotos: true,
  })

  const calculatedAge = formData.dob ? ageOnEventDay(formData.dob) : null
  const derivedCategory =
    calculatedAge !== null ? categoryForAge(calculatedAge) : null

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.childName.trim()) {
      toast.error('Validation error', {
        description: 'Child Name is required.',
      })
      return
    }
    if (!formData.dob) {
      toast.error('Validation error', {
        description: 'Date of Birth is required.',
      })
      return
    }

    const ageVal = ageOnEventDay(formData.dob)
    const catVal = ageVal !== null ? categoryForAge(ageVal) : null
    if (!catVal) {
      toast.error('Invalid Date of Birth', {
        description:
          'Child must be at least 3 years old on event day (born on or before 28 Nov 2023).',
      })
      return
    }

    if (!formData.guardianName.trim()) {
      toast.error('Validation error', {
        description: 'Guardian Name is required.',
      })
      return
    }
    if (
      !formData.guardianPhone.trim() ||
      !/^[6-9]\d{9}$/.test(formData.guardianPhone.trim())
    ) {
      toast.error('Validation error', {
        description:
          'Guardian Phone must be a valid 10-digit Indian mobile number.',
      })
      return
    }
    if (
      !formData.guardianEmail.trim() ||
      !formData.guardianEmail.includes('@')
    ) {
      toast.error('Validation error', {
        description: 'A valid Guardian Email address is required.',
      })
      return
    }

    setSubmitting(true)
    try {
      const doc = await apiCreateParticipant({
        ...formData,
        category: catVal.name,
        paymentAmount: Number(formData.paymentAmount) || 0,
      })
      toast.success('Student Registered Successfully', {
        description: doc.bibNumber
          ? `${doc.childName} registered with Bib #${doc.bibNumber}.`
          : `${doc.childName} registered successfully.`,
      })
      onSuccess(doc)
      onClose()
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to register student'
      toast.error('Registration failed', { description: msg })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-6 overflow-y-auto">
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5 sm:gap-2">
              <UserPlus size={16} className="text-slate-700 sm:w-[18px] sm:h-[18px]" />
              Manual Student Registration
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              Direct database entry with customizable fee.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6"
        >
          {/* Section 1: Child Information */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
              Child Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Child Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aarav Sharma"
                  value={formData.childName}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, childName: e.target.value }))
                  }
                  className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Date of Birth <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  max="2023-11-28"
                  value={formData.dob}
                  onChange={(e) => {
                    const dobVal = e.target.value
                    const ageVal = dobVal ? ageOnEventDay(dobVal) : null
                    const catVal =
                      ageVal !== null ? categoryForAge(ageVal) : null
                    setFormData((f) => ({
                      ...f,
                      dob: dobVal,
                      category: catVal?.name || '',
                    }))
                  }}
                  className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Must be at least 3 years old (born on or before 28 Nov 2023)
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Gender <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, gender: e.target.value }))
                  }
                  className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none cursor-pointer"
                >
                  <option value="Boy">Boy</option>
                  <option value="Girl">Girl</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  readOnly
                  placeholder="Auto-derived from Date of Birth"
                  value={derivedCategory ? derivedCategory.name : ''}
                  className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 bg-slate-50 text-slate-800 outline-none cursor-default"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  T-Shirt Size <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.tshirt}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, tshirt: e.target.value }))
                  }
                  className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none cursor-pointer"
                >
                  {TSHIRT_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  School Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. DPS International"
                  value={formData.school}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, school: e.target.value }))
                  }
                  className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Guardian Information */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
              Guardian Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Guardian Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajesh Sharma"
                  value={formData.guardianName}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, guardianName: e.target.value }))
                  }
                  className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Relation to Child
                </label>
                <select
                  value={formData.relation}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, relation: e.target.value }))
                  }
                  className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none cursor-pointer"
                >
                  <option value="Parent">Parent</option>
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Legal Guardian">Legal Guardian</option>
                  <option value="Grandparent">Grandparent</option>
                  <option value="Coach / Trainer">Coach / Trainer</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={formData.guardianPhone}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      guardianPhone: e.target.value
                        .replace(/\D/g, '')
                        .slice(0, 10),
                    }))
                  }
                  className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="parent@example.com"
                  value={formData.guardianEmail}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      guardianEmail: e.target.value,
                    }))
                  }
                  className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
                />
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Medical Notes / Special Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Allergies, asthma, medications or dietary notes (if any)"
                  value={formData.medicalNotes}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, medicalNotes: e.target.value }))
                  }
                  className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Payment Details */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
              Payment Details
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Status
                </label>
                <select
                  value={formData.paymentStatus}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      paymentStatus: e.target.value,
                    }))
                  }
                  className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none cursor-pointer"
                >
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Registration Amount (₹){' '}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    placeholder="1250"
                    value={formData.paymentAmount}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        paymentAmount: e.target.value,
                      }))
                    }
                    className="w-full text-xs pl-7 pr-3 py-2 rounded-md border border-slate-300 bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Note / Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cash, UPI, Cheque, Sponsor (optional)"
                  value={formData.paymentId}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, paymentId: e.target.value }))
                  }
                  className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Consents */}
          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-600">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.consentParticipation}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    consentParticipation: e.target.checked,
                  }))
                }
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span>Participation Consent</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.consentMedical}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    consentMedical: e.target.checked,
                  }))
                }
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span>Medical Emergency Consent</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.consentPhotos}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    consentPhotos: e.target.checked,
                  }))
                }
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span>Media / Photos Consent</span>
            </label>
          </div>

          {/* Modal Footer */}
          <div className="pt-3 sm:pt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 sm:py-2 border border-slate-300 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer min-h-[36px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 sm:py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 min-h-[36px]"
            >
              {submitting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <UserPlus size={13} />
              )}
              {submitting ? 'Creating Entry…' : 'Create Student Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Participants Table
// ─────────────────────────────────────────────────────────────────────────────

function ParticipantsTable({
  data,
  editMode,
  onToggleEditMode,
  onUpdate,
  onAddParticipant,
  onToggleCheckIn,
}: {
  data: Participant[]
  editMode: boolean
  onToggleEditMode: () => void
  onUpdate: (id: string, updates: Partial<Participant>) => Promise<void>
  onAddParticipant?: (doc: Participant) => void
  onToggleCheckIn?: (
    idOrBib: string | number,
    currentCheckedIn: boolean,
  ) => Promise<void>
}) {
  const [paymentFilter, setPaymentFilter] = useState<
    'all' | 'paid' | 'unpaid' | 'failed'
  >('all')

  const filteredByPayment = data.filter((p) => {
    if (paymentFilter === 'all') return true
    const status = (p.payment?.status || 'unpaid').toLowerCase()
    if (paymentFilter === 'unpaid') {
      return status !== 'paid'
    }
    return status === paymentFilter
  })

  const { query, setQuery, sorted, sortKey, sortDir, handleSort } =
    useSortFilter(filteredByPayment as unknown as Record<string, unknown>[])
  const [expanded, setExpanded] = useState<string | null>(null)
  // Drafts may be keyed by Mongo field paths (e.g. 'payment.status'), which
  // are not keys of Participant — the value type allows string-keyed access.
  const [drafts, setDrafts] = useState<
    Record<string, Partial<Participant> & Record<string, unknown>>
  >({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savingAll, setSavingAll] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  const dirtyCount = Object.keys(drafts).length
  const paidCount = data.filter(
    (p) => (p.payment?.status || '').toLowerCase() === 'paid',
  ).length
  const unpaidCount = data.length - paidCount

  const updateDraft = (id: string, field: keyof Participant, val: unknown) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: val,
      },
    }))
  }

  const handleDiscardRow = (id: string) => {
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const handleDiscardAll = () => {
    setDrafts({})
  }

  const handleSaveRow = async (id: string, name: string) => {
    const patch = drafts[id]
    if (!patch || Object.keys(patch).length === 0) return
    setSavingId(id)
    try {
      await onUpdate(id, patch)
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      toast.success('Changes saved successfully!', {
        description: `${name || 'Participant'} has been updated in the database.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save changes'
      toast.error('Save failed', { description: msg })
    } finally {
      setSavingId(null)
    }
  }

  const handleSaveAll = async () => {
    const ids = Object.keys(drafts)
    if (ids.length === 0) return
    setSavingAll(true)
    let savedCount = 0
    try {
      for (const id of ids) {
        await onUpdate(id, drafts[id])
        savedCount++
      }
      setDrafts({})
      toast.success('Changes saved successfully!', {
        description: `Saved changes to ${savedCount} ${savedCount === 1 ? 'participant' : 'participants'}.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save all changes'
      toast.error('Save failed', { description: msg })
    } finally {
      setSavingAll(false)
    }
  }

  const handleToggle = () => {
    if (editMode && dirtyCount > 0) {
      if (
        !window.confirm(
          `You have ${dirtyCount} unsaved ${dirtyCount === 1 ? 'row' : 'rows'}. Exit edit mode and discard?`,
        )
      ) {
        return
      }
      setDrafts({})
    }
    onToggleEditMode()
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      {/* Toolbar */}
      <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 flex-1">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              id="participants-search"
              type="text"
              placeholder="Search participants, guardian, school…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 sm:py-1.5 text-sm sm:text-xs rounded-md border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick Payment Status Filters */}
          <div className="grid grid-cols-3 sm:inline-flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 w-full sm:w-auto shrink-0">
            <button
              type="button"
              id="filter-payment-all"
              onClick={() => setPaymentFilter('all')}
              className={cn(
                'px-2 py-1.5 sm:py-1 text-xs font-medium rounded-md transition-all cursor-pointer text-center justify-center inline-flex items-center',
                paymentFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              All ({data.length})
            </button>
            <button
              type="button"
              id="filter-payment-paid"
              onClick={() => setPaymentFilter('paid')}
              className={cn(
                'inline-flex items-center justify-center gap-1 px-2 py-1.5 sm:py-1 text-xs font-medium rounded-md transition-all cursor-pointer text-center',
                paymentFilter === 'paid'
                  ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-emerald-700',
              )}
            >
              <CheckCircle2 size={12} className="text-emerald-600" />
              Paid ({paidCount})
            </button>
            <button
              type="button"
              id="filter-payment-unpaid"
              onClick={() => setPaymentFilter('unpaid')}
              className={cn(
                'inline-flex items-center justify-center gap-1 px-2 py-1.5 sm:py-1 text-xs font-medium rounded-md transition-all cursor-pointer text-center',
                paymentFilter === 'unpaid'
                  ? 'bg-white text-amber-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-amber-700',
              )}
            >
              <Clock size={12} className="text-amber-600" />
              Unpaid ({unpaidCount})
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full pt-1 sm:pt-0">
          <span className="text-xs text-slate-500 order-1 sm:order-none">
            {sorted.length} {sorted.length === 1 ? 'record' : 'records'}
          </span>
          <div className="flex items-center gap-2 flex-1 sm:flex-none justify-end">
            <button
              type="button"
              id="participants-add-student-btn"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 border border-slate-900 rounded-md text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer shadow-xs min-h-[34px] flex-1 sm:flex-none"
            >
              <UserPlus size={13} /> Add Student
            </button>
            <button
              id="participants-export-btn"
              onClick={() =>
                exportCsv(
                  sorted.map((item) => {
                    const p = item as unknown as Participant
                    return {
                      bibNumber: p.bibNumber ? `#${p.bibNumber}` : 'Unassigned',
                      entryType: p.isManual ? 'Manual' : 'Online',
                      childName: p.childName,
                      dob: p.dob,
                      gender: p.gender,
                      category: p.category,
                      heat: p.heat ? `Heat ${p.heat}` : '',
                      course: p.course || '',
                      checkedIn: p.checkedIn ? 'Yes' : 'No',
                      tshirt: p.tshirt,
                      school: p.school,
                      guardianName: p.guardianName,
                      guardianPhone: p.guardianPhone,
                      guardianEmail: p.guardianEmail,
                      relation: p.relation,
                      paymentStatus: p.payment?.status || 'unpaid',
                      paymentAmount: p.payment?.amount ?? 1250,
                      paidAt: p.payment?.paidAt || '',
                      registeredAt: p.createdAt,
                    }
                  }),
                  'participants.csv',
                  'participants',
                )
              }
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 border border-slate-300 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer min-h-[34px] flex-1 sm:flex-none"
            >
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {editMode && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-3 sm:px-4 py-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start sm:items-center gap-2">
            <Pencil size={13} className="text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <span className="leading-tight">
              <strong>Edit Mode Active:</strong> Edit fields directly. Click <strong className="text-emerald-700">Save</strong> to commit.
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
            {dirtyCount > 0 && (
              <>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-200 text-amber-900">
                  {dirtyCount} unsaved
                </span>
                <button
                  type="button"
                  id="participants-save-all-btn"
                  onClick={handleSaveAll}
                  disabled={savingAll}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-xs cursor-pointer transition-all disabled:opacity-50 min-h-[30px]"
                >
                  {savingAll ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Save size={12} />
                  )}
                  Save All ({dirtyCount})
                </button>
                <button
                  type="button"
                  onClick={handleDiscardAll}
                  disabled={savingAll}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-rose-600 hover:bg-white rounded-md text-xs font-medium cursor-pointer transition-colors min-h-[30px]"
                >
                  <RotateCcw size={12} /> Discard All
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleToggle}
              className="font-semibold text-amber-900 underline hover:text-amber-700 cursor-pointer ml-auto sm:ml-2"
            >
              Done editing
            </button>
          </div>
        </div>
      )}

      {/* Mobile Card List (md:hidden) */}
      <div className="divide-y divide-slate-100 md:hidden">
        {sorted.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No participants found.
          </div>
        ) : (
          (sorted as unknown as Participant[]).map((p) => {
            const draft = drafts[p._id] || {}
            const isRowDirty = Object.keys(draft).length > 0
            const currentPaymentStatus =
              draft.paymentStatus !== undefined
                ? draft.paymentStatus
                : (draft['payment.status'] as string | undefined) !== undefined
                  ? (draft['payment.status'] as string)
                  : p.payment?.status || 'unpaid'
            const currentPaymentAmount =
              draft.paymentAmount !== undefined
                ? draft.paymentAmount
                : p.payment?.amount !== undefined
                  ? p.payment.amount
                  : 1250
            const currentChildName =
              draft.childName !== undefined ? draft.childName : p.childName
            const currentDob = draft.dob !== undefined ? draft.dob : p.dob
            const currentGender =
              draft.gender !== undefined ? draft.gender : p.gender || 'Boy'
            const currentCategory =
              draft.category !== undefined
                ? draft.category
                : p.category || CATEGORIES[0].name
            const currentTshirt =
              draft.tshirt !== undefined
                ? draft.tshirt
                : p.tshirt || TSHIRT_SIZES[0]
            const currentSchool =
              draft.school !== undefined ? draft.school : p.school || ''
            const currentGuardianName =
              draft.guardianName !== undefined
                ? draft.guardianName
                : p.guardianName
            const currentGuardianPhone =
              draft.guardianPhone !== undefined
                ? draft.guardianPhone
                : p.guardianPhone
            const currentGuardianEmail =
              draft.guardianEmail !== undefined
                ? draft.guardianEmail
                : p.guardianEmail
            const currentRelation =
              draft.relation !== undefined
                ? draft.relation
                : p.relation || 'Parent'

            const isExpanded = expanded === p._id

            return (
              <div
                key={`mobile-${p._id}`}
                className={cn(
                  'p-3.5 sm:p-4 transition-colors',
                  isExpanded ? 'bg-slate-50/70' : 'bg-white',
                  isRowDirty ? 'ring-1 ring-amber-300 bg-amber-50/20' : '',
                )}
              >
                {/* Top Row: Bib + Status */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {p.bibNumber ? (
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white shadow-xs">
                        #{p.bibNumber}
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        Pending Bib
                      </span>
                    )}
                    {p.isManual && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        Manual
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <PaymentBadge status={currentPaymentStatus} />
                    <span className="text-xs font-bold text-slate-800">
                      ₹{Number(currentPaymentAmount).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Child Name & Meta */}
                <div className="mt-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-900">
                      {currentChildName}
                    </h4>
                    <span className="text-xs text-slate-500 shrink-0 font-medium">
                      {age(currentDob)} · {currentGender}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap text-xs text-slate-600">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 font-medium text-[11px] text-slate-700">
                      {currentCategory}
                    </span>
                    {p.heat && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        Heat {p.heat}
                      </span>
                    )}
                    {p.course && (
                      <span
                        className={cn(
                          'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border',
                          p.course.includes('A')
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200',
                        )}
                      >
                        {p.course}
                      </span>
                    )}
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-500 font-medium">{currentTshirt}</span>
                    {currentSchool && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500 truncate max-w-[150px]">{currentSchool}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Guardian Info & Race Day Check-In */}
                <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-slate-800 block truncate">
                      {currentGuardianName}{' '}
                      <span className="text-slate-400 font-normal">({currentRelation})</span>
                    </span>
                    <span className="text-slate-500 text-[11px] block truncate">
                      {currentGuardianEmail}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={`tel:${currentGuardianPhone}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono text-xs font-semibold shrink-0 min-h-[32px]"
                      title="Tap to call parent"
                    >
                      <Phone size={11} className="text-slate-600" />
                      {currentGuardianPhone}
                    </a>
                    {onToggleCheckIn && p.payment?.status === 'paid' && (
                      <button
                        type="button"
                        onClick={() =>
                          void onToggleCheckIn(p.bibNumber || p._id, Boolean(p.checkedIn))
                        }
                        className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors shrink-0 min-h-[32px] cursor-pointer',
                          p.checkedIn
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300',
                        )}
                      >
                        <Check
                          size={11}
                          className={p.checkedIn ? 'stroke-[3]' : 'text-slate-400'}
                        />
                        {p.checkedIn ? 'Checked In' : 'Check In'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Mobile Edit Mode Form */}
                {editMode && (
                  <div className="mt-3 pt-3 border-t border-amber-200/60 space-y-2.5 bg-amber-50/40 -mx-3.5 -mb-3.5 p-3.5 rounded-b-lg sm:-mx-4 sm:-mb-4 sm:p-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Child Name</label>
                        <EditableText
                          value={currentChildName}
                          isDirty={draft.childName !== undefined}
                          onChange={(val) => updateDraft(p._id, 'childName', val)}
                          className="w-full text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Payment</label>
                        <EditableSelect
                          value={currentPaymentStatus}
                          isDirty={draft.paymentStatus !== undefined || draft['payment.status'] !== undefined}
                          options={[
                            { label: 'Paid', value: 'paid' },
                            { label: 'Unpaid', value: 'unpaid' },
                            { label: 'Failed', value: 'failed' },
                          ]}
                          onChange={(val) => updateDraft(p._id, 'paymentStatus' as keyof Participant, val)}
                          className="w-full text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Date of Birth</label>
                        <EditableText
                          type="date"
                          value={currentDob}
                          isDirty={draft.dob !== undefined}
                          onChange={(val) => {
                            updateDraft(p._id, 'dob', val)
                            const calculated = val ? ageOnEventDay(val) : null
                            const autoCat = calculated !== null ? categoryForAge(calculated) : null
                            if (autoCat) updateDraft(p._id, 'category', autoCat.name)
                          }}
                          className="w-full text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Category</label>
                        <EditableSelect
                          value={currentCategory}
                          isDirty={draft.category !== undefined}
                          options={CATEGORIES.map((c) => ({ label: c.name, value: c.name }))}
                          onChange={(val) => updateDraft(p._id, 'category', val)}
                          className="w-full text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Guardian</label>
                        <EditableText
                          value={currentGuardianName}
                          isDirty={draft.guardianName !== undefined}
                          onChange={(val) => updateDraft(p._id, 'guardianName', val)}
                          className="w-full text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Phone</label>
                        <EditableText
                          value={currentGuardianPhone}
                          isDirty={draft.guardianPhone !== undefined}
                          onChange={(val) => updateDraft(p._id, 'guardianPhone', val)}
                          className="w-full text-xs"
                        />
                      </div>
                    </div>

                    {p.isManual && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Amount (₹)</label>
                        <EditableText
                          type="number"
                          value={currentPaymentAmount as number}
                          isDirty={draft.paymentAmount !== undefined}
                          onChange={(val) => updateDraft(p._id, 'paymentAmount' as keyof Participant, val === '' ? '' : Number(val))}
                          className="w-full text-xs"
                        />
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => void handleSaveRow(p._id, currentChildName)}
                        disabled={!isRowDirty || savingId === p._id || savingAll}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold shadow-xs cursor-pointer min-h-[32px]',
                          isRowDirty
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed',
                        )}
                      >
                        {savingId === p._id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Save Changes
                      </button>
                    </div>
                  </div>
                )}

                {/* Details Accordion (when not in edit mode) */}
                {!editMode && (
                  <>
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : p._id)}
                      className="mt-2 text-[11px] font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer pt-0.5"
                    >
                      <ChevronDown
                        size={13}
                        className={cn('transition-transform duration-200', isExpanded ? 'rotate-180' : '')}
                      />
                      {isExpanded ? 'Hide Details' : 'View Full Details'}
                    </button>

                    {isExpanded && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50/90 -mx-3.5 -mb-3.5 p-3.5 rounded-b-lg sm:-mx-4 sm:-mb-4 sm:p-4">
                        <div>
                          <span className="text-slate-400 text-[10px] font-semibold uppercase block">DOB</span>
                          <span className="text-slate-800 font-medium">{p.dob || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] font-semibold uppercase block">Entry Source</span>
                          <span className="text-slate-800 font-medium">
                            {p.isManual ? 'Manual (Admin)' : 'Online Registration'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] font-semibold uppercase block">School</span>
                          <span className="text-slate-800 font-medium">{p.school || 'None'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] font-semibold uppercase block">Payment ID</span>
                          <span className="text-slate-800 font-mono text-[11px]">{p.payment?.paymentId || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] font-semibold uppercase block">Consents</span>
                          <span className="text-slate-800 font-medium">
                            Part: {p.consentParticipation ? 'Yes' : 'No'} · Med: {p.consentMedical ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] font-semibold uppercase block">Registered</span>
                          <span className="text-slate-800 font-medium">{formatDate(p.createdAt)}</span>
                        </div>
                        {p.medicalNotes && (
                          <div className="col-span-2 mt-1">
                            <span className="text-slate-400 text-[10px] font-semibold uppercase block">Medical Notes</span>
                            <p className="text-slate-800 bg-white p-2 rounded border border-slate-200 text-xs mt-0.5">
                              {p.medicalNotes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Desktop Table View (hidden md:block) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead>
            <tr>
              <Th
                label="Bib # (ID)"
                field="bibNumber"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Payment"
                field="payment.status"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Child Name"
                field="childName"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Age"
                field="dob"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Gender"
                field="gender"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Category"
                field="category"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Heat & Course"
                field="heat"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Check-In"
                field="checkedIn"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="T-Shirt"
                field="tshirt"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="School"
                field="school"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Guardian"
                field="guardianName"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Phone"
                field="guardianPhone"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Email"
                field="guardianEmail"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Registered"
                field="createdAt"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              {editMode && (
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Action
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={editMode ? 16 : 15}
                  className="py-12 text-center text-sm text-slate-500"
                >
                  No participants found.
                </td>
              </tr>
            )}
            {(sorted as unknown as Participant[]).flatMap((p) => {
              const draft = drafts[p._id] || {}
              const isRowDirty = Object.keys(draft).length > 0
              const currentPaymentStatus =
                draft.paymentStatus !== undefined
                  ? draft.paymentStatus
                  : (draft['payment.status'] as string | undefined) !== undefined
                    ? (draft['payment.status'] as string)
                    : p.payment?.status || 'unpaid'
              const currentPaymentAmount =
                draft.paymentAmount !== undefined
                  ? draft.paymentAmount
                  : p.payment?.amount !== undefined
                    ? p.payment.amount
                    : 1250
              const currentChildName =
                draft.childName !== undefined ? draft.childName : p.childName
              const currentDob = draft.dob !== undefined ? draft.dob : p.dob
              const currentGender =
                draft.gender !== undefined ? draft.gender : p.gender || 'Boy'
              const currentCategory =
                draft.category !== undefined
                  ? draft.category
                  : p.category || CATEGORIES[0].name
              const currentTshirt =
                draft.tshirt !== undefined
                  ? draft.tshirt
                  : p.tshirt || TSHIRT_SIZES[0]
              const currentSchool =
                draft.school !== undefined ? draft.school : p.school || ''
              const currentGuardianName =
                draft.guardianName !== undefined
                  ? draft.guardianName
                  : p.guardianName
              const currentGuardianPhone =
                draft.guardianPhone !== undefined
                  ? draft.guardianPhone
                  : p.guardianPhone
              const currentGuardianEmail =
                draft.guardianEmail !== undefined
                  ? draft.guardianEmail
                  : p.guardianEmail
              const currentRelation =
                draft.relation !== undefined
                  ? draft.relation
                  : p.relation || 'Parent'
              const currentMedicalNotes =
                draft.medicalNotes !== undefined
                  ? draft.medicalNotes
                  : p.medicalNotes || ''

              const rows = [
                <tr
                  key={p._id}
                  onClick={() =>
                    setExpanded(expanded === p._id ? null : p._id)
                  }
                  className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                    expanded === p._id ? 'bg-slate-50/70' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {p.bibNumber ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded font-bold bg-slate-900 text-white shadow-xs select-all">
                          #{p.bibNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">
                          Unassigned
                        </span>
                      )}
                      {p.isManual && (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200"
                          title="Manually entered by Admin"
                        >
                          Manual
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {editMode ? (
                      <div
                        className="space-y-1.5 min-w-[120px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <EditableSelect
                          value={currentPaymentStatus}
                          isDirty={
                            draft.paymentStatus !== undefined ||
                            draft['payment.status'] !== undefined
                          }
                          options={[
                            { label: 'Paid', value: 'paid' },
                            { label: 'Unpaid', value: 'unpaid' },
                            { label: 'Failed', value: 'failed' },
                          ]}
                          onChange={(val) =>
                            updateDraft(
                              p._id,
                              'paymentStatus' as keyof Participant,
                              val,
                            )
                          }
                        />
                        {p.isManual ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-bold text-slate-500">
                              ₹
                            </span>
                            <EditableText
                              type="number"
                              value={currentPaymentAmount as number}
                              isDirty={draft.paymentAmount !== undefined}
                              placeholder="Amount"
                              className="min-w-[80px] w-24 text-[11px]"
                              onChange={(val) =>
                                updateDraft(
                                  p._id,
                                  'paymentAmount' as keyof Participant,
                                  val === '' ? '' : Number(val),
                                )
                              }
                              onEnter={() =>
                                void handleSaveRow(p._id, currentChildName)
                              }
                            />
                          </div>
                        ) : (
                          <div
                            className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200 cursor-not-allowed select-none"
                            title="Online payment amount is fixed and cannot be edited"
                          >
                            <span>₹{Number(currentPaymentAmount).toLocaleString('en-IN')}</span>
                            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-normal ml-0.5">
                              Online
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <PaymentBadge status={currentPaymentStatus} />
                        <span className="text-[11px] font-semibold text-slate-600">
                          ₹{Number(currentPaymentAmount).toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                    {editMode ? (
                      <EditableText
                        value={currentChildName}
                        isDirty={draft.childName !== undefined}
                        onChange={(val) =>
                          updateDraft(p._id, 'childName', val)
                        }
                        onEnter={() => void handleSaveRow(p._id, currentChildName)}
                      />
                    ) : (
                      p.childName
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {editMode ? (
                      <EditableText
                        type="date"
                        value={currentDob}
                        isDirty={draft.dob !== undefined}
                        onChange={(val) => {
                          updateDraft(p._id, 'dob', val)
                          const calculated = val ? ageOnEventDay(val) : null
                          const autoCat =
                            calculated !== null
                              ? categoryForAge(calculated)
                              : null
                          if (autoCat) {
                            updateDraft(p._id, 'category', autoCat.name)
                          }
                        }}
                        onEnter={() =>
                          void handleSaveRow(p._id, currentChildName)
                        }
                      />
                    ) : (
                      age(p.dob)
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {editMode ? (
                      <EditableSelect
                        value={currentGender}
                        isDirty={draft.gender !== undefined}
                        options={[
                          { label: 'Boy', value: 'Boy' },
                          { label: 'Girl', value: 'Girl' },
                          { label: 'Other', value: 'Other' },
                        ]}
                        onChange={(val) => updateDraft(p._id, 'gender', val)}
                      />
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                        {p.gender || '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {editMode ? (
                      <EditableSelect
                        value={currentCategory}
                        isDirty={draft.category !== undefined}
                        options={CATEGORIES.map((c) => ({
                          label: c.name,
                          value: c.name,
                        }))}
                        onChange={(val) =>
                          updateDraft(p._id, 'category', val)
                        }
                      />
                    ) : (
                      p.category || '—'
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {p.heat ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          Heat {p.heat}
                        </span>
                        <span
                          className={cn(
                            'inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold border',
                            (p.course || '').includes('A')
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200',
                          )}
                        >
                          {p.course || 'Course A'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td
                    className="px-4 py-3 whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {onToggleCheckIn && p.payment?.status === 'paid' ? (
                      <button
                        type="button"
                        onClick={() =>
                          void onToggleCheckIn(
                            p.bibNumber || p._id,
                            Boolean(p.checkedIn),
                          )
                        }
                        className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer min-h-[30px]',
                          p.checkedIn
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300',
                        )}
                      >
                        <Check
                          size={11}
                          className={
                            p.checkedIn
                              ? 'text-emerald-700 stroke-[3]'
                              : 'text-slate-400'
                          }
                        />
                        {p.checkedIn ? 'Checked In' : 'Check In'}
                      </button>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {editMode ? (
                      <EditableSelect
                        value={currentTshirt}
                        isDirty={draft.tshirt !== undefined}
                        options={TSHIRT_SIZES.map((s) => ({
                          label: s,
                          value: s,
                        }))}
                        onChange={(val) =>
                          updateDraft(p._id, 'tshirt', val)
                        }
                      />
                    ) : (
                      p.tshirt || '—'
                    )}
                  </td>
                  <td
                    className="px-4 py-3 text-slate-500 whitespace-nowrap"
                    title={p.school}
                  >
                    {editMode ? (
                      <EditableText
                        value={currentSchool}
                        isDirty={draft.school !== undefined}
                        placeholder="School name"
                        onChange={(val) =>
                          updateDraft(p._id, 'school', val)
                        }
                        onEnter={() => void handleSaveRow(p._id, currentChildName)}
                      />
                    ) : (
                      p.school || '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {editMode ? (
                      <EditableText
                        value={currentGuardianName}
                        isDirty={draft.guardianName !== undefined}
                        onChange={(val) =>
                          updateDraft(p._id, 'guardianName', val)
                        }
                        onEnter={() => void handleSaveRow(p._id, currentChildName)}
                      />
                    ) : (
                      p.guardianName
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                    {editMode ? (
                      <EditableText
                        value={currentGuardianPhone}
                        isDirty={draft.guardianPhone !== undefined}
                        onChange={(val) =>
                          updateDraft(p._id, 'guardianPhone', val)
                        }
                        onEnter={() => void handleSaveRow(p._id, currentChildName)}
                      />
                    ) : (
                      p.guardianPhone
                    )}
                  </td>
                  <td
                    className="px-4 py-3 text-slate-500 whitespace-nowrap"
                    title={p.guardianEmail}
                  >
                    {editMode ? (
                      <EditableText
                        value={currentGuardianEmail}
                        isDirty={draft.guardianEmail !== undefined}
                        onChange={(val) =>
                          updateDraft(p._id, 'guardianEmail', val)
                        }
                        onEnter={() => void handleSaveRow(p._id, currentChildName)}
                      />
                    ) : (
                      p.guardianEmail
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {formatDate(p.createdAt)}
                  </td>
                  {editMode && (
                    <td
                      className="px-4 py-3 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          id={`save-participant-${p._id}`}
                          onClick={() => void handleSaveRow(p._id, currentChildName)}
                          disabled={
                            !isRowDirty ||
                            savingId === p._id ||
                            savingAll
                          }
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all shadow-xs cursor-pointer',
                            isRowDirty
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-1 ring-emerald-500 shadow-sm'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200',
                          )}
                          title={
                            isRowDirty
                              ? 'Save changes to this participant'
                              : 'No pending edits'
                          }
                        >
                          {savingId === p._id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Save size={12} />
                          )}
                          Save
                        </button>
                        {isRowDirty && (
                          <button
                            type="button"
                            onClick={() => handleDiscardRow(p._id)}
                            disabled={savingId === p._id || savingAll}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="Discard unsaved edits on this row"
                          >
                            <RotateCcw size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>,
              ]

              if (expanded === p._id) {
                rows.push(
                  <tr key={`${p._id}-expanded`}>
                    <td colSpan={editMode ? 13 : 12} className="p-0">
                      <div className="bg-slate-50 px-6 py-4 border-t border-b border-slate-200">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                          <div>
                            <span className="text-slate-400 block font-medium">
                              Date of Birth
                            </span>
                            <span className="text-slate-800 font-medium">
                              {p.dob || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">
                              Relationship
                            </span>
                            {editMode ? (
                              <div className="mt-1">
                                <EditableSelect
                                  value={currentRelation}
                                  isDirty={draft.relation !== undefined}
                                  options={[
                                    { label: 'Parent', value: 'Parent' },
                                    { label: 'Father', value: 'Father' },
                                    { label: 'Mother', value: 'Mother' },
                                    {
                                      label: 'Legal Guardian',
                                      value: 'Legal Guardian',
                                    },
                                    {
                                      label: 'Grandparent',
                                      value: 'Grandparent',
                                    },
                                    {
                                      label: 'Coach / Trainer',
                                      value: 'Coach / Trainer',
                                    },
                                    { label: 'Other', value: 'Other' },
                                  ]}
                                  onChange={(val) =>
                                    updateDraft(p._id, 'relation', val)
                                  }
                                />
                              </div>
                            ) : (
                              <span className="text-slate-800 font-medium">
                                {p.relation || 'Parent'}
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">
                              Participation Consent
                            </span>
                            <span
                              className={
                                p.consentParticipation
                                  ? 'text-emerald-700 font-medium'
                                  : 'text-red-600 font-medium'
                              }
                            >
                              {p.consentParticipation ? 'Granted' : 'Declined'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">
                              Medical / Photo Consent
                            </span>
                            <span className="text-slate-800 font-medium">
                              Med: {p.consentMedical ? 'Yes' : 'No'} · Photo:{' '}
                              {p.consentPhotos ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">
                              Registration Fee
                            </span>
                            <span className="text-slate-800 font-semibold text-xs">
                              ₹
                              {Number(currentPaymentAmount).toLocaleString(
                                'en-IN',
                              )}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">
                              Payment Mode / ID
                            </span>
                            <span className="text-slate-800 font-medium text-xs font-mono">
                              {p.payment?.paymentId || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">
                              Entry Source
                            </span>
                            <span className="text-slate-800 font-medium text-xs">
                              {p.isManual ? 'Manual Entry (Admin)' : 'Online Registration'}
                            </span>
                          </div>

                          <div className="col-span-2 sm:col-span-4 mt-1">
                            <span className="text-slate-400 block font-medium">
                              Medical Notes
                            </span>
                            {editMode ? (
                              <div className="mt-1">
                                <EditableText
                                  value={currentMedicalNotes}
                                  isDirty={draft.medicalNotes !== undefined}
                                  placeholder="Add medical notes…"
                                  onChange={(val) =>
                                    updateDraft(p._id, 'medicalNotes', val)
                                  }
                                  onEnter={() => void handleSaveRow(p._id, currentChildName)}
                                />
                              </div>
                            ) : (
                              <p className="text-slate-800 mt-1 bg-white p-2.5 rounded border border-slate-200">
                                {p.medicalNotes || 'None recorded'}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>,
                )
              }
              return rows
            })}
          </tbody>
        </table>
      </div>

      <AddStudentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={(newDoc) => onAddParticipant?.(newDoc)}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Heat Sheets & Race Day View
// ─────────────────────────────────────────────────────────────────────────────

function HeatSheetsView({
  participants,
  onToggleCheckIn,
}: {
  participants: Participant[]
  onToggleCheckIn?: (
    idOrBib: string | number,
    currentCheckedIn: boolean,
  ) => Promise<void>
}) {
  const [selectedCat, setSelectedCat] = useState<string>('all')
  const [search, setSearch] = useState<string>('')

  // Filter only paid participants with bib assigned
  const paidWithBib = participants.filter(
    (p) => p.bibNumber && (p.payment?.status || '').toLowerCase() === 'paid',
  )

  const categories = [
    { id: 'all', name: 'All Categories' },
    ...CATEGORIES.map((c) => ({ id: c.name, name: c.name })),
  ]

  const filtered = paidWithBib.filter((p) => {
    if (selectedCat !== 'all' && p.category !== selectedCat) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      String(p.bibNumber || '').includes(q) ||
      p.childName.toLowerCase().includes(q) ||
      (p.school || '').toLowerCase().includes(q) ||
      String(p.heat || '').includes(q) ||
      (p.course || '').toLowerCase().includes(q)
    )
  })

  // Group by category, then by heat
  const grouped: Record<string, Record<number, Participant[]>> = {}
  for (const p of filtered) {
    const cat = p.category || 'Uncategorized'
    if (!grouped[cat]) grouped[cat] = {}
    const h = p.heat || 1
    if (!grouped[cat][h]) grouped[cat][h] = []
    grouped[cat][h].push(p)
  }

  // Sort athletes within each heat by bibNumber
  for (const cat of Object.keys(grouped)) {
    for (const h of Object.keys(grouped[cat])) {
      grouped[cat][Number(h)].sort(
        (a, b) => (a.bibNumber || 0) - (b.bibNumber || 0),
      )
    }
  }

  const checkedInTotal = paidWithBib.filter((p) => p.checkedIn).length

  const handleExportHeatSheets = () => {
    const rows: Record<string, unknown>[] = []
    for (const cat of Object.keys(grouped)) {
      const heatNums = Object.keys(grouped[cat])
        .map(Number)
        .sort((a, b) => a - b)
      for (const h of heatNums) {
        for (const p of grouped[cat][h]) {
          rows.push({
            category: cat,
            heat: `Heat ${h}`,
            course: p.course || (h % 2 !== 0 ? 'Course A' : 'Course B'),
            bibNumber: `#${p.bibNumber}`,
            childName: p.childName,
            dob: p.dob,
            gender: p.gender,
            school: p.school || 'Individual',
            tshirt: p.tshirt,
            guardianName: p.guardianName,
            guardianPhone: p.guardianPhone,
            guardianEmail: p.guardianEmail,
            checkedIn: p.checkedIn ? 'Yes' : 'No',
            checkedInAt: p.checkedInAt || '',
          })
        }
      }
    }
    exportCsv(rows, 'fitkidrox-heat-sheets.csv', 'heats')
  }

  return (
    <div className="space-y-4">

      {/* Filters Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-2 px-2 sm:mx-0 sm:px-0">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCat(c.id)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer',
                selectedCat === c.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Right actions: Search + Export + Stats */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1 sm:w-60">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search bib #, athlete, school…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-md border border-slate-200 shrink-0">
              Checked In: <strong className="text-emerald-700">{checkedInTotal}</strong>/{paidWithBib.length}
            </span>
            <button
              type="button"
              onClick={handleExportHeatSheets}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold shadow-xs cursor-pointer transition-colors shrink-0"
            >
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Heat Groups */}
      {Object.keys(grouped).length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-sm text-slate-500">
          No heat records found. Verify participant registrations to view official race heats.
        </div>
      ) : (
        Object.entries(grouped).map(([categoryName, heatsObj]) => {
          const heatNums = Object.keys(heatsObj)
            .map(Number)
            .sort((a, b) => a - b)
          return (
            <div key={categoryName} className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>{categoryName}</span>
                  <span className="text-xs font-normal text-slate-500">
                    ({heatNums.reduce((acc, h) => acc + heatsObj[h].length, 0)}{' '}
                    athletes)
                  </span>
                </h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {heatNums.map((heatNum) => {
                  const athletes = heatsObj[heatNum]
                  const courseName =
                    athletes[0]?.course ||
                    (heatNum % 2 !== 0 ? 'Course A' : 'Course B')
                  const isCourseA = courseName.includes('A')
                  const checkedCount = athletes.filter((a) => a.checkedIn).length

                  return (
                    <div
                      key={`${categoryName}-heat-${heatNum}`}
                      className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs"
                    >
                      {/* Heat Card Header */}
                      <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            Heat {heatNum}
                          </span>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-[11px] font-bold border',
                              isCourseA
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-indigo-50 text-indigo-800 border-indigo-200',
                            )}
                          >
                            {courseName}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 font-medium">
                          <span className="text-emerald-700 font-bold">
                            {checkedCount}
                          </span>{' '}
                          / {athletes.length} Checked In
                        </div>
                      </div>

                      {/* Athletes List */}
                      <div className="divide-y divide-slate-100">
                        {athletes.map((ath) => (
                          <div
                            key={ath._id}
                            className={cn(
                              'p-3 flex items-center justify-between gap-3 text-xs transition-colors',
                              ath.checkedIn
                                ? 'bg-emerald-50/30'
                                : 'hover:bg-slate-50/60',
                            )}
                          >
                            {/* Bib & Name */}
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-slate-900 text-white shadow-xs shrink-0 select-all">
                                #{ath.bibNumber}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-slate-900 truncate">
                                  {ath.childName}{' '}
                                  <span className="text-slate-400 font-normal">
                                    ({ath.gender})
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                                  <span>{ath.school || 'Individual'}</span>
                                  <span className="text-slate-300">·</span>
                                  <span>{ath.tshirt}</span>
                                </div>
                              </div>
                            </div>

                            {/* Actions & Call */}
                            <div className="flex items-center gap-2 shrink-0">
                              <a
                                href={`tel:${ath.guardianPhone}`}
                                title={`Call parent: ${ath.guardianName}`}
                                className="size-7 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
                              >
                                <Phone size={12} />
                              </a>
                              {onToggleCheckIn && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void onToggleCheckIn(
                                      ath.bibNumber || ath._id,
                                      Boolean(ath.checkedIn),
                                    )
                                  }
                                  className={cn(
                                    'inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer min-h-[30px]',
                                    ath.checkedIn
                                      ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300',
                                  )}
                                >
                                  <Check
                                    size={11}
                                    className={
                                      ath.checkedIn
                                        ? 'stroke-[3]'
                                        : 'text-slate-400'
                                  }
                                />
                                  {ath.checkedIn ? 'Ready' : 'Check In'}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Schools Table
// ─────────────────────────────────────────────────────────────────────────────

function SchoolsTable({
  data,
  editMode,
  onToggleEditMode,
  onUpdate,
}: {
  data: School[]
  editMode: boolean
  onToggleEditMode: () => void
  onUpdate: (id: string, updates: Partial<School>) => Promise<void>
}) {
  const { query, setQuery, sorted, sortKey, sortDir, handleSort } =
    useSortFilter(data as unknown as Record<string, unknown>[])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Partial<School>>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savingAll, setSavingAll] = useState(false)

  const dirtyCount = Object.keys(drafts).length

  const updateDraft = (id: string, field: keyof School, val: unknown) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: val,
      },
    }))
  }

  const handleDiscardRow = (id: string) => {
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const handleDiscardAll = () => {
    setDrafts({})
  }

  const handleSaveRow = async (id: string, name: string) => {
    const patch = drafts[id]
    if (!patch || Object.keys(patch).length === 0) return
    setSavingId(id)
    try {
      await onUpdate(id, patch)
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      toast.success('Changes saved successfully!', {
        description: `${name || 'School'} has been updated in the database.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save changes'
      toast.error('Save failed', { description: msg })
    } finally {
      setSavingId(null)
    }
  }

  const handleSaveAll = async () => {
    const ids = Object.keys(drafts)
    if (ids.length === 0) return
    setSavingAll(true)
    let savedCount = 0
    try {
      for (const id of ids) {
        await onUpdate(id, drafts[id])
        savedCount++
      }
      setDrafts({})
      toast.success('Changes saved successfully!', {
        description: `Saved changes to ${savedCount} ${savedCount === 1 ? 'school' : 'schools'}.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save all changes'
      toast.error('Save failed', { description: msg })
    } finally {
      setSavingAll(false)
    }
  }

  const handleToggle = () => {
    if (editMode && dirtyCount > 0) {
      if (
        !window.confirm(
          `You have ${dirtyCount} unsaved ${dirtyCount === 1 ? 'row' : 'rows'}. Exit edit mode and discard?`,
        )
      ) {
        return
      }
      setDrafts({})
    }
    onToggleEditMode()
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      {/* Toolbar */}
      <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            id="schools-search"
            type="text"
            placeholder="Search schools, coordinator, city…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 sm:py-1.5 text-sm sm:text-xs rounded-md border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500">
            {sorted.length} {sorted.length === 1 ? 'school' : 'schools'}
          </span>
          <div className="flex items-center gap-2 flex-1 sm:flex-none justify-end">
            <button
              id="schools-edit-btn"
              onClick={handleToggle}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 border rounded-md text-xs font-semibold transition-all shadow-xs cursor-pointer min-h-[34px] flex-1 sm:flex-none',
                editMode
                  ? 'border-amber-500 bg-amber-500 text-white hover:bg-amber-600 ring-2 ring-amber-300'
                  : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-50',
              )}
              title="Toggle Edit Mode"
            >
              <Pencil size={13} className={editMode ? 'animate-bounce' : ''} />
              {editMode ? 'Edit Mode ON' : 'Edit Mode'}
            </button>
            <button
              id="schools-export-btn"
              onClick={() =>
                exportCsv(sorted as unknown as object[], 'schools.csv', 'schools')
              }
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 border border-slate-300 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer min-h-[34px] flex-1 sm:flex-none"
            >
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {editMode && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-3 sm:px-4 py-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start sm:items-center gap-2">
            <Pencil size={13} className="text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <span className="leading-tight">
              <strong>Edit Mode Active:</strong> Edit school records. Click <strong className="text-emerald-700">Save</strong> to commit.
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
            {dirtyCount > 0 && (
              <>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-200 text-amber-900">
                  {dirtyCount} unsaved
                </span>
                <button
                  type="button"
                  id="schools-save-all-btn"
                  onClick={handleSaveAll}
                  disabled={savingAll}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-xs cursor-pointer transition-all disabled:opacity-50 min-h-[30px]"
                >
                  {savingAll ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Save size={12} />
                  )}
                  Save All ({dirtyCount})
                </button>
                <button
                  type="button"
                  onClick={handleDiscardAll}
                  disabled={savingAll}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-rose-600 hover:bg-white rounded-md text-xs font-medium cursor-pointer transition-colors min-h-[30px]"
                >
                  <RotateCcw size={12} /> Discard All
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleToggle}
              className="font-semibold text-amber-900 underline hover:text-amber-700 cursor-pointer ml-auto sm:ml-2"
            >
              Done editing
            </button>
          </div>
        </div>
      )}

      {/* Mobile Card List (md:hidden) */}
      <div className="divide-y divide-slate-100 md:hidden">
        {sorted.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No schools found.
          </div>
        ) : (
          (sorted as unknown as School[]).map((sc) => {
            const draft = drafts[sc._id] || {}
            const isRowDirty = Object.keys(draft).length > 0
            const currentSchoolName = draft.schoolName !== undefined ? draft.schoolName : sc.schoolName
            const currentCity = draft.city !== undefined ? draft.city : sc.city
            const currentCoordinator = draft.coordinator !== undefined ? draft.coordinator : sc.coordinator
            const currentPhone = draft.phone !== undefined ? draft.phone : sc.phone
            const currentEmail = draft.email !== undefined ? draft.email : sc.email
            const currentParticipants = draft.participants !== undefined ? draft.participants : sc.participants ?? 0

            return (
              <div
                key={`mobile-sc-${sc._id}`}
                className={cn(
                  'p-3.5 sm:p-4 transition-colors bg-white',
                  isRowDirty ? 'ring-1 ring-amber-300 bg-amber-50/20' : '',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(sc.reference, 'Reference ID')}
                    className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded border border-slate-200 transition-colors"
                  >
                    {sc.reference}
                  </button>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {currentParticipants} students
                  </span>
                </div>

                <div className="mt-2.5">
                  <h4 className="text-sm font-bold text-slate-900">{currentSchoolName}</h4>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {currentCity} · Coord: {currentCoordinator}
                  </div>
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500 text-[11px] truncate flex-1 min-w-0 mr-2">{currentEmail}</span>
                  <a
                    href={`tel:${currentPhone}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono text-xs font-semibold shrink-0 min-h-[32px]"
                  >
                    <Phone size={11} className="text-slate-600" />
                    {currentPhone}
                  </a>
                </div>

                {editMode && (
                  <div className="mt-3 pt-3 border-t border-amber-200/60 space-y-2.5 bg-amber-50/40 -mx-3.5 -mb-3.5 p-3.5 rounded-b-lg sm:-mx-4 sm:-mb-4 sm:p-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">School Name</label>
                        <EditableText
                          value={currentSchoolName}
                          isDirty={draft.schoolName !== undefined}
                          onChange={(val) => updateDraft(sc._id, 'schoolName', val)}
                          className="w-full text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">City</label>
                        <EditableText
                          value={currentCity}
                          isDirty={draft.city !== undefined}
                          onChange={(val) => updateDraft(sc._id, 'city', val)}
                          className="w-full text-xs"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Coordinator</label>
                        <EditableText
                          value={currentCoordinator}
                          isDirty={draft.coordinator !== undefined}
                          onChange={(val) => updateDraft(sc._id, 'coordinator', val)}
                          className="w-full text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Students</label>
                        <EditableText
                          type="number"
                          value={currentParticipants}
                          isDirty={draft.participants !== undefined}
                          onChange={(val) => updateDraft(sc._id, 'participants', val === '' ? '' : Number(val))}
                          className="w-full text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => void handleSaveRow(sc._id, currentSchoolName)}
                        disabled={!isRowDirty || savingId === sc._id || savingAll}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold shadow-xs cursor-pointer min-h-[32px]',
                          isRowDirty
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed',
                        )}
                      >
                        {savingId === sc._id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Save Changes
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Desktop Table View (hidden md:block) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead>
            <tr>
              <Th
                label="Ref"
                field="reference"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="School Name"
                field="schoolName"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="City"
                field="city"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Coordinator"
                field="coordinator"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Phone"
                field="phone"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Email"
                field="email"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Approx. Students"
                field="participants"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Registered"
                field="createdAt"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              {editMode && (
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Action
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={editMode ? 9 : 8}
                  className="py-12 text-center text-sm text-slate-500"
                >
                  No schools found.
                </td>
              </tr>
            )}
            {(sorted as unknown as School[]).flatMap((sc) => {
              const draft = drafts[sc._id] || {}
              const isRowDirty = Object.keys(draft).length > 0
              const currentSchoolName =
                draft.schoolName !== undefined
                  ? draft.schoolName
                  : sc.schoolName
              const currentCity =
                draft.city !== undefined ? draft.city : sc.city || ''
              const currentCoordinator =
                draft.coordinator !== undefined
                  ? draft.coordinator
                  : sc.coordinator
              const currentPhone =
                draft.phone !== undefined ? draft.phone : sc.phone
              const currentEmail =
                draft.email !== undefined ? draft.email : sc.email
              const currentParticipants =
                draft.participants !== undefined
                  ? draft.participants
                  : sc.participants

              const rows = [
                <tr
                  key={sc._id}
                  onClick={() =>
                    setExpanded(expanded === sc._id ? null : sc._id)
                  }
                  className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                    expanded === sc._id ? 'bg-slate-50/70' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        copyToClipboard(sc.reference, 'Reference ID')
                      }}
                      title="Click to copy reference"
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 transition-colors cursor-pointer"
                    >
                      {sc.reference}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                    {editMode ? (
                      <EditableText
                        value={currentSchoolName}
                        isDirty={draft.schoolName !== undefined}
                        onChange={(val) =>
                          updateDraft(sc._id, 'schoolName', val)
                        }
                        onEnter={() => void handleSaveRow(sc._id, currentSchoolName)}
                      />
                    ) : (
                      sc.schoolName
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {editMode ? (
                      <EditableText
                        value={currentCity}
                        isDirty={draft.city !== undefined}
                        placeholder="City / Region"
                        onChange={(val) => updateDraft(sc._id, 'city', val)}
                        onEnter={() => void handleSaveRow(sc._id, currentSchoolName)}
                      />
                    ) : (
                      sc.city || '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {editMode ? (
                      <EditableText
                        value={currentCoordinator}
                        isDirty={draft.coordinator !== undefined}
                        onChange={(val) =>
                          updateDraft(sc._id, 'coordinator', val)
                        }
                        onEnter={() => void handleSaveRow(sc._id, currentSchoolName)}
                      />
                    ) : (
                      sc.coordinator
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                    {editMode ? (
                      <EditableText
                        value={currentPhone}
                        isDirty={draft.phone !== undefined}
                        onChange={(val) => updateDraft(sc._id, 'phone', val)}
                        onEnter={() => void handleSaveRow(sc._id, currentSchoolName)}
                      />
                    ) : (
                      sc.phone
                    )}
                  </td>
                  <td
                    className="px-4 py-3 text-slate-500 whitespace-nowrap"
                    title={sc.email}
                  >
                    {editMode ? (
                      <EditableText
                        value={currentEmail}
                        isDirty={draft.email !== undefined}
                        onChange={(val) => updateDraft(sc._id, 'email', val)}
                        onEnter={() => void handleSaveRow(sc._id, currentSchoolName)}
                      />
                    ) : (
                      sc.email
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {editMode ? (
                      <EditableText
                        type="number"
                        value={currentParticipants}
                        isDirty={draft.participants !== undefined}
                        onChange={(val) =>
                          updateDraft(
                            sc._id,
                            'participants',
                            Math.max(1, parseInt(val, 10) || 1),
                          )
                        }
                        onEnter={() => void handleSaveRow(sc._id, currentSchoolName)}
                      />
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800">
                        {sc.participants} students
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {formatDate(sc.createdAt)}
                  </td>
                  {editMode && (
                    <td
                      className="px-4 py-3 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          id={`save-school-${sc._id}`}
                          onClick={() => void handleSaveRow(sc._id, currentSchoolName)}
                          disabled={
                            !isRowDirty ||
                            savingId === sc._id ||
                            savingAll
                          }
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all shadow-xs cursor-pointer',
                            isRowDirty
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-1 ring-emerald-500 shadow-sm'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200',
                          )}
                          title={
                            isRowDirty
                              ? 'Save changes to this school'
                              : 'No pending edits'
                          }
                        >
                          {savingId === sc._id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Save size={12} />
                          )}
                          Save
                        </button>
                        {isRowDirty && (
                          <button
                            type="button"
                            onClick={() => handleDiscardRow(sc._id)}
                            disabled={savingId === sc._id || savingAll}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="Discard unsaved edits on this row"
                          >
                            <RotateCcw size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>,
              ]

              if (expanded === sc._id) {
                rows.push(
                  <tr key={`${sc._id}-detail`}>
                    <td colSpan={editMode ? 9 : 8} className="p-0">
                      <div className="bg-slate-50 px-6 py-4 border-t border-b border-slate-200">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                          <div>
                            <span className="text-slate-400 block font-medium">
                              School Name
                            </span>
                            <span className="text-slate-800 font-medium">
                              {sc.schoolName}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">
                              City / Region
                            </span>
                            <span className="text-slate-800 font-medium">
                              {sc.city || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">
                              Sports Coordinator
                            </span>
                            <span className="text-slate-800 font-medium">
                              {sc.coordinator}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">
                              Approx. Students
                            </span>
                            <span className="text-slate-800 font-medium">
                              {sc.participants} students
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>,
                )
              }
              return rows
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sponsors Table
// ─────────────────────────────────────────────────────────────────────────────

function SponsorsTable({
  data,
  editMode,
  onToggleEditMode,
  onUpdate,
}: {
  data: Sponsor[]
  editMode: boolean
  onToggleEditMode: () => void
  onUpdate: (id: string, updates: Partial<Sponsor>) => Promise<void>
}) {
  const { query, setQuery, sorted, sortKey, sortDir, handleSort } =
    useSortFilter(data as unknown as Record<string, unknown>[])
  const [drafts, setDrafts] = useState<Record<string, Partial<Sponsor>>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savingAll, setSavingAll] = useState(false)

  const dirtyCount = Object.keys(drafts).length

  const updateDraft = (id: string, field: keyof Sponsor, val: unknown) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: val,
      },
    }))
  }

  const handleDiscardRow = (id: string) => {
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const handleDiscardAll = () => {
    setDrafts({})
  }

  const handleSaveRow = async (id: string, name: string) => {
    const patch = drafts[id]
    if (!patch || Object.keys(patch).length === 0) return
    setSavingId(id)
    try {
      await onUpdate(id, patch)
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      toast.success('Changes saved successfully!', {
        description: `${name || 'Sponsor'} has been updated in the database.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save changes'
      toast.error('Save failed', { description: msg })
    } finally {
      setSavingId(null)
    }
  }

  const handleSaveAll = async () => {
    const ids = Object.keys(drafts)
    if (ids.length === 0) return
    setSavingAll(true)
    let savedCount = 0
    try {
      for (const id of ids) {
        await onUpdate(id, drafts[id])
        savedCount++
      }
      setDrafts({})
      toast.success('Changes saved successfully!', {
        description: `Saved changes to ${savedCount} ${savedCount === 1 ? 'sponsor' : 'sponsors'}.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save all changes'
      toast.error('Save failed', { description: msg })
    } finally {
      setSavingAll(false)
    }
  }

  const handleToggle = () => {
    if (editMode && dirtyCount > 0) {
      if (
        !window.confirm(
          `You have ${dirtyCount} unsaved ${dirtyCount === 1 ? 'row' : 'rows'}. Exit edit mode and discard?`,
        )
      ) {
        return
      }
      setDrafts({})
    }
    onToggleEditMode()
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      {/* Toolbar */}
      <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            id="sponsors-search"
            type="text"
            placeholder="Search company, contact, package…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 sm:py-1.5 text-sm sm:text-xs rounded-md border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500">
            {sorted.length} {sorted.length === 1 ? 'sponsor' : 'sponsors'}
          </span>
          <div className="flex items-center gap-2 flex-1 sm:flex-none justify-end">
            <button
              id="sponsors-edit-btn"
              onClick={handleToggle}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 border rounded-md text-xs font-semibold transition-all shadow-xs cursor-pointer min-h-[34px] flex-1 sm:flex-none',
                editMode
                  ? 'border-amber-500 bg-amber-500 text-white hover:bg-amber-600 ring-2 ring-amber-300'
                  : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-50',
              )}
              title="Toggle Edit Mode"
            >
              <Pencil size={13} className={editMode ? 'animate-bounce' : ''} />
              {editMode ? 'Edit Mode ON' : 'Edit Mode'}
            </button>
            <button
              id="sponsors-export-btn"
              onClick={() =>
                exportCsv(
                  sorted as unknown as object[],
                  'sponsors.csv',
                  'sponsors',
                )
              }
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 border border-slate-300 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer min-h-[34px] flex-1 sm:flex-none"
            >
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {editMode && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-3 sm:px-4 py-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start sm:items-center gap-2">
            <Pencil size={13} className="text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <span className="leading-tight">
              <strong>Edit Mode Active:</strong> Edit sponsor records. Click <strong className="text-emerald-700">Save</strong> to commit.
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
            {dirtyCount > 0 && (
              <>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-200 text-amber-900">
                  {dirtyCount} unsaved
                </span>
                <button
                  type="button"
                  id="sponsors-save-all-btn"
                  onClick={handleSaveAll}
                  disabled={savingAll}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-xs cursor-pointer transition-all disabled:opacity-50 min-h-[30px]"
                >
                  {savingAll ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Save size={12} />
                  )}
                  Save All ({dirtyCount})
                </button>
                <button
                  type="button"
                  onClick={handleDiscardAll}
                  disabled={savingAll}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-rose-600 hover:bg-white rounded-md text-xs font-medium cursor-pointer transition-colors min-h-[30px]"
                >
                  <RotateCcw size={12} /> Discard All
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleToggle}
              className="font-semibold text-amber-900 underline hover:text-amber-700 cursor-pointer ml-auto sm:ml-2"
            >
              Done editing
            </button>
          </div>
        </div>
      )}

      {/* Mobile Card List (md:hidden) */}
      <div className="divide-y divide-slate-100 md:hidden">
        {sorted.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No sponsors found.
          </div>
        ) : (
          (sorted as unknown as Sponsor[]).map((sp) => {
            const draft = drafts[sp._id] || {}
            const isRowDirty = Object.keys(draft).length > 0
            const currentCompany = draft.company !== undefined ? draft.company : sp.company
            const currentContact = draft.contact !== undefined ? draft.contact : sp.contact
            const currentPhone = draft.phone !== undefined ? draft.phone : sp.phone
            const currentEmail = draft.email !== undefined ? draft.email : sp.email
            const currentPackageId = draft.packageId !== undefined ? draft.packageId : sp.packageId
            const currentPkg = SPONSOR_PACKAGES.find((pkg) => pkg.id === currentPackageId)
            const packageLabel = currentPkg ? currentPkg.name : currentPackageId

            return (
              <div
                key={`mobile-sp-${sp._id}`}
                className={cn(
                  'p-3.5 sm:p-4 transition-colors bg-white',
                  isRowDirty ? 'ring-1 ring-amber-300 bg-amber-50/20' : '',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(sp.reference, 'Reference ID')}
                    className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded border border-slate-200 transition-colors"
                  >
                    {sp.reference}
                  </button>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    {packageLabel}
                  </span>
                </div>

                <div className="mt-2.5">
                  <h4 className="text-sm font-bold text-slate-900">{currentCompany}</h4>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Contact: {currentContact}
                  </div>
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500 text-[11px] truncate flex-1 min-w-0 mr-2">{currentEmail}</span>
                  <a
                    href={`tel:${currentPhone}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono text-xs font-semibold shrink-0 min-h-[32px]"
                  >
                    <Phone size={11} className="text-slate-600" />
                    {currentPhone}
                  </a>
                </div>

                {editMode && (
                  <div className="mt-3 pt-3 border-t border-amber-200/60 space-y-2.5 bg-amber-50/40 -mx-3.5 -mb-3.5 p-3.5 rounded-b-lg sm:-mx-4 sm:-mb-4 sm:p-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Company</label>
                        <EditableText
                          value={currentCompany}
                          isDirty={draft.company !== undefined}
                          onChange={(val) => updateDraft(sp._id, 'company', val)}
                          className="w-full text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Package</label>
                        <EditableSelect
                          value={currentPackageId}
                          isDirty={draft.packageId !== undefined}
                          options={SPONSOR_PACKAGES.map((pkg) => ({
                            label: `${pkg.name} (${pkg.slots})`,
                            value: pkg.id,
                          }))}
                          onChange={(val) => updateDraft(sp._id, 'packageId', val)}
                          className="w-full text-xs"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Contact</label>
                        <EditableText
                          value={currentContact}
                          isDirty={draft.contact !== undefined}
                          onChange={(val) => updateDraft(sp._id, 'contact', val)}
                          className="w-full text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Phone</label>
                        <EditableText
                          value={currentPhone}
                          isDirty={draft.phone !== undefined}
                          onChange={(val) => updateDraft(sp._id, 'phone', val)}
                          className="w-full text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => void handleSaveRow(sp._id, currentCompany)}
                        disabled={!isRowDirty || savingId === sp._id || savingAll}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold shadow-xs cursor-pointer min-h-[32px]',
                          isRowDirty
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed',
                        )}
                      >
                        {savingId === sp._id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Save Changes
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Desktop Table View (hidden md:block) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead>
            <tr>
              <Th
                label="Ref"
                field="reference"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Company"
                field="company"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Contact Person"
                field="contact"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Email"
                field="email"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Phone"
                field="phone"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Package"
                field="packageId"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Message"
                field="message"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Submitted"
                field="createdAt"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              {editMode && (
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Action
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={editMode ? 9 : 8}
                  className="py-12 text-center text-sm text-slate-500"
                >
                  No sponsors found.
                </td>
              </tr>
            )}
            {(sorted as unknown as Sponsor[]).map((sp) => {
              const draft = drafts[sp._id] || {}
              const isRowDirty = Object.keys(draft).length > 0
              const currentCompany =
                draft.company !== undefined ? draft.company : sp.company
              const currentContact =
                draft.contact !== undefined ? draft.contact : sp.contact
              const currentEmail =
                draft.email !== undefined ? draft.email : sp.email
              const currentPhone =
                draft.phone !== undefined ? draft.phone : sp.phone
              const currentPackageId =
                draft.packageId !== undefined ? draft.packageId : sp.packageId
              const currentMessage =
                draft.message !== undefined ? draft.message : sp.message || ''

              return (
                <tr
                  key={sp._id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        copyToClipboard(sp.reference, 'Reference ID')
                      }}
                      title="Click to copy reference"
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 transition-colors cursor-pointer"
                    >
                      {sp.reference}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                    {editMode ? (
                      <EditableText
                        value={currentCompany}
                        isDirty={draft.company !== undefined}
                        onChange={(val) =>
                          updateDraft(sp._id, 'company', val)
                        }
                        onEnter={() => void handleSaveRow(sp._id, currentCompany)}
                      />
                    ) : (
                      sp.company
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {editMode ? (
                      <EditableText
                        value={currentContact}
                        isDirty={draft.contact !== undefined}
                        onChange={(val) =>
                          updateDraft(sp._id, 'contact', val)
                        }
                        onEnter={() => void handleSaveRow(sp._id, currentCompany)}
                      />
                    ) : (
                      sp.contact
                    )}
                  </td>
                  <td
                    className="px-4 py-3 text-slate-500 whitespace-nowrap"
                    title={sp.email}
                  >
                    {editMode ? (
                      <EditableText
                        value={currentEmail}
                        isDirty={draft.email !== undefined}
                        onChange={(val) =>
                          updateDraft(sp._id, 'email', val)
                        }
                        onEnter={() => void handleSaveRow(sp._id, currentCompany)}
                      />
                    ) : (
                      sp.email
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                    {editMode ? (
                      <EditableText
                        value={currentPhone}
                        isDirty={draft.phone !== undefined}
                        onChange={(val) =>
                          updateDraft(sp._id, 'phone', val)
                        }
                        onEnter={() => void handleSaveRow(sp._id, currentCompany)}
                      />
                    ) : (
                      sp.phone
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {editMode ? (
                      <EditableSelect
                        value={currentPackageId}
                        isDirty={draft.packageId !== undefined}
                        options={SPONSOR_PACKAGES.map((p) => ({
                          label: `${p.name} (${p.slots})`,
                          value: p.id,
                        }))}
                        onChange={(val) =>
                          updateDraft(sp._id, 'packageId', val)
                        }
                      />
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                        {sp.packageId}
                      </span>
                    )}
                  </td>
                  <td
                    className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap"
                    title={sp.message}
                  >
                    {editMode ? (
                      <EditableText
                        value={currentMessage}
                        isDirty={draft.message !== undefined}
                        placeholder="Message…"
                        onChange={(val) =>
                          updateDraft(sp._id, 'message', val)
                        }
                        onEnter={() => void handleSaveRow(sp._id, currentCompany)}
                      />
                    ) : (
                      sp.message || '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {formatDate(sp.createdAt)}
                  </td>
                  {editMode && (
                    <td
                      className="px-4 py-3 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          id={`save-sponsor-${sp._id}`}
                          onClick={() => void handleSaveRow(sp._id, currentCompany)}
                          disabled={
                            !isRowDirty ||
                            savingId === sp._id ||
                            savingAll
                          }
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all shadow-xs cursor-pointer',
                            isRowDirty
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-1 ring-emerald-500 shadow-sm'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200',
                          )}
                          title={
                            isRowDirty
                              ? 'Save changes to this sponsor'
                              : 'No pending edits'
                          }
                        >
                          {savingId === sp._id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Save size={12} />
                          )}
                          Save
                        </button>
                        {isRowDirty && (
                          <button
                            type="button"
                            onClick={() => handleDiscardRow(sp._id)}
                            disabled={savingId === sp._id || savingAll}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="Discard unsaved edits on this row"
                          >
                            <RotateCcw size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Component (Clean, Plain White Theme)
// ─────────────────────────────────────────────────────────────────────────────

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('participants')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [editMode, setEditMode] = useState(false)

  const reload = async () => {
    setRefreshing(true)
    setError('')
    try {
      const [p, sc, sp] = await Promise.all([
        apiCollection<Participant>('participants'),
        apiCollection<School>('schools'),
        apiCollection<Sponsor>('sponsors'),
      ])
      setParticipants(p)
      setSchools(sc)
      setSponsors(sp)
      toast.success('Data refreshed', {
        description: `Loaded ${p.length} participants, ${sc.length} schools, and ${sp.length} sponsors.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load data'
      setError(msg)
      toast.error('Refresh failed', { description: msg })
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([
      apiCollection<Participant>('participants'),
      apiCollection<School>('schools'),
      apiCollection<Sponsor>('sponsors'),
    ])
      .then(([p, sc, sp]) => {
        if (!active) return
        setParticipants(p)
        setSchools(sc)
        setSponsors(sp)
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load data')
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const handleUpdateParticipant = async (
    id: string,
    updates: Partial<Participant>,
  ) => {
    const updated = await apiUpdateRecord<Participant>(
      'participants',
      id,
      updates,
    )
    setParticipants((prev) =>
      prev.map((p) => (p._id === id ? { ...p, ...updated } : p)),
    )
  }

  const handleAddParticipant = (newDoc: Participant) => {
    setParticipants((prev) => [newDoc, ...prev])
  }

  const handleToggleCheckIn = async (
    idOrBib: string | number,
    currentCheckedIn: boolean,
  ) => {
    try {
      const res = await fetch(`/api/admin/participants/${idOrBib}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkedIn: !currentCheckedIn }),
      })
      if (!res.ok) throw new Error('Failed to update check-in status')
      const data = (await res.json()) as { ok: boolean; doc: Participant }
      setParticipants((prev) =>
        prev.map((p) =>
          p._id === data.doc._id || p.bibNumber === data.doc.bibNumber
            ? {
                ...p,
                checkedIn: data.doc.checkedIn,
                checkedInAt: data.doc.checkedInAt,
              }
            : p,
        ),
      )
      toast.success(
        data.doc.checkedIn ? 'Athlete Checked In' : 'Check-in Revoked',
        {
          description: `${data.doc.childName} (Bib #${data.doc.bibNumber || '—'})`,
        },
      )
    } catch (err) {
      toast.error('Check-in error', {
        description:
          err instanceof Error ? err.message : 'Could not update check-in',
      })
    }
  }

  const handleUpdateSchool = async (id: string, updates: Partial<School>) => {
    const updated = await apiUpdateRecord<School>('schools', id, updates)
    setSchools((prev) =>
      prev.map((s) => (s._id === id ? { ...s, ...updated } : s)),
    )
  }

  const handleUpdateSponsor = async (id: string, updates: Partial<Sponsor>) => {
    const updated = await apiUpdateRecord<Sponsor>('sponsors', id, updates)
    setSponsors((prev) =>
      prev.map((sp) => (sp._id === id ? { ...sp, ...updated } : sp)),
    )
  }

  const handleLogout = async () => {
    await apiLogout()
    toast.success('Signed out', {
      description: 'You have been logged out of the admin panel.',
    })
    onLogout()
  }

  const totalKids =
    participants.length +
    schools.reduce((s, sc) => s + (sc.participants || 0), 0)

  const paidWithBib = participants.filter((p) => p.bibNumber).length

  const tabs: { id: Tab; label: string; count: number }[] = [
    {
      id: 'participants',
      label: 'Participants',
      count: participants.length,
    },
    {
      id: 'heats',
      label: 'Race Heats',
      count: paidWithBib,
    },
    {
      id: 'schools',
      label: 'Schools',
      count: schools.length,
    },
    {
      id: 'sponsors',
      label: 'Sponsors',
      count: sponsors.length,
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="w-full max-w-[1850px] mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 sm:h-16 items-center gap-2">
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
                FITKIDROX
              </span>
              <span className="inline-flex items-center rounded bg-slate-100 px-1.5 sm:px-2 py-0.5 text-[11px] sm:text-xs font-medium text-slate-600">
                Admin
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <button
                id="admin-edit-mode-btn"
                onClick={() => setEditMode((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 border rounded-md text-xs font-semibold transition-all shadow-xs cursor-pointer min-h-[34px]',
                  editMode
                    ? 'border-amber-500 bg-amber-500 text-white hover:bg-amber-600 ring-2 ring-amber-300'
                    : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-50',
                )}
                title="Toggle Edit Mode"
              >
                <Pencil
                  size={13}
                  className={editMode ? 'animate-bounce' : ''}
                />
                <span className="hidden sm:inline">
                  {editMode ? 'Edit Mode ON' : 'Edit Mode'}
                </span>
                <span className="sm:hidden">{editMode ? 'Editing' : 'Edit'}</span>
              </button>
              <button
                id="admin-refresh-btn"
                onClick={() => void reload()}
                disabled={refreshing}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 border border-slate-300 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer min-h-[34px]"
                title="Refresh data"
              >
                <RefreshCw
                  size={13}
                  className={refreshing ? 'animate-spin' : ''}
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                id="admin-logout-btn"
                onClick={() => void handleLogout()}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 border border-slate-300 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors cursor-pointer min-h-[34px]"
                title="Logout"
              >
                <LogOut size={13} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1850px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-2">
            <RefreshCw size={24} className="animate-spin text-slate-400" />
            <p className="text-sm">Loading records…</p>
          </div>
        ) : (
          <>
            {/* 4 Stats Cards (Clean Plain White - 2x2 grid on mobile) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
              <div className="bg-white p-3.5 sm:p-5 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <div className="text-[11px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Participants
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 sm:px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 size={10} className="sm:w-3 sm:h-3" />
                    {
                      participants.filter(
                        (p) =>
                          (p.payment?.status || '').toLowerCase() === 'paid',
                      ).length
                    }{' '}
                    Paid
                  </span>
                </div>
                <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-slate-900">
                  {participants.length.toLocaleString('en-IN')}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 flex-wrap">
                  <span className="text-emerald-700 font-medium">
                    {
                      participants.filter(
                        (p) =>
                          (p.payment?.status || '').toLowerCase() === 'paid',
                      ).length
                    }{' '}
                    paid
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-amber-700 font-medium">
                    {
                      participants.filter(
                        (p) =>
                          (p.payment?.status || 'unpaid').toLowerCase() !==
                          'paid',
                      ).length
                    }{' '}
                    unpaid
                  </span>
                </div>
              </div>

              <div className="bg-white p-3.5 sm:p-5 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
                <div className="text-[11px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Schools
                </div>
                <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-slate-900">
                  {schools.length.toLocaleString('en-IN')}
                </div>
                <div className="mt-1 text-[11px] sm:text-xs text-slate-500 truncate">
                  Bulk delegations
                </div>
              </div>

              <div className="bg-white p-3.5 sm:p-5 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
                <div className="text-[11px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Kids Enrolled
                </div>
                <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-slate-900">
                  {totalKids.toLocaleString('en-IN')}
                </div>
                <div className="mt-1 text-[11px] sm:text-xs text-slate-500 truncate">
                  Individual + Schools
                </div>
              </div>

              <div className="bg-white p-3.5 sm:p-5 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
                <div className="text-[11px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Sponsors
                </div>
                <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-slate-900">
                  {sponsors.length.toLocaleString('en-IN')}
                </div>
                <div className="mt-1 text-[11px] sm:text-xs text-slate-500 truncate">
                  Corporate partners
                </div>
              </div>
            </div>

            {/* Tabs (Horizontal scroll on mobile) */}
            <div className="border-b border-slate-200 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
              <nav className="-mb-px flex space-x-4 sm:space-x-6 min-w-max" aria-label="Tabs">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    id={`admin-tab-${t.id}`}
                    onClick={() => setTab(t.id)}
                    className={`whitespace-nowrap pb-3 px-1 border-b-2 text-xs sm:text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer ${
                      tab === t.id
                        ? 'border-slate-900 text-slate-900'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span>{t.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] sm:text-xs font-medium ${
                        tab === t.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {t.count}
                    </span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Panels */}
            <div>
              {tab === 'participants' && (
                <ParticipantsTable
                  data={participants}
                  editMode={editMode}
                  onToggleEditMode={() => setEditMode((v) => !v)}
                  onUpdate={handleUpdateParticipant}
                  onAddParticipant={handleAddParticipant}
                  onToggleCheckIn={handleToggleCheckIn}
                />
              )}
              {tab === 'heats' && (
                <HeatSheetsView
                  participants={participants}
                  onToggleCheckIn={handleToggleCheckIn}
                />
              )}
              {tab === 'schools' && (
                <SchoolsTable
                  data={schools}
                  editMode={editMode}
                  onToggleEditMode={() => setEditMode((v) => !v)}
                  onUpdate={handleUpdateSchool}
                />
              )}
              {tab === 'sponsors' && (
                <SponsorsTable
                  data={sponsors}
                  editMode={editMode}
                  onToggleEditMode={() => setEditMode((v) => !v)}
                  onUpdate={handleUpdateSponsor}
                />
              )}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 py-4 text-center text-xs text-slate-400 bg-white">
        FITKIDROX Admin Dashboard · Secure Management Portal
      </footer>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Root Admin Page (Session Checker)
// ─────────────────────────────────────────────────────────────────────────────

function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    apiCheckSession()
      .then(setAuthed)
      .catch(() => setAuthed(false))
  }, [])

  if (authed === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-lg p-8 shadow-sm flex flex-col items-center gap-3">
          <RefreshCw size={24} className="animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">Checking credentials…</p>
        </div>
      </div>
    )
  }

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />
  return <Dashboard onLogout={() => setAuthed(false)} />
}
