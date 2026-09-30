import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node } from '@tiptap/pm/model';
import { adjacentBlockMove, moveTopLevelBlock } from './blocks';

const dragType = 'application/x-greiva-block';
export const BlockDrag = Extension.create({
  name: 'blockDrag',
  addKeyboardShortcuts() {
    const move = (direction: -1 | 1) => {
      if (this.editor.view.composing) return false;
      const tr = adjacentBlockMove(this.editor.state, direction);
      if (!tr) return false;
      this.editor.view.dispatch(tr);
      return true;
    };
    return { 'Mod-Shift-ArrowUp': () => move(-1), 'Mod-Shift-ArrowDown': () => move(1) };
  },
  addProseMirrorPlugins() {
    let drag: { from: number; doc: Node } | null = null;
    return [new Plugin({
      key: new PluginKey('greivaBlockDrag'),
      props: {
        decorations: state => {
          const decorations: Decoration[] = [];
          state.doc.forEach((node, pos, index) => {
            decorations.push(Decoration.widget(pos, view => {
              const wrapper = document.createElement('span');
              wrapper.className = 'block-handle-anchor';
              wrapper.contentEditable = 'false';
              const handle = document.createElement('button');
              handle.type = 'button';
              handle.className = 'block-handle';
              handle.textContent = '⠿';
              handle.draggable = true;
              handle.setAttribute('aria-label', `ブロック${index + 1}をドラッグして移動`);
              handle.title = 'ドラッグで移動（Ctrl+Shift+↑ / ↓）';
              // The widget's stopEvent keeps ProseMirror from changing the selection.
              // Cancelling mousedown here would also cancel the browser's native drag.
              handle.addEventListener('dragstart', event => {
                if (!event.dataTransfer || view.composing) { event.preventDefault(); return; }
                drag = { from: pos, doc: view.state.doc };
                event.dataTransfer.setData(dragType, 'move');
                event.dataTransfer.setData('text/plain', node.textContent);
                event.dataTransfer.effectAllowed = 'move';
                event.stopPropagation();
              });
              handle.addEventListener('dragend', () => { drag = null; });
              wrapper.append(handle);
              return wrapper;
            }, { side: -1, stopEvent: () => true }));
          });
          return DecorationSet.create(state.doc, decorations);
        },
        handleDOMEvents: {
          dragover: (_view, event) => {
            if (!drag || !event.dataTransfer?.types.includes(dragType)) return false;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            return true;
          },
          drop: (view, event) => {
            if (!drag || !event.dataTransfer?.types.includes(dragType)) return false;
            event.preventDefault();
            const source = drag;
            drag = null;
            // Abort a stale drag if an intervening edit changed positions.
            if (view.composing || !view.state.doc.eq(source.doc)) return true;
            let before = view.state.doc.content.size;
            let found = false;
            view.state.doc.forEach((_node, pos) => {
              if (found) return;
              const element = view.nodeDOM(pos);
              if (!(element instanceof HTMLElement)) return;
              const rect = element.getBoundingClientRect();
              if (event.clientY < rect.top + rect.height / 2) { before = pos; found = true; }
            });
            const tr = moveTopLevelBlock(view.state, source.from, before);
            if (tr) { view.dispatch(tr); view.focus(); }
            return true;
          },
        },
      },
      view: () => ({ destroy: () => { drag = null; } }),
    })];
  },
});
