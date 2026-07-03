import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { settings } from '@rgtools/db/schema'
import {
  MENU_AVAILABILITY_SETTING_KEY,
  parseMenuAvailabilitySetting,
  type MenuAvailability,
} from './menu-availability'

export async function getMenuAvailability(): Promise<MenuAvailability> {
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, MENU_AVAILABILITY_SETTING_KEY),
    columns: { value: true },
  })

  return parseMenuAvailabilitySetting(row?.value)
}
