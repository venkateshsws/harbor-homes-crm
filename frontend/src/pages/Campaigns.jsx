import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowRight,
  Check,
  Clock3,
  Layers3,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react'

import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
} from '../components/ui'

const makeStep = (number = 1) => ({
  step_number: number,
  delay_days: number === 1 ? 0 : 1,
  template_name: '',
  language_code: 'en',
  is_active: true,
})

const makeForm = () => ({
  name: '',
  description: '',
  trigger: 'manual',
  trigger_status_id: '2',
  steps: [makeStep()],
})

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'

const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition duration-200 hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0'

const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition duration-200 hover:border-indigo-200 hover:bg-indigo-50/50 disabled:cursor-not-allowed disabled:opacity-60'

export default function Campaigns() {
  const { isAdmin } = useAuth()

  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState(makeForm)

  // Load campaigns from the backend.
  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true)
    setError('')

    try {
      const response = await api('/api/campaigns')

      if (!Array.isArray(response?.data)) {
        throw new Error('Unexpected campaign response from the server.')
      }

      setCampaigns(response.data)
    } catch (e) {
      setError(e.message || 'Unable to load campaigns.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(
    () => ({
      total: campaigns.length,
      active: campaigns.filter((c) => c.status === 'active').length,
      paused: campaigns.filter((c) => c.status === 'paused').length,
      drafts: campaigns.filter((c) => c.status === 'draft').length,
    }),
    [campaigns],
  )

  const filteredCampaigns = useMemo(() => {
    const query = search.trim().toLowerCase()

    return campaigns.filter((campaign) => {
      const matchesText =
        !query ||
        campaign.name?.toLowerCase().includes(query) ||
        campaign.description?.toLowerCase().includes(query)

      return (
        matchesText &&
        (filter === 'all' || campaign.status === filter)
      )
    })
  }, [campaigns, search, filter])

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const updateStep = (index, field, value) => {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, i) =>
        i === index ? { ...step, [field]: value } : step,
      ),
    }))
  }

  const addStep = () => {
    setForm((current) => {
      if (current.steps.length >= 20) return current

      return {
        ...current,
        steps: [
          ...current.steps,
          makeStep(current.steps.length + 1),
        ],
      }
    })
  }

  const removeStep = (index) => {
    setForm((current) => ({
      ...current,
      steps: current.steps
        .filter((_, i) => i !== index)
        .map((step, i) => ({ ...step, step_number: i + 1 })),
    }))
  }

  const openBuilder = () => {
    setError('')
    setNotice('')
    setForm(makeForm())
    setShowForm((current) => !current)
  }

  // Create a campaign in draft mode.
  const createCampaign = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!form.name.trim()) {
      setError('Enter a campaign name.')
      return
    }

    if (!form.steps.length) {
      setError('Add at least one message step.')
      return
    }

    for (let i = 0; i < form.steps.length; i += 1) {
      const step = form.steps[i]
      const days = Number(step.delay_days)

      if (!/^[a-zA-Z0-9_]+$/.test(step.template_name.trim())) {
        setError(
          `Step ${i + 1}: use a valid template name with letters, numbers, and underscores.`,
        )
        return
      }

      if (!Number.isFinite(days) || days < 0 || days > 365) {
        setError(`Step ${i + 1}: delay must be between 0 and 365 days.`)
        return
      }
    }

    setSaving(true)

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        trigger: form.trigger,
        trigger_status_id:
          form.trigger === 'status_change'
            ? Number(form.trigger_status_id)
            : null,
        steps: form.steps.map((step, index) => ({
          step_number: index + 1,
          delay_minutes: Math.round(Number(step.delay_days) * 1440),
          template_name: step.template_name.trim(),
          language_code: step.language_code || 'en',
          is_active: Boolean(step.is_active),
        })),
      }

      const response = await api('/api/campaigns', {
        method: 'POST',
        body: payload,
      })

      setForm(makeForm())
      setShowForm(false)
      setNotice(response.message || 'Campaign saved as a draft.')
      await load(false)
    } catch (e) {
      console.error('Create campaign failed:', e)
      setError(
        `Could not save campaign: ${e.message}` +
          (e.status ? ` (HTTP ${e.status})` : ''),
      )
    } finally {
      setSaving(false)
    }
  }

  // Pause or activate a campaign.
  const changeStatus = async (campaign) => {
    const id = campaign?._id || campaign?.id

    if (!id) {
      setError('Cannot change status: campaign ID is missing.')
      return
    }

    if (busyId) return

    const action =
      campaign.status === 'active' ? 'pause' : 'activate'

    setError('')
    setNotice('')
    setBusyId(String(id))

    try {
      console.log('Campaign status action:', {
        id,
        currentStatus: campaign.status,
        action,
      })

      const response = await api(
        `/api/campaigns/${encodeURIComponent(String(id))}/${action}`,
        { method: 'POST' },
      )

      console.log('Campaign status response:', response)

      if (response?.success === false) {
        throw new Error(response.error || `Could not ${action} campaign.`)
      }

      // Reload from the backend so the UI reflects the saved database status.
      await load(false)

      setNotice(
        response?.message ||
          `Campaign ${action === 'pause' ? 'paused' : 'activated'} successfully.`,
      )
    } catch (e) {
      console.error(`Campaign ${action} failed:`, e)

      setError(
        `${action === 'pause' ? 'Pause' : 'Activate'} failed: ${e.message}` +
          (e.status ? ` (HTTP ${e.status})` : ''),
      )
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="campaign-page space-y-7 pb-10">
      <style>{`
        @keyframes campaign-enter {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes campaign-glow {
          0%, 100% { opacity: .4; transform: scale(1); }
          50% { opacity: .75; transform: scale(1.08); }
        }

        @keyframes campaign-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,.3); }
          50% { box-shadow: 0 0 0 5px rgba(255,255,255,0); }
        }

        .campaign-enter {
          animation: campaign-enter .42s ease-out both;
        }

        .campaign-card {
          transition: transform .22s ease, box-shadow .22s ease,
            border-color .22s ease;
        }

        .campaign-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 18px 45px rgba(30,41,59,.09);
          border-color: #c7d2fe;
        }

        .campaign-glow {
          animation: campaign-glow 6s ease-in-out infinite;
        }

        .campaign-live-dot {
          animation: campaign-pulse 2s infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .campaign-enter, .campaign-glow, .campaign-live-dot {
            animation: none !important;
          }
          .campaign-card { transition: none !important; }
          .campaign-card:hover { transform: none; }
        }
      `}</style>

      <PageHeader
        title="Drip Campaigns"
        subtitle="Create, organize and manage lead follow-up journeys."
        actions={
          isAdmin ? (
            <button
              type="button"
              className={primaryButton}
              onClick={openBuilder}
            >
              {showForm ? <X size={18} /> : <Plus size={18} />}
              {showForm ? 'Close builder' : 'Create campaign'}
            </button>
          ) : null
        }
      />

      {error ? (
        <div className="campaign-enter">
          <ErrorBanner message={error} />
        </div>
      ) : null}

      {notice ? (
        <div
          role="status"
          className="campaign-enter flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <Check size={17} />
          </span>
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            aria-label="Dismiss notification"
          >
            <X size={17} />
          </button>
        </div>
      ) : null}

      {/* Hero section */}
      <section className="campaign-enter relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-indigo-700 to-violet-800 p-6 text-white shadow-xl sm:p-8">
        <div className="campaign-glow pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 right-1/3 h-52 w-52 rounded-full bg-cyan-300/10 blur-2xl" />
        <div className="pointer-events-none absolute right-20 top-8 h-36 w-36 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute right-28 top-14 h-20 w-20 rounded-full border border-white/10" />

        <div className="relative grid gap-8 lg:grid-cols-[1fr_280px] lg:items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-50">
              <Sparkles size={15} />
              YAHOO CRM · CAMPAIGN MANAGEMENT
            </div>

            <h2 className="max-w-xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Every lead deserves
              <span className="block text-cyan-200">
                the right follow-up.
              </span>
            </h2>

            <p className="mt-4 max-w-xl text-sm leading-7 text-blue-100 sm:text-base">
              Design structured follow-up journeys, configure message
              timing and manage campaigns from one workspace.
            </p>

            {isAdmin ? (
              <button
                type="button"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-indigo-800 shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50"
                onClick={() => {
                  setForm(makeForm())
                  setError('')
                  setShowForm(true)
                }}
              >
                Build a campaign
                <ArrowRight size={17} />
              </button>
            ) : null}
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-blue-50/90">
                Campaign overview
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs">
                Backend data
              </span>
            </div>

            <div className="mt-5 flex items-end gap-3">
              <span className="text-5xl font-bold tracking-tight">
                {loading ? '—' : stats.total}
              </span>
              <span className="pb-1 text-sm text-blue-100/80">
                total campaigns
              </span>
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-white transition-all duration-700"
                style={{
                  width: `${
                    stats.total
                      ? (stats.active / stats.total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>

            <div className="mt-3 flex justify-between text-xs text-blue-50/80">
              <span>{stats.active} active</span>
              <span>{stats.paused} paused</span>
            </div>
          </div>
        </div>
      </section>

      {/* Statistics */}
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard
          icon={<Layers3 size={20} />}
          label="All campaigns"
          value={stats.total}
          color="blue"
          hint="Total configurations"
        />
        <MetricCard
          icon={<Activity size={20} />}
          label="Active"
          value={stats.active}
          color="green"
          hint="Currently enabled"
        />
        <MetricCard
          icon={<Clock3 size={20} />}
          label="Paused"
          value={stats.paused}
          color="amber"
          hint="Can be reactivated"
        />
        <MetricCard
          icon={<Workflow size={20} />}
          label="Drafts"
          value={stats.drafts}
          color="violet"
          hint="Not yet activated"
        />
      </section>

      {/* Campaign builder */}
      {showForm && isAdmin ? (
        <form
          onSubmit={createCampaign}
          className="campaign-enter overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-indigo-100/50"
        >
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-violet-50 px-5 py-6 sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[.18em] text-indigo-700">
                  Campaign builder
                </div>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                  Create your journey
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Configure your trigger and add each message step.
                </p>
              </div>

              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">
                Draft mode
              </span>
            </div>
          </div>

          <div className="space-y-7 p-5 sm:p-8">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Campaign name *
                <input
                  className={`${inputClass} mt-2`}
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  placeholder="e.g. New property enquiry"
                  maxLength={120}
                  required
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Start trigger
                <select
                  className={`${inputClass} mt-2`}
                  value={form.trigger}
                  onChange={(e) => updateForm('trigger', e.target.value)}
                >
                  <option value="manual">Manual enrollment</option>
                  <option value="new_lead">New lead</option>
                  <option value="status_change">Lead status changes</option>
                </select>
              </label>
            </div>

            {form.trigger === 'status_change' ? (
              <label className="block max-w-md text-sm font-semibold text-slate-700">
                Lead status
                <select
                  className={`${inputClass} mt-2`}
                  value={form.trigger_status_id}
                  onChange={(e) =>
                    updateForm('trigger_status_id', e.target.value)
                  }
                >
                  <option value="1">New</option>
                  <option value="2">Interested</option>
                  <option value="3">Schedule for site visit</option>
                  <option value="4">Not interested</option>
                  <option value="5">Follow up</option>
                </select>
              </label>
            ) : null}

            <label className="block text-sm font-semibold text-slate-700">
              Description
              <textarea
                className={`${inputClass} mt-2`}
                value={form.description}
                onChange={(e) =>
                  updateForm('description', e.target.value)
                }
                placeholder="What should this campaign achieve?"
                rows={3}
                maxLength={1000}
              />
            </label>

            <div className="border-t border-slate-100 pt-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Message sequence
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Plan the timing and template for each step.
                  </p>
                </div>

                <button
                  type="button"
                  className={secondaryButton}
                  onClick={addStep}
                  disabled={form.steps.length >= 20}
                >
                  <Plus size={17} />
                  Add message step
                </button>
              </div>

              <div className="relative mt-6 space-y-5">
                <div className="absolute bottom-8 left-5 top-8 hidden w-px bg-indigo-100 sm:block" />

                {form.steps.map((step, index) => (
                  <div
                    key={step.step_number}
                    className="relative rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-indigo-200 hover:shadow-md sm:p-5"
                  >
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-sm font-bold text-white shadow-lg shadow-indigo-600/20">
                          {String(index + 1).padStart(2, '0')}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">
                            Message {index + 1}
                          </h4>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {index === 0
                              ? 'First touchpoint'
                              : `Follow-up touchpoint ${index + 1}`}
                          </p>
                        </div>
                      </div>

                      {form.steps.length > 1 ? (
                        <button
                          type="button"
                          className="rounded-lg px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                          onClick={() => removeStep(index)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="block text-sm font-semibold text-slate-700">
                        Delay (days)
                        <input
                          className={`${inputClass} mt-2`}
                          type="number"
                          min="0"
                          max="365"
                          step="1"
                          value={step.delay_days}
                          onChange={(e) =>
                            updateStep(index, 'delay_days', e.target.value)
                          }
                          required
                        />
                        <span className="mt-2 block text-xs font-normal text-slate-500">
                          {Number(step.delay_days) === 0
                            ? 'No configured delay'
                            : `Wait ${step.delay_days} day(s)`}
                        </span>
                      </label>

                      <label className="block text-sm font-semibold text-slate-700">
                        WhatsApp template *
                        <input
                          className={`${inputClass} mt-2`}
                          value={step.template_name}
                          onChange={(e) =>
                            updateStep(index, 'template_name', e.target.value)
                          }
                          placeholder="property_followup"
                          pattern="[a-zA-Z0-9_]+"
                          required
                        />
                        <span className="mt-2 block text-xs font-normal text-slate-500">
                          Enter the exact template name.
                        </span>
                      </label>

                      <label className="block text-sm font-semibold text-slate-700">
                        Language
                        <select
                          className={`${inputClass} mt-2`}
                          value={step.language_code}
                          onChange={(e) =>
                            updateStep(index, 'language_code', e.target.value)
                          }
                        >
                          <option value="en">English (en)</option>
                          <option value="en_US">English US (en_US)</option>
                          <option value="en_GB">English UK (en_GB)</option>
                          <option value="hi">Hindi (hi)</option>
                        </select>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <strong>Delivery information:</strong> Saving creates a
              campaign configuration. Actual automated WhatsApp delivery
              requires a scheduler, WhatsApp Business API setup, approved
              templates and appropriate customer consent.
            </div>

            <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-6">
              <button
                type="submit"
                className={primaryButton}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Saving campaign…
                  </>
                ) : (
                  <>
                    <Check size={17} />
                    Save as draft
                  </>
                )}
              </button>

              <button
                type="button"
                className={secondaryButton}
                disabled={saving}
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {/* Campaign list */}
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Your campaigns
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Review message sequences and manage campaign status.
            </p>
          </div>

          <button
            type="button"
            className={secondaryButton}
            onClick={() => load()}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={loading ? 'animate-spin' : ''}
            />
            Refresh
          </button>
        </div>

        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className={`${inputClass} pl-11`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaigns..."
              aria-label="Search campaigns"
            />
          </div>

          <select
            className={`${inputClass} sm:w-48`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="draft">Draft</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8">
            <LoadingBlock />
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
              <Workflow size={29} />
            </div>
            <div className="mt-4">
              <EmptyState
                title={
                  campaigns.length
                    ? 'No matching campaigns'
                    : 'Your campaign workspace is ready'
                }
              />
            </div>

            {campaigns.length === 0 && isAdmin ? (
              <button
                type="button"
                className={`${primaryButton} mt-4`}
                onClick={() => setShowForm(true)}
              >
                <Plus size={17} />
                Create your first campaign
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {filteredCampaigns.map((campaign, index) => {
              const id = campaign._id || campaign.id
              const active = campaign.status === 'active'
              const paused = campaign.status === 'paused'
              const busy = busyId === String(id)
              const steps = Array.isArray(campaign.steps)
                ? campaign.steps
                : []

              return (
                <article
                  key={id}
                  className="campaign-card campaign-enter overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                  style={{
                    animationDelay: `${Math.min(index * 65, 350)}ms`,
                  }}
                >
                  <div
                    className={`h-1.5 ${
                      active
                        ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                        : paused
                          ? 'bg-gradient-to-r from-amber-300 to-orange-400'
                          : 'bg-gradient-to-r from-blue-300 to-violet-400'
                    }`}
                  />

                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                            active
                              ? 'bg-emerald-50 text-emerald-700'
                              : paused
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-indigo-50 text-indigo-700'
                          }`}
                        >
                          {active ? (
                            <Activity size={22} />
                          ) : paused ? (
                            <Pause size={22} />
                          ) : (
                            <Layers3 size={22} />
                          )}
                        </div>

                        <div className="min-w-0">
                          <h3 className="break-words text-lg font-bold text-slate-900">
                            {campaign.name || 'Untitled campaign'}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            Trigger: {campaign.trigger || 'manual'}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                          active
                            ? 'bg-emerald-50 text-emerald-700'
                            : paused
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            active
                              ? 'bg-emerald-500'
                              : paused
                                ? 'bg-amber-500'
                                : 'bg-indigo-500'
                          }`}
                        />
                        {campaign.status || 'draft'}
                      </span>
                    </div>

                    <p className="mt-4 min-h-10 text-sm leading-6 text-slate-500">
                      {campaign.description ||
                        'No description has been added to this campaign.'}
                    </p>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                          <Layers3 size={15} />
                          Message steps
                        </div>
                        <div className="mt-2 text-2xl font-bold text-slate-900">
                          {steps.length}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                          <Activity size={15} />
                          Current status
                        </div>
                        <div
                          className={`mt-2 text-sm font-bold ${
                            active
                              ? 'text-emerald-700'
                              : paused
                                ? 'text-amber-700'
                                : 'text-indigo-700'
                          }`}
                        >
                          {active ? 'Active' : paused ? 'Paused' : 'Draft'}
                        </div>
                      </div>
                    </div>

                    {steps.length > 0 ? (
                      <div className="mt-5">
                        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                          Message timeline
                        </div>

                        <div className="space-y-3">
                          {steps.slice(0, 3).map((step, stepIndex) => (
                            <div
                              key={`${step.step_number || stepIndex}-${step.template_name}`}
                              className="flex items-center gap-3"
                            >
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xs font-bold text-indigo-700">
                                {String(stepIndex + 1).padStart(2, '0')}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-slate-700">
                                  {step.template_name ||
                                    `Message ${stepIndex + 1}`}
                                </div>
                                <div className="mt-0.5 text-xs text-slate-400">
                                  {Math.round(
                                    (Number(step.delay_minutes) || 0) / 1440,
                                  )}{' '}
                                  day(s) configured delay
                                </div>
                              </div>

                              <ArrowRight
                                size={15}
                                className="shrink-0 text-slate-300"
                              />
                            </div>
                          ))}

                          {steps.length > 3 ? (
                            <p className="pl-11 text-xs font-semibold text-indigo-600">
                              + {steps.length - 3} more steps
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                      <span className="text-xs text-slate-400">
                        ID: {String(id || 'Unavailable').slice(-8)}
                      </span>

                      {isAdmin ? (
                        <button
                          type="button"
                          className={`inline-flex min-w-36 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
                            active
                              ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100'
                              : 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 hover:-translate-y-0.5 hover:bg-indigo-700'
                          }`}
                          disabled={!id || Boolean(busyId)}
                          onClick={() => changeStatus(campaign)}
                        >
                          {busy ? (
                            <>
                              <RefreshCw
                                size={15}
                                className="animate-spin"
                              />
                              {active ? 'Pausing…' : 'Activating…'}
                            </>
                          ) : active ? (
                            <>
                              <Pause size={15} />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play size={15} />
                              Activate
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">
                          Read only
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-blue-900">
        <Send size={19} className="mt-0.5 shrink-0 text-blue-700" />
        <p>
          <strong>WhatsApp integration:</strong> This page manages campaign
          configuration and status. Actual automated message delivery
          requires a working scheduler, WhatsApp Business API, approved
          templates and appropriate customer consent.
        </p>
      </div>
    </div>
  )
}

function MetricCard({ icon, label, value, color, hint }) {
  const palettes = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    violet: 'bg-violet-50 text-violet-700 ring-violet-100',
  }

  return (
    <div className="campaign-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${palettes[color]}`}
        >
          {icon}
        </div>
        <span className="text-xs font-medium text-slate-400">YAHOO CRM</span>
      </div>

      <div className="mt-4 text-sm font-medium text-slate-500">
        {label}
      </div>

      <div className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
        {value}
      </div>

      <div className="mt-1 text-xs text-slate-400">{hint}</div>
    </div>
  )
}