import { Extension } from '@tiptap/core';
import { Plugin, TextSelection } from '@tiptap/pm/state';
import type { Node } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import { getRelativeSelection, relativePositionToAbsolutePosition, ySyncPluginKey } from '@tiptap/y-tiptap';
import { commitNativeNavigationSelection } from './native-navigation';

function topology(node: Node): unknown {
  return [node.type.name, node.attrs,
    Array.from({ length: node.childCount }, (_, i) => node.child(i)).filter(child => !child.isText).map(topology)];
}

// y-tiptap 3.0.9's structural fallback can retain the old absolute offset in a
// uniquely typed block even when the remote change only inserts/deletes text.
// Keep a Yjs bookmark of the previous view state. Structural changes and Yjs
// history remain the binding's responsibility; never normalize a composing view.
export const CollaborationSelection = Extension.create({
  name: 'collaborationSelection',
  addProseMirrorPlugins() {
    let view: EditorView | undefined;
    let bookmark: ReturnType<typeof getRelativeSelection> | null = null;
    const capture = (current: EditorView) => {
      const binding = ySyncPluginKey.getState(current.state)?.binding;
      bookmark = binding && current.state.selection instanceof TextSelection
        ? getRelativeSelection(binding, current.state) : null;
    };
    return [new Plugin({
      props: { handleDOMEvents: {
        keyup: commitNativeNavigationSelection,
        // Native element.focus() can place the DOM caret at the start after a
        // button held focus, even while the relative PM bookmark is correct.
        // Reconcile it before selectionchange imports that stale DOM position.
        focus: current => { if (!current.composing) current.focus(); return false; },
      } },
      appendTransaction: (transactions, oldState, newState) => {
        if (!view || view.composing || !bookmark || bookmark.type !== 'text' ||
          bookmark.absAnchor !== oldState.selection.anchor || bookmark.absHead !== oldState.selection.head ||
          !transactions.some(tr => tr.docChanged && tr.getMeta(ySyncPluginKey)?.isChangeOrigin) ||
          transactions.some(tr => tr.getMeta(ySyncPluginKey)?.isUndoRedoOperation)) return;
        const binding = ySyncPluginKey.getState(newState)?.binding;
        if (!binding || !bookmark.anchor || !bookmark.head) return;
        const anchor = relativePositionToAbsolutePosition(binding.doc, binding.type, bookmark.anchor, binding.mapping);
        const head = relativePositionToAbsolutePosition(binding.doc, binding.type, bookmark.head, binding.mapping);
        if (anchor === null || head === null || anchor < 0 || head < 0 ||
          anchor > newState.doc.content.size || head > newState.doc.content.size ||
          !newState.doc.resolve(anchor).parent.inlineContent || !newState.doc.resolve(head).parent.inlineContent) return;
        const selection = TextSelection.create(newState.doc, anchor, head);
        if (!selection.eq(newState.selection) &&
          JSON.stringify(topology(oldState.doc)) === JSON.stringify(topology(newState.doc))) {
          return newState.tr.setSelection(selection).setMeta('addToHistory', false);
        }
      },
      view: current => {
        view = current;
        capture(current);
        return { update: capture, destroy: () => { view = undefined; bookmark = null; } };
      },
    })];
  },
});
