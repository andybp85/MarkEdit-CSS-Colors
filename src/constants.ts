/** The menu item, a checkbox. It is also the title of every alert this extension raises. */
export const MENU_TITLE = 'Highlight CSS Colors'

/**
 * MarkEdit-preview's live pane. Not an interface it publishes — it is the class
 * the renderer refills on every render — so the preview half degrades to painting
 * nothing when this finds nothing.
 */
export const PREVIEW_SELECTOR = '.markdown-body'

export const SETTINGS_FILE = 'settings.json'

/**
 * settings.json key holding this extension's settings. The `extension.` prefix is
 * required by MarkEdit's settings schema, and the rest is the package name
 * without `markedit-`, camel-cased, which is MarkEdit's convention.
 */
export const SETTINGS_NAMESPACE = 'extension.cssColors'
