
import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  Modal,
  PageHeader,
  PriorityBadge,
  StatusBadge,
} from '../components/ui'

const emptyForm = {
  full_name: '',
  mobile: '',
  email: '',
  city: '',
  location: '',
  property_type: 'apartment',
  budget_min: '',
  budget_max: '',
  preferred_configuration: '2 BHK',
  source_id: '1',
  priority: 'medium',
  requirements: '',
  consent_whatsapp: 1,
  auto_assign: true,
}

const normalizeHeader = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

const findValue = (row, aliases) => {
  const key = Object.keys(row).find((header) =>
    aliases.includes(normalizeHeader(header)),
  )
  return key ? String(row[key] ?? '').trim() : ''
}

const toBudget = (value) => {
  if (value === '' || value == null) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

export default function Leads() {
  const { isAdmin, isLead } = useAuth()

  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({ total: 0 })
  const [statuses, setStatuses] = useState([])
  const [sources, setSources] = useState([])
  const [q, setQ] = useState('')
  const [statusId, setStatusId] = useState('')
  const [priority, setPriority] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  // Excel / CSV import state
  const [importOpen, setImportOpen] = useState(false)
  const [importRows, setImportRows] = useState([])
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')
  const [importErrors, setImportErrors] = useState([])

  // Load actual leads from the backend.
  const load = async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()

      if (q) params.set('q', q)
      if (statusId) params.set('status_id', statusId)
      if (priority) params.set('priority', priority)

      const [list, leadMeta] = await Promise.all([
        api(`/api/leads?${params}`),
        api('/api/leads/meta'),
      ])

      setRows(Array.isArray(list.data) ? list.data : [])
      setMeta(list.meta || {})
      setStatuses(leadMeta.data?.statuses || [])
      setSources(leadMeta.data?.sources || [])
    } catch (e) {
      setError(e.message || 'Could not load leads.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Create a single lead.
  const createLead = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      await api('/api/leads', {
        method: 'POST',
        body: {
          ...form,
          budget_min: toBudget(form.budget_min),
          budget_max: toBudget(form.budget_max),
          source_id: Number(form.source_id),
          consent_whatsapp: Number(form.consent_whatsapp),
          auto_assign: isAdmin ? !!form.auto_assign : false,
          assign_method: 'round_robin',
        },
      })

      setOpen(false)
      setForm(emptyForm)
      await load()
    } catch (err) {
      setError(err.message || 'Could not create lead.')
    } finally {
      setSaving(false)
    }
  }

  // Read Excel or CSV and prepare a preview.
  const readImportFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImportMessage('')
    setImportErrors([])
    setImportRows([])

    try {
      if (file.size > 5 * 1024 * 1024) {
        setImportMessage(
          'File is too large. Maximum file size is 5 MB.',
        )
        return
      }

      const extension = file.name.split('.').pop()?.toLowerCase()

      if (!['xlsx', 'xls', 'csv'].includes(extension)) {
        setImportMessage(
          'Choose an Excel (.xlsx, .xls) or CSV (.csv) file.',
        )
        return
      }

      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const sheet = firstSheetName
        ? workbook.Sheets[firstSheetName]
        : null

      if (!sheet) {
        setImportMessage(
          'The selected file contains no worksheet.',
        )
        return
      }

      const rawRows = XLSX.utils.sheet_to_json(sheet, {
        defval: '',
        raw: false,
      })

      if (!rawRows.length) {
        setImportMessage(
          'No data rows found. Ensure the first row contains column headers.',
        )
        return
      }

      if (rawRows.length > 1000) {
        setImportMessage(
          'This file contains more than 1,000 rows. Please split it into smaller files.',
        )
        return
      }

      const parsed = rawRows.map((row) => {
        const rowPriority = findValue(row, ['priority']).toLowerCase()
        const propertyType = findValue(
          row,
          ['propertytype'],
        ).toLowerCase()

        return {
          full_name: findValue(row, [
            'fullname',
            'name',
            'customername',
            'leadname',
          ]),
          mobile: findValue(row, [
            'mobile',
            'phone',
            'phonenumber',
            'mobilenumber',
            'contact',
          ]),
          email: findValue(row, [
            'email',
            'emailaddress',
          ]),
          city: findValue(row, ['city']),
          location: findValue(row, [
            'location',
            'area',
            'locality',
          ]),
          property_type: [
            'apartment',
            'villa',
            'plot',
            'commercial',
            'other',
          ].includes(propertyType)
            ? propertyType
            : 'apartment',
          preferred_configuration:
            findValue(row, [
              'configuration',
              'bhk',
              'preferredconfiguration',
            ]) || '2 BHK',
          budget_min: findValue(row, [
            'budgetmin',
            'minbudget',
          ]),
          budget_max: findValue(row, [
            'budgetmax',
            'maxbudget',
          ]),
          priority: [
            'urgent',
            'high',
            'medium',
            'low',
          ].includes(rowPriority)
            ? rowPriority
            : 'medium',
          requirements: findValue(row, [
            'requirements',
            'notes',
            'remarks',
          ]),
          source_id: 1,
          consent_whatsapp: 0,
        }
      })

      setImportRows(parsed)
      setImportOpen(true)
    } catch {
      setImportMessage(
        'Could not read the file. Check that it is a valid Excel or CSV file.',
      )
    } finally {
      // Allow selecting the same file again.
      event.target.value = ''
    }
  }

  // Validate and send the records to the backend.
  // The backend must implement POST /api/leads/import.
  const importLeads = async () => {
    if (!importRows.length) {
      setImportMessage(
        'Choose a file containing lead records first.',
      )
      return
    }

    const invalidRows = importRows
      .map((row, index) => ({
        row,
        rowNumber: index + 2,
      }))
      .filter(
        ({ row }) =>
          !row.full_name.trim() || !row.mobile.trim(),
      )

    if (invalidRows.length > 0) {
      setImportErrors(
        invalidRows.map(({ rowNumber }) => ({
          row: rowNumber,
          reason: 'Name and mobile number are required.',
        })),
      )

      setImportMessage(
        `${invalidRows.length} row(s) are missing a name or mobile number. Fix these rows and upload the file again.`,
      )
      return
    }

    setImporting(true)
    setImportMessage('')
    setImportErrors([])

    try {
      const records = importRows.map((row) => ({
        ...row,
        budget_min: toBudget(row.budget_min),
        budget_max: toBudget(row.budget_max),
        source_id: Number(row.source_id) || 1,
        consent_whatsapp: 0,
      }))

      // This request must be handled by your Express backend.
      const result = await api('/api/leads/import', {
        method: 'POST',
        body: { records },
      })

      const responseData = result?.data || {}

      const importedValue =
        responseData.imported ??
        responseData.imported_count ??
        responseData.count

      const importedCount =
        importedValue == null
          ? records.length
          : Number(importedValue)

      const rejected = Array.isArray(responseData.rejected)
        ? responseData.rejected
        : Array.isArray(responseData.errors)
          ? responseData.errors
          : []

      setImportErrors(rejected)

      setImportMessage(
        `Import completed: ${
          Number.isFinite(importedCount)
            ? importedCount
            : records.length
        } lead(s) reported as imported.${
          rejected.length
            ? ` ${rejected.length} row(s) rejected.`
            : ''
        }`,
      )

      setImportRows([])

      // Refresh from the backend so the table displays saved records.
      await load()
    } catch (err) {
      setImportMessage(
        `Import failed: ${
          err.message || 'Could not save leads to the database.'
        } Check that POST /api/leads/import is implemented in the backend.`,
      )
    } finally {
      setImporting(false)
    }
  }

  const closeImport = () => {
    if (importing) return

    setImportOpen(false)
    setImportRows([])
    setImportMessage('')
    setImportErrors([])
  }

  // Export leads as CSV.
  const exportCsv = async () => {
    setError('')

    try {
      const result = await api('/api/leads/export')
      const csv = result?.data?.csv

      if (typeof csv !== 'string') {
        throw new Error('The server did not return CSV data.')
      }

      const blob = new Blob(['\uFEFF', csv], {
        type: 'text/csv;charset=utf-8;',
      })

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')

      anchor.href = url
      anchor.download = 'leads.csv'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()

      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message || 'Could not export leads.')
    }
  }

  return (
    <div>
      <PageHeader
        title={
          isAdmin
            ? 'Leads'
            : isLead
              ? 'Team leads'
              : 'My leads'
        }
        subtitle="Search, filter, and manage enquiries with full ownership history."
        actions={
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setImportMessage('')
                setImportErrors([])
                setImportRows([])
                setImportOpen(true)
              }}
            >
              Upload Excel
            </button>

            {(isAdmin || isLead) && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={exportCsv}
              >
                Export CSV
              </button>
            )}

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setOpen(true)}
            >
              New lead
            </button>
          </>
        }
      />

      <ErrorBanner message={error} />

      {/* Search and filters */}
      <div className="card-panel mb-4 grid gap-3 p-4 md:grid-cols-4">
        <input
          className="input"
          placeholder="Search name, mobile, ID, city"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <select
          className="select"
          value={statusId}
          onChange={(e) => setStatusId(e.target.value)}
        >
          <option value="">All statuses</option>
          {statuses.map((status) => (
            <option key={status.id} value={status.id}>
              {status.name}
            </option>
          ))}
        </select>

        <select
          className="select"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="">All priorities</option>
          {['urgent', 'high', 'medium', 'low'].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="btn btn-primary"
          onClick={load}
        >
          Apply filters
        </button>
      </div>

      {/* Leads table */}
      {loading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No leads found"
          subtitle="Try clearing filters or create a new enquiry."
        />
      ) : (
        <div className="card-panel table-wrap p-2">
          <table className="data">
            <thead>
              <tr>
                <th>Code</th>
                <th>Customer</th>
                <th>Mobile</th>
                <th>City</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Next follow-up</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <Link
                      className="text-[var(--color-brand)] font-medium"
                      to={`/leads/${lead.id}`}
                    >
                      {lead.lead_code}
                    </Link>
                  </td>

                  <td>{lead.full_name}</td>

                  <td>
                    <a
                      className="text-[var(--color-brand)]"
                      href={`tel:${lead.mobile}`}
                    >
                      {lead.mobile}
                    </a>
                  </td>

                  <td>{lead.city || '—'}</td>

                  <td>
                    <PriorityBadge priority={lead.priority} />
                  </td>

                  <td>
                    <StatusBadge status={lead.status_name} />
                  </td>

                  <td>{lead.owner_name || 'Unassigned'}</td>

                  <td>{lead.next_follow_up_at || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-3 py-2 text-xs text-[var(--color-ink-soft)]">
            {meta.total ?? rows.length} total
          </div>
        </div>
      )}

      {/* Create lead modal */}
      <Modal
        open={open}
        title="Create lead"
        onClose={() => setOpen(false)}
        wide
      >
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={createLead}
        >
          {[
            ['full_name', 'Full name'],
            ['mobile', 'Mobile'],
            ['email', 'Email'],
            ['city', 'City'],
            ['location', 'Location'],
          ].map(([key, label]) => (
            <label key={key} className="text-sm">
              {label}
              <input
                className="input mt-1"
                value={form[key]}
                onChange={(e) =>
                  setForm({
                    ...form,
                    [key]: e.target.value,
                  })
                }
                required={
                  key === 'full_name' || key === 'mobile'
                }
              />
            </label>
          ))}

          <label className="text-sm">
            Property type
            <select
              className="select mt-1"
              value={form.property_type}
              onChange={(e) =>
                setForm({
                  ...form,
                  property_type: e.target.value,
                })
              }
            >
              {[
                'apartment',
                'villa',
                'plot',
                'commercial',
                'other',
              ].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Configuration
            <input
              className="input mt-1"
              value={form.preferred_configuration}
              onChange={(e) =>
                setForm({
                  ...form,
                  preferred_configuration: e.target.value,
                })
              }
            />
          </label>

          <label className="text-sm">
            Budget min
            <input
              className="input mt-1"
              type="number"
              min="0"
              value={form.budget_min}
              onChange={(e) =>
                setForm({
                  ...form,
                  budget_min: e.target.value,
                })
              }
            />
          </label>

          <label className="text-sm">
            Budget max
            <input
              className="input mt-1"
              type="number"
              min="0"
              value={form.budget_max}
              onChange={(e) =>
                setForm({
                  ...form,
                  budget_max: e.target.value,
                })
              }
            />
          </label>

          <label className="text-sm">
            Source
            <select
              className="select mt-1"
              value={form.source_id}
              onChange={(e) =>
                setForm({
                  ...form,
                  source_id: e.target.value,
                })
              }
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Priority
            <select
              className="select mt-1"
              value={form.priority}
              onChange={(e) =>
                setForm({
                  ...form,
                  priority: e.target.value,
                })
              }
            >
              {['urgent', 'high', 'medium', 'low'].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="md:col-span-2 text-sm">
            Requirements
            <textarea
              className="textarea mt-1"
              rows={3}
              value={form.requirements}
              onChange={(e) =>
                setForm({
                  ...form,
                  requirements: e.target.value,
                })
              }
            />
          </label>

          {isAdmin && (
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={!!form.auto_assign}
                onChange={(e) =>
                  setForm({
                    ...form,
                    auto_assign: e.target.checked,
                  })
                }
              />
              Auto-assign using round-robin / priority rules
            </label>
          )}

          <div className="md:col-span-2">
            <button
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Create lead'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Excel / CSV import modal */}
      <Modal
        open={importOpen}
        title="Import leads from Excel / CSV"
        onClose={closeImport}
        wide
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-ink-soft)]">
            Upload an .xlsx, .xls, or .csv file. The first worksheet
            must contain headers. Name and Mobile are required.
            Maximum 1,000 rows and 5 MB per file.
          </p>

          <p className="text-sm">
            Suggested columns:{' '}
            <strong>
              Name, Mobile, Email, City, Location, Property Type,
              Configuration, Budget Min, Budget Max, Priority,
              Requirements
            </strong>
          </p>

          <input
            className="input"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={readImportFile}
            disabled={importing}
          />

          {importRows.length > 0 && (
            <>
              <div className="text-sm">
                <strong>{importRows.length}</strong> rows loaded
                for preview.
              </div>

              <div className="table-wrap max-h-64 overflow-auto">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Name</th>
                      <th>Mobile</th>
                      <th>Email</th>
                      <th>City</th>
                      <th>Priority</th>
                    </tr>
                  </thead>

                  <tbody>
                    {importRows.slice(0, 10).map((row, index) => (
                      <tr key={`${row.mobile}-${index}`}>
                        <td>{index + 2}</td>
                        <td>{row.full_name || '—'}</td>
                        <td>{row.mobile || '—'}</td>
                        <td>{row.email || '—'}</td>
                        <td>{row.city || '—'}</td>
                        <td>{row.priority}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {importRows.length > 10 && (
                <p className="text-xs text-[var(--color-ink-soft)]">
                  Showing the first 10 rows. All {importRows.length}
                  {' '}records will be sent to the backend for import.
                </p>
              )}

              <button
                type="button"
                className="btn btn-primary"
                onClick={importLeads}
                disabled={importing || !importRows.length}
              >
                {importing
                  ? 'Importing…'
                  : `Import ${importRows.length} leads`}
              </button>
            </>
          )}

          {importMessage && (
            <div
              role="status"
              className="rounded-lg border p-3 text-sm"
            >
              {importMessage}
            </div>
          )}

          {importErrors.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold">
                Rejected rows ({importErrors.length})
              </h4>

              <div className="max-h-48 overflow-auto text-sm">
                {importErrors.map((item, index) => (
                  <div
                    key={`${item.row ?? 'error'}-${index}`}
                    className="border-b py-2"
                  >
                    {item.row != null && `Row ${item.row}: `}
                    {item.reason || item.message || String(item)}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeImport}
              disabled={importing}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
