'use client'

import { useState } from 'react'

type OptionValue = {
  id: string
  slug: string
  label: string
  sortOrder: number
  isActive: boolean
}

type OptionCategory = {
  id: string
  slug: string
  label: string
  values: OptionValue[]
}

type PsConfigurationOptionsEditorProps = {
  categories: OptionCategory[]
  isDraft: boolean
}

export function PsConfigurationOptionsEditor({ categories, isDraft }: PsConfigurationOptionsEditorProps) {
  const [orderedCategories, setOrderedCategories] = useState(() => (
    categories.map((category) => ({
      ...category,
      values: [...category.values].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)),
    }))
  ))
  const [draggingId, setDraggingId] = useState<string | null>(null)

  function moveOption(categoryId: string, fromId: string, toId: string) {
    if (!isDraft || fromId === toId) return
    setOrderedCategories((current) => current.map((category) => {
      if (category.id !== categoryId) return category

      const fromIndex = category.values.findIndex((value) => value.id === fromId)
      const toIndex = category.values.findIndex((value) => value.id === toId)
      if (fromIndex < 0 || toIndex < 0) return category

      const values = [...category.values]
      const [moved] = values.splice(fromIndex, 1)
      values.splice(toIndex, 0, moved)
      return { ...category, values }
    }))
  }

  return (
    <>
      {orderedCategories.map((category) => {
        const showTemplateColumn = category.slug === 'system'

        return (
          <details key={category.id} data-testid={`option-category-${category.slug}`} className="rounded border border-gray-200 bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 border-b border-gray-100 px-4 py-3">
              <span>
                <span className="block text-base font-semibold text-gray-950">{category.label}</span>
                <span className="mt-1 block text-xs text-gray-500">{category.values.length} options</span>
              </span>
              <span className="text-sm font-medium text-gray-600">Expand</span>
            </summary>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="w-12 px-4 py-3"></th>
                    <th className="px-4 py-3">Name</th>
                    {showTemplateColumn ? <th className="px-4 py-3">Template</th> : null}
                    <th className="w-28 px-4 py-3">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {category.values.map((value, index) => (
                    <tr
                      key={value.id}
                      draggable={isDraft}
                      onDragStart={(event) => {
                        if (!isDraft) return
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', value.id)
                        setDraggingId(value.id)
                      }}
                      onDragOver={(event) => {
                        if (!isDraft) return
                        event.preventDefault()
                        event.dataTransfer.dropEffect = 'move'
                      }}
                      onDrop={(event) => {
                        if (!isDraft) return
                        event.preventDefault()
                        moveOption(category.id, event.dataTransfer.getData('text/plain'), value.id)
                        setDraggingId(null)
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      className={draggingId === value.id ? 'bg-sky-50' : 'bg-white'}
                    >
                      <td className="px-4 py-3 text-gray-400">
                        <input type="hidden" name="optionValueId" value={value.id} />
                        <input type="hidden" name={`sortOrder:${value.id}`} value={(index + 1) * 10} />
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded border border-gray-300 text-sm font-semibold ${isDraft ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-50'}`}>
                          ::
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          name={`label:${value.id}`}
                          defaultValue={value.label}
                          disabled={!isDraft}
                          className="block w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-950 disabled:bg-gray-50 disabled:text-gray-500"
                        />
                      </td>
                      {showTemplateColumn ? <td className="px-4 py-3 text-gray-700">{value.slug}</td> : null}
                      <td className="px-4 py-3 text-gray-700">
                        <input
                          type="checkbox"
                          name={`isActive:${value.id}`}
                          defaultChecked={value.isActive}
                          disabled={!isDraft}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <input type="hidden" name={`newOptionSortOrder:${category.id}`} value={(category.values.length + 1) * 10} />
                <label className="text-sm font-medium text-gray-700">
                  New {category.label} option
                  <input
                    name={`newOptionLabel:${category.id}`}
                    disabled={!isDraft}
                    className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </label>
                <button
                  type="submit"
                  name="newOptionCategoryId"
                  value={category.id}
                  disabled={!isDraft}
                  className="rounded bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  Add {category.label} option
                </button>
              </div>
            </div>
          </details>
        )
      })}
    </>
  )
}
