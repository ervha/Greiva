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
  const tr = closeHistory(state.tr).setMeta('greivaHistoryBoundary', true).delete(from, from + node.nodeSize).insert(destination, node);
  return tr.setSelection(Selection.near(tr.doc.resolve(destination + 1))).scrollIntoView();
}

// Toolbar availability must not build a move transaction on every input/selection.
export function canMoveAdjacentBlock(state: EditorState, direction: -1 | 1): boolean {
  const { $from } = state.selection;
  for (let depth = $from.depth - 1; depth > 0; depth--) {
    const parent = $from.node(depth);
    if (parent.type.name !== 'detailsContent') continue;
    const index = $from.index(depth);
    return index < parent.childCount && index + direction >= 0 && index + direction < parent.childCount;
  }
  const index = $from.index(0);
  return index < state.doc.childCount && index + direction >= 0 && index + direction < state.doc.childCount;
}

export function adjacentBlockMove(state: EditorState, direction: -1 | 1): Transaction | null {
  const { $from } = state.selection;
  // Move siblings inside the nearest Toggle body without moving its parent Toggle.
  for (let depth = $from.depth - 1; depth > 0; depth--) {
    const parent = $from.node(depth);
    if (parent.type.name !== 'detailsContent') continue;
    const index = $from.index(depth);
    const target = index + direction;
    if (target < 0 || target >= parent.childCount) return null;
    const offsets: number[] = [];
    parent.forEach((_node, offset) => offsets.push($from.start(depth) + offset));
    offsets.push($from.end(depth));
    const from = offsets[index]!;
    const node = parent.child(index);
    const destination = direction === -1 ? offsets[target]! : offsets[index + 2]! - node.nodeSize;
    const tr = state.tr.setMeta('greivaHistoryBoundary', true).delete(from, from + node.nodeSize).insert(destination, node);
    return tr.setSelection(Selection.near(tr.doc.resolve(destination + 1))).scrollIntoView();
  }
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
