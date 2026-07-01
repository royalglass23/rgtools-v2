import { GeneratePsForm } from '@/modules/ps-generator/GeneratePsForm'
import { getPublishedPsConfiguration } from '@/modules/ps-generator/configuration'
import { lookupPsGeneratorJob } from './actions'

export default async function PsGeneratorPage() {
  const configuration = await getPublishedPsConfiguration()

  return (
    <GeneratePsForm
      configuration={configuration}
      lookupJob={lookupPsGeneratorJob}
    />
  )
}
