import { MarkEdit } from 'markedit-api'

import { colorEditorExtension, repaintEffect } from './src/editor'
import { installMenu } from './src/menu'
import { SWATCH_CSS } from './src/paint'
import { attachPreviewPainter } from './src/preview'
import { loadEnabled, persistEnabled } from './src/settings'

// The checkmark, the editor plugin and the preview painter all read this one
// boolean. A CodeMirror StateField holding it was considered and rejected: it
// would be a second place where "is this on?" lives, and the menu item would
// still need the module value to draw its checkmark.
let enabled = loadEnabled()

appendSwatchStyle()

const preview = attachPreviewPainter(() => enabled)
MarkEdit.addExtension(colorEditorExtension(() => enabled))

installMenu({
    isEnabled: () => enabled,
    toggle: () => {
        enabled = !enabled

        // The optional call is defensive: with no view there is nothing to
        // dispatch to, and the flip stands on its own. The write is started and
        // not awaited — the repaint is what the user is waiting on, and
        // persistEnabled reports its own failures through an alert.
        MarkEdit.editorView?.dispatch({ effects: repaintEffect.of(undefined) })
        preview.refresh()
        void persistEnabled(enabled)
    },
})

function appendSwatchStyle() {
    const style = document.createElement('style')
    style.textContent = SWATCH_CSS
    document.head.appendChild(style)
}
