import { useEffect, useMemo, useRef, useState } from 'react';
import { newId } from '@greiva/shared';
import type { PushOperation, StructuredSnapshot, Task, Relation } from '@greiva/protocol';
import { localStructuredStore } from './local-store';
import type { PageMetadata } from '../editor/local-page-store';
const labels = { todo: '未着手', in_progress: '進行中', done: '完了' } as const;
export function TaskPanel({ pageId, pages }: { pageId: string; pages: PageMetadata[] }) {
  const store = useMemo(localStructuredStore, []);
  const [snapshot, setSnapshot] = useState<StructuredSnapshot | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<Task['status']>('todo');
  const [due, setDue] = useState('');
  const titleInput = useRef<HTMLInputElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  useEffect(() => { if (focusRequest > 0) titleInput.current?.focus(); }, [focusRequest]);
  const composing = useRef(false);
  const [relationEditing, setRelationEditing] = useState<Relation | null>(null);
  const [from, setFrom] = useState(`page:${pageId}`);
  const [to, setTo] = useState('');
  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    void store.snapshot().then(value => { if (!cancelled) setSnapshot(value); }).catch(value => { if (!cancelled) setError(String(value)); });
    return () => { cancelled = true; };
  }, [store]);
  const tasks = snapshot?.tasks.filter(task => !task.deletedAt) ?? [];
  const relations = snapshot?.relations.filter(relation => !relation.deletedAt) ?? [];
  const endpoints = [...(pages.length ? pages : [{ id: pageId, title: 'このPage' }]).map(page => ({ value: `page:${page.id}`, label: `Page: ${page.title || '無題'}` })), ...tasks.map(task => ({ value: `task:${task.id}`, label: `Task: ${task.title || '無題'}` }))];
  async function save(entityType: PushOperation['entityType'], entityId: string, kind: PushOperation['kind'], payload: object, baseVersion: number | null) {
    if (!store || !snapshot?.clientId || busy) return false;
    setBusy(true); setError('');
    try {
      await store.mutate({ operationId: newId(), entityType, entityId, kind, payload, baseVersion, clientId: snapshot.clientId });
      setSnapshot(await store.snapshot()); return true;
    } catch (value) { setError(String(value)); return false; }
    finally { setBusy(false); }
  }
  if (!store) return <section className="structured-panel" aria-label="TaskとRelation"><h2>TaskとRelation</h2><p>このブラウザプレビューでは端末保存を利用できません。Taskの編集はWindowsアプリで利用できます。</p></section>;
  return <section className="structured-panel" aria-label="TaskとRelation">
    <h2>TaskとRelation</h2>
    <p className="structured-note">端末に保存します。TaskとRelationのサーバー同期は準備中です。</p>
    <output aria-label="Taskの保存状態" aria-live="polite">{busy ? '端末へ保存中…' : snapshot ? `端末に保存済み・送信待ち ${snapshot.operations.filter(operation => operation.status === 'pending').length}件` : 'Taskを読み込み中…'}</output>
    {error && <p role="alert">変更を保存できませんでした。入力内容は残っています。{error}</p>}
    <form className="task-form" aria-label="Taskを登録・編集" onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onSubmit={event => {
      event.preventDefault(); if (composing.current || busy) return;
      void save('task', editing?.id ?? newId(), editing ? 'update' : 'create', { title, status, due: due || null }, editing?.version ?? null).then(saved => {
        if (saved) { setEditing(null); setTitle(''); setStatus('todo'); setDue(''); setFocusRequest(value => value + 1); }
      });
    }}>
      <label>Taskの名前<input ref={titleInput} value={title} onChange={event => setTitle(event.target.value)} required disabled={!snapshot} readOnly={busy} /></label>
      <label>状態<select aria-label="Taskの状態" value={status} onChange={event => setStatus(event.target.value as Task['status'])} disabled={!snapshot || busy}>{Object.entries(labels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>期限<input type="date" value={due} onChange={event => setDue(event.target.value)} disabled={!snapshot || busy} /></label>
      <button type="submit" disabled={!snapshot || busy}>{editing ? '変更を保存' : 'Taskを追加'}</button>
      {editing && <button type="button" onClick={() => { setEditing(null); setTitle(''); setDue(''); setStatus('todo'); titleInput.current?.focus(); }}>編集を取消</button>}
    </form>
    <ul className="task-list" aria-label="保存したTask">{tasks.map(task => <li key={task.id} data-entity-id={task.id}>
      <div><strong>{task.title}</strong><span>{labels[task.status]}{task.due ? `・期限 ${task.due}` : ''}</span></div>
      <button type="button" aria-label={`${task.title}を編集`} disabled={busy} onClick={() => { setEditing(task); setTitle(task.title); setStatus(task.status); setDue(task.due ?? ''); titleInput.current?.focus(); }}>編集</button>
      <button type="button" aria-label={`${task.title}を削除`} disabled={busy} onClick={() => { void save('task', task.id, 'delete', {}, task.version).then(saved => {
        if (saved && editing?.id === task.id) { setEditing(null); setTitle(''); setDue(''); setStatus('todo'); }
      }); }}>削除</button>
    </li>)}</ul>
    <h3>Relation</h3>
    <form className="relation-form" aria-label="Relationを登録・編集" onSubmit={event => {
      event.preventDefault(); const destination = to || endpoints.find(endpoint => endpoint.value !== from)?.value;
      if (!destination) return;
      const [fromType,fromId] = from.split(':') as ['page'|'task',string];
      const [toType,toId] = destination.split(':') as ['page'|'task',string];
      void save('relation', relationEditing?.id ?? newId(), relationEditing ? 'update' : 'create', { fromType,fromId,toType,toId }, relationEditing?.version ?? null).then(saved => { if (saved) setRelationEditing(null); });
    }}>
      <label>関連元<select value={from} onChange={event => setFrom(event.target.value)} disabled={busy}>{endpoints.map(endpoint => <option key={endpoint.value} value={endpoint.value}>{endpoint.label}</option>)}</select></label>
      <label>関連先<select value={to || endpoints.find(endpoint => endpoint.value !== from)?.value || ''} onChange={event => setTo(event.target.value)} disabled={busy}>{endpoints.map(endpoint => <option key={endpoint.value} value={endpoint.value}>{endpoint.label}</option>)}</select></label>
      <button type="submit" disabled={!snapshot || busy || endpoints.length < 2}>{relationEditing ? 'Relationの変更を保存' : 'Relationを追加'}</button>
      {relationEditing && <button type="button" onClick={() => setRelationEditing(null)}>Relationの編集を取消</button>}
    </form>
    <ul className="relation-list" aria-label="保存したRelation">{relations.map(relation => <li key={relation.id} data-entity-id={relation.id}>
      <span>{endpoints.find(endpoint => endpoint.value === `${relation.fromType}:${relation.fromId}`)?.label ?? '削除済みの関連元'} → {endpoints.find(endpoint => endpoint.value === `${relation.toType}:${relation.toId}`)?.label ?? '削除済みの関連先'}</span>
      <button type="button" aria-label="Relationを編集" disabled={busy} onClick={() => { setRelationEditing(relation); setFrom(`${relation.fromType}:${relation.fromId}`); setTo(`${relation.toType}:${relation.toId}`); }}>編集</button>
      <button type="button" aria-label="Relationを削除" disabled={busy} onClick={() => { void save('relation',relation.id,'delete',{},relation.version).then(saved => { if (saved && relationEditing?.id === relation.id) setRelationEditing(null); }); }}>削除</button>
    </li>)}</ul>
  </section>;
}
