import { useState } from 'react'
import Modal from '../../components/Modal'
import { addDispatch } from '../../firebase/db'

const TECHNICIANS = ['Avi Cohen', 'Miri Levi', 'Dani Katz']

const EMPTY = {
  technician: TECHNICIANS[0],
  date: '',
  time: '10:00',
  notes: '',
}

export default function DispatchTechnicianForm({ business, onClose }) {
  const [form, setForm]       = useState({ ...EMPTY, date: nextDay() })
  const [loading, setLoading] = useState(false)
  const [ticket, setTicket]   = useState(null)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const ticketNum = 'BF-TECH-' + String(Math.floor(1000 + Math.random() * 9000))
      await addDispatch({
        ticketId:          ticketNum,
        restaurantId:      business.id,
        restaurantName:    business.name,
        restaurantAddress: business.address || '',
        technician:        form.technician,
        date:              form.date,
        time:              form.time,
        notes:             form.notes,
      })
      setTicket({ ...form, id: ticketNum })
    } finally {
      setLoading(false)
    }
  }

  if (ticket) {
    return (
      <Modal
        title="🔧 Technician Dispatched"
        onClose={onClose}
        footer={<button className="btn btn-primary" onClick={onClose}>Done</button>}
      >
        <div className="alert alert-success" style={{ marginBottom: 20 }}>
          Dispatch ticket <strong>{ticket.id}</strong> created successfully.
        </div>
        <div style={{ fontSize: '0.9rem', lineHeight: 2 }}>
          <div><strong>Restaurant:</strong> {business.name}</div>
          <div><strong>Address:</strong> {business.address || '—'}</div>
          <div><strong>Technician:</strong> {ticket.technician}</div>
          <div><strong>Scheduled:</strong> {ticket.date} at {ticket.time}</div>
          {ticket.notes && <div><strong>Notes:</strong> {ticket.notes}</div>}
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title="🔧 Dispatch IT Technician"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" type="submit" form="dispatch-form" disabled={loading}>
            {loading ? 'Dispatching…' : 'Confirm Dispatch'}
          </button>
        </>
      }
    >
      <form id="dispatch-form" onSubmit={handleSubmit}>
        <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: 16 }}>
          Restaurant: <strong>{business.name}</strong>
          {business.address && <span style={{ marginLeft: 6, color: '#aaa' }}>— {business.address}</span>}
        </div>

        <div className="form-group">
          <label>Technician</label>
          <select value={form.technician} onChange={set('technician')}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: '0.9rem' }}>
            {TECHNICIANS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Date</label>
            <input type="date" value={form.date} onChange={set('date')} required min={today()} />
          </div>
          <div className="form-group">
            <label>Time</label>
            <input type="time" value={form.time} onChange={set('time')} required />
          </div>
        </div>

        <div className="form-group">
          <label>Notes (optional)</label>
          <textarea
            value={form.notes}
            onChange={set('notes')}
            placeholder="e.g. Install KDS screen, calibrate receipt printer"
            rows={3}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: '0.9rem', resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
      </form>
    </Modal>
  )
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function nextDay() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}
