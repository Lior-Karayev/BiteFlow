import { useState } from 'react'
import Modal from '../../components/Modal'

export default function OnboardingResult({ business, onClose, onDispatch }) {
  const [copied, setCopied]     = useState(false)
  const [smsSent, setSmsSent]   = useState(false)
  const [showSmsPreview, setShowSmsPreview] = useState(false)

  const link     = `https://biteflow.app/onboard?restaurant=${business.id}&token=${business.id.slice(0, 8)}`
  const tempPass = business.tempPassword || `BiteFlow@${business.id.slice(0, 4)}`

  const smsBody = `Welcome to BiteFlow!\n\nYour restaurant "${business.name}" has been registered.\n\nTemp password: ${tempPass}\nOnboarding link: ${link}\n\nContact support@biteflow.app for help.`

  function copyLink() {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function sendSMS() {
    if (!business.ownerPhone) return alert('No owner phone number provided.')
    setShowSmsPreview(true)
  }

  function confirmSend() {
    setShowSmsPreview(false)
    setSmsSent(true)
  }

  if (showSmsPreview) {
    return (
      <Modal
        title="📲 SMS Preview"
        onClose={() => setShowSmsPreview(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowSmsPreview(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={confirmSend}>Send SMS</button>
          </>
        }
      >
        <div style={{ marginBottom: 12, fontSize: '0.85rem', color: '#666' }}>
          Sending to: <strong>{business.ownerPhone}</strong>
        </div>
        <div style={{
          background: '#f5f5f5',
          border: '1px solid #e0e0e0',
          borderRadius: 12,
          padding: '14px 16px',
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          color: '#222',
        }}>
          {smsBody}
        </div>
        <div style={{ marginTop: 10, fontSize: '0.78rem', color: '#aaa' }}>
          [Demo mode — no real SMS will be delivered]
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title="✅ Business Registered"
      onClose={onClose}
      footer={
        <>
          {business.ownerPhone && (
            <button className="btn btn-ghost btn-sm" onClick={sendSMS} disabled={smsSent}>
              {smsSent ? '📲 SMS Sent' : '📲 Send SMS to Owner'}
            </button>
          )}
          {onDispatch && (
            <button className="btn btn-ghost btn-sm" onClick={() => onDispatch(business)}>
              🔧 Dispatch Technician
            </button>
          )}
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </>
      }
    >
      <div style={{ fontSize: '0.9rem', lineHeight: 1.9, marginBottom: 16 }}>
        <div><strong>Restaurant:</strong> {business.name}</div>
        {business.ownerName  && <div><strong>Owner:</strong> {business.ownerName}</div>}
        {business.ownerEmail && <div><strong>Email:</strong> {business.ownerEmail}</div>}
        <div>
          <strong>Temp Password:</strong>{' '}
          <code style={{ background: '#f0f0f0', padding: '2px 8px', borderRadius: 4 }}>{tempPass}</code>
        </div>
      </div>

      <div className="info-box">
        <strong>Next steps</strong>
        1. Send the owner the onboarding link below<br />
        2. Dispatch an IT Technician to install the KDS screen<br />
        3. Technician calibrates the invoice printer on-site
      </div>

      <div className="form-group">
        <label>Onboarding Link</label>
        <div className="copy-row">
          <input readOnly value={link} />
          <button className="btn btn-secondary btn-sm" onClick={copyLink}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {smsSent && <div className="alert alert-success">SMS sent to {business.ownerPhone}</div>}
    </Modal>
  )
}
