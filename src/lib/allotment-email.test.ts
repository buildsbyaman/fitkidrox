import { describe, expect, it } from 'vitest'
// @ts-expect-error - import server module in test
import { buildParticipantAllotmentEmail, getMailTransporter, sendParticipantConfirmationEmail } from '../../server/src/lib/mailer.js'

describe('Participant Allotment Email & Safe Mode Simulation', () => {
  const sampleParticipant = {
    _id: '6720f1234567890abcdef123',
    childName: 'Oorvi Devgan',
    dob: '2021-05-15',
    gender: 'Girl',
    category: 'Mini FITKIDROX',
    tshirt: 'S (5-6y)',
    school: 'Oakridge International',
    guardianName: 'Ishan Devgan',
    guardianPhone: '9650053208',
    guardianEmail: 'pjones5@example.com',
    payment: {
      status: 'paid',
      amount: 1250,
      paidAt: new Date().toISOString(),
    },
  }

  it('builds a complete allotment email with Bib, Heat, Course, and details', () => {
    const email = buildParticipantAllotmentEmail({
      participant: sampleParticipant,
      bibNumber: 1002,
      heat: 1,
      course: 'Course A',
    })

    expect(email.recipient).toBe('pjones5@example.com')
    expect(email.bibNumber).toBe(1002)
    expect(email.heat).toBe(1)
    expect(email.course).toBe('Course A')
    expect(email.subject).toContain('Successful Allotment Confirmed: Oorvi Devgan (Bib #1002)')
    expect(email.html).toContain('#1002')
    expect(email.html).toContain('Heat 1')
    expect(email.html).toContain('Course A')
    expect(email.html).toContain('Oorvi Devgan')
    expect(email.html).toContain('Oakridge International')
    expect(email.html).toContain('₹1,250 (Paid)')
    expect(email.text).toContain('Allotment Confirmed, Oorvi!')
    expect(email.text).toContain('Bib Number: #1002')
  })

  it('safely runs in DO-NOT-SEND / simulation mode when EMAIL_DISPATCH_ENABLED is false', async () => {
    const previous = process.env.EMAIL_DISPATCH_ENABLED
    process.env.EMAIL_DISPATCH_ENABLED = 'false'

    try {
      const transporter = getMailTransporter()
      expect(transporter.dispatchEnabled).toBe(false)

      const result = await transporter.sendMail({
        to: 'pjones5@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
        text: 'Test',
      })

      expect(result.simulated).toBe(true)
      expect(result.to).toBe('pjones5@example.com')
      expect(result.messageId).toContain('simulated-')
    } finally {
      process.env.EMAIL_DISPATCH_ENABLED = previous
    }
  })

  it('sendParticipantConfirmationEmail executes safely and returns the full allotment payload', async () => {
    const previous = process.env.EMAIL_DISPATCH_ENABLED
    process.env.EMAIL_DISPATCH_ENABLED = 'false'

    try {
      const res = await sendParticipantConfirmationEmail({
        participant: sampleParticipant,
        bibNumber: 1002,
        heat: 1,
        course: 'Course A',
      })

      expect(res.to).toBe('pjones5@example.com')
      expect(res.bibNumber).toBe(1002)
      expect(res.heat).toBe(1)
      expect(res.course).toBe('Course A')
      expect(res.simulated).toBe(true)
      expect(res.subject).toContain('Bib #1002')
    } finally {
      process.env.EMAIL_DISPATCH_ENABLED = previous
    }
  })
})
