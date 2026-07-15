type ConfigurationAction = (formData: FormData) => Promise<void>

export const PS_CONFIGURATION_OPTIONS_FORM_ID = 'ps-configuration-options-form'

type PsConfigurationVersionActionsProps = {
  isDraft: boolean
  createDraftAction: ConfigurationAction
  saveDraftAction: ConfigurationAction
}

export function PsConfigurationVersionActions({
  isDraft,
  createDraftAction,
  saveDraftAction,
}: PsConfigurationVersionActionsProps) {
  if (!isDraft) {
    return (
      <form action={createDraftAction}>
        <button type="submit" className="rounded bg-gray-950 px-3 py-2 text-sm font-semibold text-white">
          Edit
        </button>
      </form>
    )
  }

  return (
    <button
      type="submit"
      form={PS_CONFIGURATION_OPTIONS_FORM_ID}
      formAction={saveDraftAction}
      className="rounded bg-gray-950 px-3 py-2 text-sm font-semibold text-white"
    >
      Save
    </button>
  )
}
