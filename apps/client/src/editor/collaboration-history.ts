import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import type { Node } from '@tiptap/pm/model';
import { ySyncPluginKey, yUndoPluginKey } from '@tiptap/y-tiptap';

function structure(node: Node): unknown {
  return node.isText ? null : [node.type.name, node.attrs,
    Array.from({ length: node.childCount }, (_, index) => node.child(index)).filter(child => !child.isText).map(structure)];
}

// Yjs captures by time, unlike ProseMirror history's adjacency grouping.
// Separate structural commands and caret changes from continuous text typing.
export const CollaborationHistory = Extension.create({
  name: 'collaborationHistory',
  addProseMirrorPlugins() {
    let boundary = false;
    return [new Plugin({
      filterTransaction: (tr, state) => {
        if (tr.getMeta(ySyncPluginKey)?.isChangeOrigin || tr.getMeta('addToHistory') === false) return true;
        const manager = yUndoPluginKey.getState(state)?.undoManager;
        boundary = tr.docChanged && (tr.getMeta('greivaHistoryBoundary') ||
          JSON.stringify(structure(tr.doc)) !== JSON.stringify(structure(state.doc)));
        if (boundary || (!tr.docChanged && tr.selectionSet && !tr.selection.eq(state.selection))) manager?.stopCapturing();
        return true;
      },
      view: () => ({ update: view => {
        if (boundary) { yUndoPluginKey.getState(view.state)?.undoManager.stopCapturing(); boundary = false; }
      } }),
    })];
  },
});
