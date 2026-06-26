'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import type { ActiveScoringOptionLists, FormOption } from '@/modules/lead-intake/scoring/config-options'
import type { LeadIntakeInput } from '@/modules/lead-intake/actions'
import { commitLeadImport, previewLeadImport } from './actions'
import type { CommitLeadImportResult, FieldIssue, LeadImportRow } from './types'

const JUDGMENT_COLUMNS: Array<{
  label: string
  field: keyof LeadIntakeInput
  category: string
}> = [
  { label: 'Client Type', field: 'clientProfileKey', category: '1' },
  { label: 'Budget', field: 'budgetBand', category: '2' },
  { label: 'Complexity', field: 'cat4', category: '4' },
  { label: 'Price', field: 'priceSensitivityRead', category: '5' },
  { label: 'Decision', field: 'decisionMakers', category: '6' },
  { label: 'RC', field: 'rcStatus', category: '8' },
  { label: 'BC', field: 'bcStatus', category: '9' },
  { label: 'Stage', field: 'buildingStage', category: '10' },
]

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const
type PageSize = typeof PAGE_SIZE_OPTIONS[number]
type RowFilter = 'all' | 'errors' | 'invalid' | 'needsContact' | 'notEnriched' | 'skipped' | 'ready'

export function LeadImportClient({ optionLists }: { optionLists: ActiveScoringOptionLists }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [rows, setRows] = useState<LeadImportRow[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [summary, setSummary] = useState<CommitLeadImportResult | null>(null)
  const [rowFilter, setRowFilter] = useState<RowFilter>('all')
  const [pageSize, setPageSize] = useState<PageSize>(10)
  const [page, setPage] = useState(1)
  const [isPending, startTransition] = useTransition()
  const commitSucceeded = Boolean(summary && 'success' in summary)

  const counts = useMemo(() => ({
    total: rows.length,
    ready: rows.filter((row) => isReady(row)).length,
    needsContact: rows.filter((row) => row.needsContact).length,
    skipped: rows.filter((row) => row.autoSkip || row.existing).length,
    invalid: rows.filter((row) => row.issues.length > 0).length,
  }), [rows])

  const filteredRows = useMemo(() => rows.filter((row) => rowMatchesFilter(row, rowFilter)), [rows, rowFilter])
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * pageSize
  const visibleRows = filteredRows.slice(pageStart, pageStart + pageSize)

  function updateRow(rowId: string, patch: Partial<LeadImportRow>) {
    setRows((current) => current.map((row) => {
      if (row.rowId !== rowId) return row
      const next = { ...row, ...patch }
      return {
        ...next,
        needsContact: !next.input.phone?.trim() && !next.input.email?.trim(),
        issues: validateClientRow(next),
      }
    }))
  }

  function updateInput(row: LeadImportRow, field: keyof LeadIntakeInput, value: string) {
    updateRow(row.rowId, {
      input: { ...row.input, [field]: value },
    })
  }

  function handlePreview() {
    if (!selectedFile) {
      setMessage('Choose a filled template first.')
      return
    }

    setMessage(null)
    setSummary(null)
    startTransition(async () => {
      const bytes = await selectedFile.arrayBuffer()
      const result = await previewLeadImport({ bytes, fileName: selectedFile.name })
      if ('error' in result) {
        setRows([])
        setMessage(result.error)
        return
      }
      setRows(result.rows)
      setRowFilter('all')
      setPage(1)
      setMessage(`${result.rows.length} row${result.rows.length === 1 ? '' : 's'} ready for review.`)
    })
  }

  function handleFileChange(file: File | null) {
    setSelectedFile(file)
    setSummary(null)
    setMessage(null)
    if (file) {
      setRows([])
      setRowFilter('all')
      setPage(1)
    }
  }

  function handleCommit() {
    setMessage(null)
    setSummary(null)
    startTransition(async () => {
      const result = await commitLeadImport(rows)
      setSummary(result)
      if ('error' in result) {
        setMessage(result.error)
      } else {
        setMessage(`Inserted ${result.inserted} lead${result.inserted === 1 ? '' : 's'}.`)
        setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    })
  }

  return (
    <div className="space-y-5">
      <details open className="rounded border border-gray-200 bg-white shadow-sm">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">
          How to import
        </summary>
        <div className="border-t border-gray-100 px-4 py-4">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
            <li>Download the template.</li>
            <li>Fill one row per job, complete required columns marked with a *, use the dropdowns and do not free-type; leave Phone and Email blank to auto-fill from ServiceM8.</li>
            <li>Save the file as <span className="font-mono">.xlsx</span>.</li>
            <li>Upload it. Rows are enriched by Job Number with phone, email, status, and project type.</li>
            <li>Review the grid. Red means fix-before-commit, amber needs contact means add a phone or email, and grey rows are auto-skipped because they are completed or already imported.</li>
            <li>Commit. The summary shows inserted, skipped-existing, skipped-completed, needs-contact, not-enriched, and failed rows.</li>
          </ol>
          <a
            href="/templates/rgtools-lead-import-template.xlsx"
            className="mt-4 inline-flex rounded bg-[#142B3A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d3d52]"
          >
            Download template
          </a>
        </div>
      </details>

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Filled template</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
            />
          </label>
          <button
            type="button"
            onClick={handlePreview}
            disabled={isPending}
            className="rounded bg-[#142B3A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d3d52] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Working...' : 'Upload and review'}
          </button>
          {rows.length > 0 && !commitSucceeded && (
            <button
              type="button"
              onClick={handleCommit}
              disabled={isPending || counts.ready === 0}
              className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Commit {counts.ready}
            </button>
          )}
        </div>

        {message && (
          <div className="mt-3 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            {message}
          </div>
        )}

        {rows.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <Badge label={`Total ${counts.total}`} tone="gray" />
            <Badge label={`Ready ${counts.ready}`} tone="green" />
            <Badge label={`Needs contact ${counts.needsContact}`} tone="amber" />
            <Badge label={`Skipped ${counts.skipped}`} tone="gray" />
            <Badge label={`Invalid ${counts.invalid}`} tone="red" />
          </div>
        )}
      </section>

      {summary && 'success' in summary && (
        <section className="rounded border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <div className="font-semibold">Commit summary</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge label={`Inserted ${summary.inserted}`} tone="green" />
            <Badge label={`Skipped existing ${summary.skippedExisting}`} tone="gray" />
            <Badge label={`Skipped completed ${summary.skippedCompleted}`} tone="gray" />
            <Badge label={`Missing contact ${summary.needsContact}`} tone="amber" />
            <Badge label={`Not enriched ${summary.notEnriched}`} tone="amber" />
            <Badge label={`Failed ${summary.failed.length}`} tone="red" />
          </div>
          {summary.failed.length > 0 && (
            <ul className="mt-3 list-disc pl-5">
              {summary.failed.map((failure) => (
                <li key={`${failure.jobNumber}-${failure.reason}`}>
                  <span className="font-mono">{failure.jobNumber}</span>: {failure.reason}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {rows.length > 0 && (
        <section className="overflow-hidden rounded border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Show</span>
                <select
                  value={rowFilter}
                  onChange={(event) => {
                    setRowFilter(event.target.value as RowFilter)
                    setPage(1)
                  }}
                  className="mt-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All rows</option>
                  <option value="errors">All attention rows</option>
                  <option value="invalid">Invalid only</option>
                  <option value="needsContact">Needs contact</option>
                  <option value="notEnriched">Not enriched</option>
                  <option value="skipped">Skipped</option>
                  <option value="ready">Ready</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Rows per page</span>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value) as PageSize)
                    setPage(1)
                  }}
                  className="mt-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </label>
            </div>
            <PaginationControls
              page={currentPage}
              totalPages={totalPages}
              pageStart={pageStart}
              visibleCount={visibleRows.length}
              totalCount={filteredRows.length}
              onPrevious={() => setPage((value) => Math.max(1, value - 1))}
              onNext={() => setPage((value) => Math.min(totalPages, value + 1))}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-medium">State</th>
                  <th className="px-3 py-2 font-medium">Job</th>
                  <th className="px-3 py-2 font-medium">Client</th>
                  <th className="px-3 py-2 font-medium">Phone</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Address</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Project Type</th>
                  {JUDGMENT_COLUMNS.map((column) => (
                    <th key={column.field} className="px-3 py-2 font-medium">{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.rowId} className={`border-t border-gray-100 ${row.autoSkip || row.existing ? 'bg-gray-50 text-gray-500' : ''}`}>
                    <td className="px-3 py-2 align-top">
                      <RowState row={row} />
                    </td>
                    <td className="px-3 py-2 align-top font-mono text-xs">{row.jobNumber || '-'}</td>
                    <td className="px-3 py-2 align-top">
                      <TextCell value={row.input.clientName} onChange={(value) => updateInput(row, 'clientName', value)} />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <TextCell value={row.input.phone ?? ''} onChange={(value) => updateInput(row, 'phone', value)} />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <TextCell type="email" value={row.input.email ?? ''} onChange={(value) => updateInput(row, 'email', value)} />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <TextCell value={row.input.location} onChange={(value) => updateInput(row, 'location', value)} />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span>{row.servicem8Status ?? (row.notEnriched ? 'Not enriched' : '-')}</span>
                      {row.enrichmentMessage && (
                        <span className="mt-1 block max-w-44 text-xs normal-case text-amber-700">
                          {row.enrichmentMessage}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <TextCell value={row.input.projectType} onChange={(value) => updateInput(row, 'projectType', value)} />
                    </td>
                    {JUDGMENT_COLUMNS.map((column) => (
                      <td key={column.field} className="px-3 py-2 align-top">
                        <SelectCell
                          value={String(row.input[column.field] ?? '')}
                          options={optionLists.categories[column.category]?.options ?? []}
                          onChange={(value) => updateInput(row, column.field, value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={8 + JUDGMENT_COLUMNS.length} className="px-4 py-8 text-center text-sm text-gray-500">
                      No rows match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function validateClientRow(row: LeadImportRow): FieldIssue[] {
  const issues: FieldIssue[] = []
  if (!row.jobNumber.trim()) issues.push({ field: 'jobNumber', message: 'Job Number is required.' })
  if (!row.input.clientName.trim()) issues.push({ field: 'clientName', message: 'Client Name is required.' })
  if (!row.input.location.trim()) issues.push({ field: 'location', message: 'Job Address is required.' })
  if (!row.input.clientProfileKey?.trim()) issues.push({ field: 'clientProfileKey', message: 'Client Type is required.' })
  if (!row.input.budgetBand?.trim()) issues.push({ field: 'budgetBand', message: 'Budget Band is required.' })
  if (!row.input.cat4?.trim()) issues.push({ field: 'cat4', message: 'Complexity is required.' })
  if (!row.input.priceSensitivityRead?.trim()) {
    issues.push({ field: 'priceSensitivityRead', message: 'Price Sensitivity is required.' })
  }
  return issues
}

function isReady(row: LeadImportRow) {
  return !row.existing && !row.autoSkip && row.issues.length === 0
}

function rowMatchesFilter(row: LeadImportRow, filter: RowFilter) {
  if (filter === 'all') return true
  if (filter === 'ready') return isReady(row)
  if (filter === 'invalid') return row.issues.length > 0
  if (filter === 'needsContact') return row.needsContact
  if (filter === 'notEnriched') return row.notEnriched
  if (filter === 'skipped') return row.autoSkip || row.existing
  return row.issues.length > 0 || row.needsContact || row.notEnriched || row.autoSkip || row.existing
}

function RowState({ row }: { row: LeadImportRow }) {
  if (row.existing) return <Badge label="Already imported" tone="gray" />
  if (row.autoSkip) return <Badge label="Completed" tone="gray" />
  if (row.needsContact) return <Badge label="Needs contact" tone="amber" />
  if (row.issues.length > 0) return <Badge label={row.issues[0].message} tone="red" />
  if (row.notEnriched) return <Badge label="Not enriched" tone="amber" />
  return <Badge label="Ready" tone="green" />
}

function PaginationControls({
  page,
  totalPages,
  pageStart,
  visibleCount,
  totalCount,
  onPrevious,
  onNext,
}: {
  page: number
  totalPages: number
  pageStart: number
  visibleCount: number
  totalCount: number
  onPrevious: () => void
  onNext: () => void
}) {
  const firstRow = totalCount === 0 ? 0 : pageStart + 1
  const lastRow = pageStart + visibleCount

  return (
    <div className="flex items-center gap-3 text-sm text-gray-600">
      <span>
        {firstRow}-{lastRow} of {totalCount}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrevious}
          disabled={page <= 1}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <span className="min-w-16 text-center text-xs font-medium uppercase text-gray-500">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}

function Badge({ label, tone }: { label: string; tone: 'green' | 'amber' | 'red' | 'gray' }) {
  const classes = {
    green: 'border-green-200 bg-green-50 text-green-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    red: 'border-red-200 bg-red-50 text-red-700',
    gray: 'border-gray-200 bg-gray-100 text-gray-600',
  }[tone]

  return <span className={`inline-flex rounded border px-2 py-1 text-xs font-medium ${classes}`}>{label}</span>
}

function TextCell({
  value,
  onChange,
  type = 'text',
}: {
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full min-w-36 rounded border border-gray-300 px-2 py-1 text-sm text-gray-950 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  )
}

function SelectCell({
  value,
  options,
  onChange,
}: {
  value: string
  options: FormOption[]
  onChange: (value: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full min-w-32 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-950 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">Select...</option>
      {options.map((option) => (
        <option key={option.key} value={option.key}>
          {cleanOptionLabel(option.label)}
        </option>
      ))}
    </select>
  )
}

function cleanOptionLabel(label: string): string {
  return label
    .replaceAll('â€“', '-')
    .replaceAll('â€”', '-')
    .replaceAll('â€‘', '-')
}
