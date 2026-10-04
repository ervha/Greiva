import { TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

const navigationKeys = new Set(['Home', 'End', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

// Native navigation can move the DOM caret before selectionchange reaches
// ProseMirror. Commit that selection at keyup so an intervening Yjs update
// cannot redraw the old caret. Leave composition and non-navigation keys alone.
export function commitNativeNavigationSelection(view: EditorView, event: KeyboardEvent) {
  if (!navigationKeys.has(event.key) || event.isComposing || event.keyCode === 229 ||
    view.composing || !view.hasFocus() || !(view.state.selection instanceof TextSelection)) return false;
  const selection = view.dom.ownerDocument.getSelection();
  if (!selection?.anchorNode || !selection.focusNode ||
    !view.dom.contains(selection.anchorNode) || !view.dom.contains(selection.focusNode)) return false;
  let anchor: number, head: number;
  try {
    anchor = view.posAtDOM(selection.anchorNode, selection.anchorOffset);
    head = view.posAtDOM(selection.focusNode, selection.focusOffset);
  } catch { return false; } // A detached DOM selection remains the binding's responsibility.
  if (anchor < 0 || head < 0 || anchor > view.state.doc.content.size || head > view.state.doc.content.size ||
    !view.state.doc.resolve(anchor).parent.inlineContent || !view.state.doc.resolve(head).parent.inlineContent) return false;
  const next = TextSelection.create(view.state.doc, anchor, head);
  if (!next.eq(view.state.selection)) view.dispatch(view.state.tr.setSelection(next));
  return false; // Do not consume the browser event or change its default behavior.
}
