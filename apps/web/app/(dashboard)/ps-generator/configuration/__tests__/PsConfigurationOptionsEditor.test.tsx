import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PsConfigurationOptionsEditor } from '../PsConfigurationOptionsEditor'

describe('PsConfigurationOptionsEditor', () => {
  it('adds new option values inside each category without exposing category or slug fields', () => {
    render(
      <form>
        <PsConfigurationOptionsEditor
          isDraft
          categories={[
            {
              id: 'category-structure-type',
              slug: 'structure_type',
              label: 'Structure type',
              values: [
                {
                  id: 'deck',
                  slug: 'deck',
                  label: 'Deck',
                  sortOrder: 10,
                  isActive: true,
                },
              ],
            },
            {
              id: 'category-location',
              slug: 'location',
              label: 'Location',
              values: [
                {
                  id: 'external',
                  slug: 'external',
                  label: 'External',
                  sortOrder: 10,
                  isActive: true,
                },
              ],
            },
          ]}
        />
      </form>,
    )

    expect(screen.queryByLabelText('Category')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/slug/i)).not.toBeInTheDocument()

    const structureGroup = screen.getByTestId('option-category-structure_type')
    expect(within(structureGroup).getByLabelText('New Structure type option')).toBeInTheDocument()
    expect(
      within(structureGroup).getByRole('button', {
        name: 'Add Structure type option',
      }),
    ).toHaveAttribute('name', 'newOptionCategoryId')
    expect(
      within(structureGroup).getByRole('button', {
        name: 'Add Structure type option',
      }),
    ).toHaveValue('category-structure-type')

    const locationGroup = screen.getByTestId('option-category-location')
    expect(within(locationGroup).getByLabelText('New Location option')).toBeInTheDocument()
    expect(
      within(locationGroup).getByRole('button', {
        name: 'Add Location option',
      }),
    ).toHaveAttribute('name', 'newOptionCategoryId')
    expect(
      within(locationGroup).getByRole('button', {
        name: 'Add Location option',
      }),
    ).toHaveValue('category-location')
  })
})
