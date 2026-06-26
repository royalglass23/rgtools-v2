'use client'

export function DeleteLeadButton({ clientName }: { clientName: string }) {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm(`Delete lead for ${clientName}? This cannot be undone.`)) {
          event.preventDefault()
        }
      }}
      className="rounded border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
    >
      Delete
    </button>
  )
}
