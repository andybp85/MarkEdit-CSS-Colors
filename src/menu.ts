import { MarkEdit } from 'markedit-api'
import type { MenuItem } from 'markedit-api'

import { MENU_TITLE } from './constants'

/**
 * What the menu item needs from the extension. The item owns no state of its own:
 * the checkmark and the painters read the same boolean, and a second copy here
 * would be a second place for "is this on?" to live.
 */
export interface ColorsController {
    isEnabled(): boolean
    toggle(): void
}

export function installMenu(controller: ColorsController): void {
    MarkEdit.addMainMenuItem({
        action: () => controller.toggle(),
        state: () => ({ isSelected: controller.isEnabled() }),
        title: MENU_TITLE,
    } satisfies MenuItem)
}
