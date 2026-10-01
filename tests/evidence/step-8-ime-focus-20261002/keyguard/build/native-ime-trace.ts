// Diagnostic-only probe, copied into an isolated Docker build. Never imported by product source.
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { invoke } from '@tauri-apps/api/core';
import * as Y from 'yjs';
let sequence = 0;
let normalizeForProbe = false;
const emit = (record: Record<string, unknown>) => {
  const message = { seq: ++sequence, at: new Date().toISOString(), monotonicMs: performance.now(), ...record };
  void invoke('ime_trace', { record: message }).catch(error => console.error('IME trace transport failed', error));
};
function point(root: HTMLElement, node: Node | null, offset: number) {
  if (!node || !root.contains(node)) return null;
  const path: number[] = [];
  for (let child = node; child !== root && child.parentNode; child = child.parentNode) path.unshift(Array.prototype.indexOf.call(child.parentNode.childNodes, child));
  let textOffset: number | null = null;
  try { const range = document.createRange(); range.setStart(root, 0); range.setEnd(node, offset); textOffset = range.toString().length; } catch { /* Non-text position retained in path. */ }
  return { path, offset, textOffset, nodeName: node.nodeName, nodeText: node.textContent };
}
function snapshot(root: HTMLElement, editor?: Editor) {
  const sel = document.getSelection();
  return {
    domText: root.textContent, domHtml: root.innerHTML,
    domSelection: sel ? { anchor: point(root, sel.anchorNode, sel.anchorOffset), focus: point(root, sel.focusNode, sel.focusOffset), selected: sel.toString() } : null,
    pm: editor ? { text: editor.state.doc.textContent, doc: editor.getJSON(), from: editor.state.selection.from, to: editor.state.selection.to, anchor: editor.state.selection.anchor, head: editor.state.selection.head, composing: editor.view.composing } : null,
    textarea: root instanceof HTMLTextAreaElement ? { value: root.value, start: root.selectionStart, end: root.selectionEnd, direction: root.selectionDirection } : null,
  };
}
function observe(label: string, root: HTMLElement, pageId: string, editor?: Editor, ydoc?: Y.Doc) {
  const log = (type: string, detail: Record<string, unknown> = {}) => emit({ surface: label, pageId, type, ...snapshot(root, editor), ...detail });
  const capture = (event: Event) => {
    if (!(event.target instanceof Node) || !root.contains(event.target)) return;
    const input = event as InputEvent, key = event as KeyboardEvent, composition = event as CompositionEvent;
    const ranges = typeof input.getTargetRanges === 'function' ? input.getTargetRanges().map(range => ({ start: point(root, range.startContainer, range.startOffset), end: point(root, range.endContainer, range.endOffset) })) : [];
    log(event.type, { phase: 'capture', trusted: event.isTrusted, defaultPrevented: event.defaultPrevented,
      key: key.key, code: key.code, keyCode: key.keyCode, shift: key.shiftKey, ctrl: key.ctrlKey, alt: key.altKey,
      isComposing: input.isComposing, inputType: input.inputType, data: input.data ?? composition.data, targetRanges: ranges });
    if (normalizeForProbe && label === 'greiva' && event.type === 'keydown' && key.code === 'Convert' && editor && !editor.view.composing) {
      const selection = document.getSelection();
      if (selection && !selection.isCollapsed && selection.rangeCount === 1) {
        const range = selection.getRangeAt(0);
        if (root.contains(range.startContainer) && root.contains(range.endContainer) &&
            selection.anchorNode === range.endContainer && selection.anchorOffset === range.endOffset &&
            selection.focusNode === range.startContainer && selection.focusOffset === range.startOffset) {
          const before = snapshot(root, editor);
          selection.setBaseAndExtent(range.startContainer,range.startOffset,range.endContainer,range.endOffset);
          log('probe-selection-direction',{ beforeSnapshot: before, scope: 'Experimental probe only; same selected range, forward anchor/focus; no preventDefault or composition cancellation.' });
        }
      }
    }
  };
  const events = ['keydown','keyup','beforeinput','input','compositionstart','compositionupdate','compositionend','focus','blur'];
  for (const type of events) root.addEventListener(type, capture, true);
  const selection = () => { if (document.activeElement === root || root.contains(document.activeElement)) log('selectionchange'); };
  document.addEventListener('selectionchange', selection);
  const mutations = new MutationObserver(records => log('mutations', { records: records.map(r => ({ kind: r.type, oldValue: r.oldValue, target: point(root, r.target, 0), added: [...r.addedNodes].map(n => n.textContent), removed: [...r.removedNodes].map(n => n.textContent) })) }));
  mutations.observe(root, { subtree: true, characterData: true, characterDataOldValue: true, childList: true });
  const onTransaction = ({ transaction: tr }: { transaction: import('@tiptap/pm/state').Transaction }) => log('pm-transaction', {
    before: tr.before.toJSON(), after: tr.doc.toJSON(), steps: tr.steps.map(step => step.toJSON()),
    composition: tr.getMeta('composition'), uiEvent: tr.getMeta('uiEvent'), ySyncChangeOrigin: tr.getMeta('y-sync$')?.isChangeOrigin,
  });
  editor?.on('transaction', onTransaction);
  const update = (bytes: Uint8Array, origin: unknown) => {
    const decoded = Y.decodeUpdate(bytes);
    log('y-update', { bytes: bytes.length, origin: typeof origin === 'string' ? origin : origin?.constructor?.name,
      xml: ydoc?.getXmlFragment('body').toString(), deletes: [...decoded.ds.clients].flatMap(([client,ranges]) => ranges.map(r => ({ client, clock: r.clock, length: r.len }))),
      structs: decoded.structs.map(s => ({ client: s.id.client, clock: s.id.clock, length: s.length })) });
  };
  ydoc?.on('update', update);
  log('trace-attached');
  return () => {
    for (const type of events) root.removeEventListener(type, capture, true);
    document.removeEventListener('selectionchange', selection); mutations.disconnect();
    editor?.off('transaction', onTransaction); ydoc?.off('update', update); log('trace-detached');
  };
}
export function installImeTrace(editor: Editor, ydoc: Y.Doc, pageId: string) {
  const stopGreiva = observe('greiva', editor.view.dom, pageId, editor, ydoc);
  const panel = document.createElement('section'); panel.setAttribute('aria-label','IME診断・比較入力');
  const heading = document.createElement('p'); heading.textContent = 'IME診断候補 — 入力イベントをローカルログへ記録（製品候補とは別）'; panel.append(heading);
  const switchLabel = document.createElement('label');
  const guardSwitch = document.createElement('input'); guardSwitch.type='checkbox'; guardSwitch.checked=normalizeForProbe;
  guardSwitch.setAttribute('aria-label','診断 再変換の選択方向更新');
  guardSwitch.addEventListener('change',()=>{normalizeForProbe=guardSwitch.checked;emit({pageId,type:'probe-switch',enabled:normalizeForProbe});});
  switchLabel.append(guardSwitch,document.createTextNode('診断: 再変換キーで選択方向を更新（実験）')); panel.append(switchLabel);
  const surfaces: [string, HTMLElement][] = [];
  for (const [name, tag] of [['textarea','textarea'],['plain-dom','div'],['plain-pm','div']] as const) {
    const label = document.createElement('p'); label.textContent = `診断 ${name}`; panel.append(label);
    const element = document.createElement(tag); element.setAttribute('aria-label',`診断 ${name}`);
    element.style.cssText = 'border:1px solid #777;min-height:48px;padding:8px;background:white;color:black;width:100%;box-sizing:border-box';
    if (name === 'textarea') (element as HTMLTextAreaElement).value = 'MS65 local ';
    if (name === 'plain-dom') { element.contentEditable = 'true'; element.setAttribute('role','textbox'); element.textContent = 'MS65 local '; }
    panel.append(element); surfaces.push([name,element]);
  }
  editor.view.dom.closest('.editor-panel')?.append(panel);
  const plain = new Editor({ element: surfaces[2]![1], extensions: [StarterKit], content: '<p>MS65 local </p>', editorProps: { attributes: { 'aria-label':'診断 plain-pm本文', role:'textbox' } } });
  const cleanups = [stopGreiva, observe('textarea',surfaces[0]![1],pageId), observe('plain-dom',surfaces[1]![1],pageId), observe('plain-pm',plain.view.dom,pageId,plain)];
  return () => { for (const stop of cleanups) stop(); plain.destroy(); panel.remove(); };
}
