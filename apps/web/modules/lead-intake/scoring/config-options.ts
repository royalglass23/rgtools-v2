import { DECISION_MATRIX, type MatrixFieldKey } from './score-lead'

export type FormOption = {
  key: string
  label: string
}

export type ScoringCategoryOptions = {
  label: string
  options: FormOption[]
}

export type ActiveScoringOptionLists = {
  configVersionId: null
  categories: Record<string, ScoringCategoryOptions>
  config: typeof DECISION_MATRIX
}

const legacyCategoryByField: Record<MatrixFieldKey, string> = {
  clientType: '1',
  budgetBand: '2',
  projectType: '4',
  priceSensitivity: '5',
  decisionMakers: '6',
  distanceBand: '7',
  resourceConsent: '8',
  buildingConsent: '9',
  buildingStage: '10',
  source: '11',
  paymentHistory: '12',
  siteAccess: '13',
  installationHeight: '14',
}

export async function getActiveScoringOptionLists(): Promise<ActiveScoringOptionLists> {
  return decisionMatrixToOptionLists()
}

export function decisionMatrixToOptionLists(): ActiveScoringOptionLists {
  return {
    configVersionId: null,
    config: DECISION_MATRIX,
    categories: Object.fromEntries(
      DECISION_MATRIX.fields.map((field) => [
        legacyCategoryByField[field.key],
        {
          label: field.label,
          options: field.options.map((option) => ({
            key: option.key,
            label: option.label,
          })),
        },
      ]),
    ),
  }
}
