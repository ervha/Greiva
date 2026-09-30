import type { EditorState, Transaction } from '@tiptap/pm/state';
import { Selection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';

// Both drop and keyboard movement use one ProseMirror transaction. No HTML rebuilds.
export function moveTopLevelBlock(state: EditorState, from: number, before: number): Transaction | null {
  const boundaries: number[] = [];
  state.doc.forEach((_node, pos) => boundaries.push(pos));
  boundaries.push(state.doc.content.size);
  const node = state.doc.nodeAt(from);
  if (!node || !boundaries.includes(from) || !boundaries.includes(before) ||
      before === from || before === from + node.nodeSize) return null;
  const destination = before > from ? before - node.nodeSize : before;
  const tr = closeHistory(state.tr).delete(from, from + node.nodeSize).insert(destination, node);
  return tr.setSelection(Selection.near(tr.doc.resolve(destination + 1))).scrollIntoView();
}

export function adjacentBlockMove(state: EditorState, direction: -1 | 1): Transaction | null {
  const { $from } = state.selection;
  const index = $from.index(0);
  const offsets: number[] = [];
  state.doc.forEach((_node, pos) => offsets.push(pos));
  offsets.push(state.doc.content.size);
  const from = offsets[index];
  const before = direction === -1 ? offsets[index - 1] : offsets[index + 2];
  if (from !== undefined && before !== undefined &&
      (direction === -1 ? index > 0 : index < state.doc.childCount - 1)) {
    return moveTopLevelBlock(state, from, before);
  }
  return null;
}
