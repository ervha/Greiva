import { Details } from '@tiptap/extension-details';
import type { Editor } from '@tiptap/core';
import { Selection, TextSelection, type EditorState } from '@tiptap/pm/state';

function nearestDetails(state: EditorState) {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name === 'details') return $from.before(depth);
  }
  return null;
}

function setOpen(editor: Editor, pos: number, open: boolean) {
  if (!editor.isEditable || editor.view.composing) return false;
  const { state } = editor;
  const node = state.doc.nodeAt(pos);
  if (node?.type.name !== 'details' || node.attrs.open === open) return false;
  const summary = node.firstChild!;
  const contentStart = pos + 1 + summary.nodeSize;
  const tr = state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, open }).setMeta('addToHistory', false);
  // A caret in a collapsed body must remain visible, at the end of its heading.
  if (!open && state.selection.to > contentStart && state.selection.from < pos + node.nodeSize - 1) {
    tr.setSelection(TextSelection.create(tr.doc, pos + 2 + summary.content.size));
  }
  editor.view.dispatch(tr);
  return true;
}

export const RefinedDetails = Details.extend({
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Enter: () => {
        const { editor } = this;
        if (editor.view.composing || editor.state.selection.$from.parent.type.name !== 'detailsSummary') return false;
        const pos = nearestDetails(editor.state);
        if (pos === null) return false;
        // Visibility must update before selection: the inherited selection plugin
        // otherwise sees the old hidden DOM and moves the caret back out.
        setOpen(editor, pos, true);
        const { state } = editor;
        const node = state.doc.nodeAt(pos)!;
        const bodyStart = pos + 2 + node.firstChild!.nodeSize;
        editor.view.dispatch(state.tr.setSelection(Selection.near(state.doc.resolve(bodyStart), 1)).scrollIntoView());
        return true;
      },
      'Mod-Enter': () => {
        const pos = nearestDetails(this.editor.state);
        return pos !== null && setOpen(this.editor, pos, !this.editor.state.doc.nodeAt(pos)!.attrs.open);
      },
    };
  },
  addNodeView() {
    const parent = this.parent?.();
    if (!parent) throw new Error('Details node view is required');
    return props => {
      // The inherited open-node view schedules an untracked timeout that toggles
      // visibility later. It can reopen a node the user has already collapsed.
      // Start its view closed and synchronize current state after children mount.
      const initialNode = props.node.type.create({ ...props.node.attrs, open: false }, props.node.content, props.node.marks);
      const base = parent({ ...props, node: initialNode });
      let destroyed = false;
      queueMicrotask(() => {
        if (destroyed) return;
        const pos = props.getPos();
        const node = typeof pos === 'number' ? props.editor.state.doc.nodeAt(pos) : null;
        if (node?.type === props.node.type) base.update?.(node, props.decorations, props.innerDecorations);
      });
      const toggle = (base.dom as HTMLElement).querySelector(':scope > button')!;
      const keepSelection = (event: MouseEvent) => {
        if (props.editor.isEditable && !props.view.composing) event.preventDefault();
      };
      const click = (event: MouseEvent) => {
        event.stopImmediatePropagation();
        const pos = props.getPos();
        if (typeof pos !== 'number' || props.view.composing) return;
        const node = props.editor.state.doc.nodeAt(pos);
        if (!node || !setOpen(props.editor, pos, !node.attrs.open)) return;
        // Pointer activation returns to the caret; keyboard activation keeps the
        // button focused, so Enter/Space can open and close it repeatedly.
        if (event.detail > 0) props.view.focus();
      };
      toggle.addEventListener('mousedown', keepSelection as EventListener);
      toggle.addEventListener('click', click as EventListener, true);
      return {
        ...base,
        stopEvent: event => toggle.contains(event.target as Node) || base.stopEvent?.(event) || false,
        destroy: () => {
          destroyed = true;
          toggle.removeEventListener('mousedown', keepSelection as EventListener);
          toggle.removeEventListener('click', click as EventListener, true);
          base.destroy?.();
        },
      };
    };
  },
});
