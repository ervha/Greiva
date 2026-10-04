import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import { adjacentBlockMove, moveTopLevelBlock } from './blocks';

const dragType = 'application/x-greiva-block';
type DragRow = { pos: number; element: HTMLElement; anchor: HTMLElement | null; selector: string; top: number; height: number };
type Drag = { from: number; doc: Node; view: EditorView; rows: DragRow[]; space: number; before: number;
  preview: HTMLElement; styles: HTMLStyleElement; left: number; window: Window; offsetY: number; dispose: () => void };
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
    let drag: Drag | null = null;
    let ownsDrag = false;
    const clear = () => {
      if (!drag) return;
      const current = drag; drag = null;
      current.dispose(); current.preview.remove(); current.styles.remove();
      current.view.dom.classList.remove('is-block-dragging');
      current.view.dom.ownerDocument.body.classList.remove('greiva-block-dragging');
    };
    // Hit-testing uses the original layout, never the animated preview positions.
    const beforeAt = (current: Drag, clientY: number) => {
      const y = clientY + current.window.scrollY;
      return current.rows.find(row => y < row.top + row.height / 2)?.pos ?? current.doc.content.size;
    };
    const positionPreview = (current: Drag, event: DragEvent) => {
      // Like a playlist row, keep its column and width while following vertical motion.
      current.preview.style.left = `${current.left}px`;
      current.preview.style.top = `${event.clientY - current.offsetY - 6}px`;
    };
    const showDestination = (current: Drag, before: number) => {
      if (current.before === before) return;
      current.before = before;
      const rules = [];
      for (const row of current.rows) {
        const shift = before < current.from && row.pos >= before && row.pos < current.from ? current.space :
          before > current.from && row.pos > current.from && row.pos < before ? -current.space : 0;
        rules.push(`${row.selector} { transform: translateY(${shift}px); transition: transform var(--motion-normal, 160ms) var(--motion-ease, ease); }`);
      }
      const source = current.rows.find(row => row.pos === current.from)!;
      rules.push(`${source.selector} { opacity: 0; }`);
      rules.push(`@media (prefers-reduced-motion: reduce) { ${current.rows.map(row => row.selector).join(', ')} { transition: none; } }`);
      current.styles.textContent = rules.join('\n');
    };
    const insideRows = (view: EditorView, event: DragEvent) => {
      const rect = view.dom.getBoundingClientRect();
      // The handle column belongs to the rows, including the padding left of the editor DOM.
      return event.clientX >= rect.left - 40 && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    };
    const dragOver = (view: EditorView, event: DragEvent) => {
      if (!event.dataTransfer?.types.includes(dragType)) return false;
      event.preventDefault();
      if (!drag || view.composing || !view.state.doc.eq(drag.doc)) { clear(); event.dataTransfer.dropEffect = 'none'; return true; }
      event.dataTransfer.dropEffect = 'move';
      showDestination(drag, beforeAt(drag, event.clientY));
      return true;
    };
    const drop = (view: EditorView, event: DragEvent) => {
      if (!event.dataTransfer?.types.includes(dragType)) return false;
      event.preventDefault();
      const source = drag, before = source ? beforeAt(source, event.clientY) : 0;
      clear(); ownsDrag = false;
      if (!source || view.composing || !view.state.doc.eq(source.doc)) return true;
      const tr = moveTopLevelBlock(view.state, source.from, before);
      if (tr) { view.dispatch(tr); view.focus(); }
      return true;
    };
    const start = (view: EditorView, from: number, event: DragEvent) => {
      clear();
      const owner = view.dom.ownerDocument, window = owner.defaultView;
      if (!window) return false;
      const rows: DragRow[] = [];
      const childIndexes = new Map(Array.from(view.dom.children, (element, index) => [element, index + 1] as const));
      view.state.doc.forEach((_node, pos) => {
        const element = view.nodeDOM(pos);
        if (!(element instanceof HTMLElement)) return;
        const rect = element.getBoundingClientRect();
        const previous = element.previousElementSibling;
        const anchor = previous instanceof HTMLElement && previous.classList.contains('block-handle-anchor') ? previous : null;
        const selectors = [element, anchor].filter(Boolean).map(child => `.is-block-dragging > :nth-child(${childIndexes.get(child!)})`);
        rows.push({ pos, element, anchor, selector: selectors.join(', '),
          top: rect.top + window.scrollY, height: rect.height });
      });
      const index = rows.findIndex(row => row.pos === from), source = rows[index];
      if (!source) return false;
      const rect = source.element.getBoundingClientRect();
      const preview = owner.createElement('div');
      preview.className = 'tiptap block-drag-preview';
      preview.contentEditable = 'false'; preview.setAttribute('aria-hidden', 'true'); preview.setAttribute('inert', '');
      preview.style.width = `${rect.width + 40}px`;
      const copy = source.element.cloneNode(true) as HTMLElement;
      copy.removeAttribute('id'); copy.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
      const grip = owner.createElement('span'); grip.className = 'block-drag-preview-grip'; grip.textContent = '⠿';
      const handle = source.anchor?.querySelector('.block-handle');
      grip.style.top = `${(handle?.getBoundingClientRect().top ?? rect.top) - rect.top + 6}px`;
      preview.append(grip, copy); owner.body.append(preview);
      const styles = owner.createElement('style'); owner.head.append(styles);
      const current: Drag = { from, doc: view.state.doc, view, rows, preview, styles, window, before: -1,
        left: Math.max(8, Math.min(rect.left - 40, window.innerWidth - preview.getBoundingClientRect().width - 8)),
        space: Math.max(rect.height, rows[index + 1] ? rows[index + 1]!.top - source.top : rect.height + parseFloat(window.getComputedStyle(source.element).marginBottom || '0')),
        offsetY: event.clientY - rect.top, dispose: () => {} };
      drag = current; ownsDrag = true;
      window.addEventListener('blur', clear); window.addEventListener('resize', clear);
      current.dispose = () => { window.removeEventListener('blur', clear); window.removeEventListener('resize', clear); };
      view.dom.classList.add('is-block-dragging'); owner.body.classList.add('greiva-block-dragging');
      // Styling outside the editor avoids reparsing its DOM and replacing the native drag handle.
      showDestination(current, from);
      positionPreview(current, event);
      // The DOM card follows the pointer; avoid a second browser-generated ghost.
      const transparent = owner.createElement('canvas'); transparent.width = transparent.height = 1;
      event.dataTransfer!.setDragImage(transparent, 0, 0);
      return true;
    };
    return [new Plugin({
      key: new PluginKey('greivaBlockDrag'),
      props: {
        decorations: state => {
          const decorations: Decoration[] = [];
          state.doc.forEach((_node, pos, index) => {
            decorations.push(Decoration.widget(pos, (view, getPos) => {
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
                // A retained widget may have shifted after preceding text edits.
                // Read its current position and payload rather than its creation state.
                const from = getPos();
                const node = from === undefined ? null : view.state.doc.nodeAt(from);
                if (!event.dataTransfer || view.composing || from === undefined || !node) { event.preventDefault(); return; }
                if (!start(view, from, event)) { event.preventDefault(); return; }
                event.dataTransfer.setData(dragType, 'move');
                event.dataTransfer.setData('text/plain', node.textContent);
                event.dataTransfer.effectAllowed = 'move';
                event.stopPropagation();
              });
              wrapper.append(handle);
              return wrapper;
            // The handle represents the current ordinal, not a captured block.
            // Equal keys let ProseMirror retain its DOM during ordinary typing.
            }, { key: `greiva-block-handle-${index}`, side: -1, stopEvent: () => true }));
          });
          return DecorationSet.create(state.doc, decorations);
        },
        handleDOMEvents: {
          dragover: dragOver,
          drop,
          compositionstart: () => { clear(); return false; },
        },
      },
      view: view => {
        const owner = view.dom.ownerDocument;
        // Capture also reaches widget handles, whose stopEvent intentionally protects selection.
        const over = (event: DragEvent) => {
          if (!ownsDrag || !event.dataTransfer?.types.includes(dragType)) return;
          event.preventDefault(); event.stopPropagation();
          if (drag) positionPreview(drag, event);
          if (insideRows(view, event)) dragOver(view, event);
          else event.dataTransfer.dropEffect = 'none';
        };
        const release = (event: DragEvent) => {
          if (!ownsDrag || !event.dataTransfer?.types.includes(dragType)) return;
          event.preventDefault(); event.stopPropagation();
          if (insideRows(view, event)) drop(view, event);
          else { clear(); ownsDrag = false; }
        };
        const end = () => { const current = drag; clear(); ownsDrag = false; if (current && owner.hasFocus()) view.focus(); };
        owner.addEventListener('dragover', over, true); owner.addEventListener('drop', release, true); owner.addEventListener('dragend', end, true);
        return {
          update: () => { if (drag && (view.composing || !view.state.doc.eq(drag.doc))) clear(); },
          destroy: () => { clear(); ownsDrag = false; owner.removeEventListener('dragover', over, true); owner.removeEventListener('drop', release, true); owner.removeEventListener('dragend', end, true); },
        };
      },
    })];
  },
});
