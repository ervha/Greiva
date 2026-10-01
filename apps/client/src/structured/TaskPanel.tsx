import { useEffect, useMemo, useRef, useState } from 'react';
import { newId } from '@greiva/shared';
import type { PushOperation, StructuredSnapshot, Task, Relation, Conflict } from '@greiva/protocol';
import { StructuredSyncEngine, httpStructuredTransport, type StructuredReport, type StructuredPhase } from '@greiva/sync';
import { localStructuredStore } from './local-store';
import type { PageMetadata } from '../editor/local-page-store';
const labels = { todo: '未着手', in_progress: '進行中', done: '完了' } as const;
const syncLabels: Record<StructuredPhase,string> = {loading:'読み込み中…',syncing:'同期中…',synced:'サーバーと同期済み',offline:'オフライン',retrying:'再試行待ち', 'storage-error':'保存・受信のエラー', 'protocol-error':'同期データのエラー', 'permission-error':'同期の権限エラー',conflict:'競合の解決待ち',rejected:'送信できない変更があります'};
const fieldLabels = {title:'名前',status:'状態',due:'期限',fromType:'関連元の種類',fromId:'関連元',toType:'関連先の種類',toId:'関連先'};
export function TaskPanel({ pageId, pages, paused }: { pageId: string; pages: PageMetadata[]; paused: boolean }) {
  const store = useMemo(localStructuredStore, []);
  const [snapshot, setSnapshot] = useState<StructuredSnapshot | null>(null);
  const [sync, setSync] = useState<StructuredReport>({phase:'loading',snapshot:null,error:null});
  const engine = useRef<StructuredSyncEngine | null>(null);
  const pausedRef = useRef(paused); pausedRef.current = paused;
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
  const conflictSection = useRef<HTMLElement>(null);
  const [conflictFocusRequest,setConflictFocusRequest] = useState(0);
  useEffect(()=> { if (conflictFocusRequest>0) conflictSection.current?.focus(); },[conflictFocusRequest]);
  useEffect(() => {
    if (!store) return;
    const current = new StructuredSyncEngine(store,httpStructuredTransport(),value=> {setSync(value); if (value.snapshot) setSnapshot(value.snapshot);},{paused:pausedRef.current});
    engine.current = current; current.start();
    return () => { current.stop(); if (engine.current===current) engine.current=null; };
  }, [store]);
  useEffect(()=> { engine.current?.setPaused(paused); },[paused]);
  const tasks = snapshot?.tasks.filter(task => !task.deletedAt) ?? [];
  const relations = snapshot?.relations.filter(relation => !relation.deletedAt) ?? [];
  const endpoints = [...(pages.length ? pages : [{ id: pageId, title: 'このPage' }]).map(page => ({ value: `page:${page.id}`, label: `Page: ${page.title || '無題'}` })), ...tasks.map(task => ({ value: `task:${task.id}`, label: `Task: ${task.title || '無題'}` }))];
  async function save(entityType: PushOperation['entityType'], entityId: string, kind: PushOperation['kind'], payload: object, baseVersion: number | null,resolution?: PushOperation['resolution']) {
    if (!store || !snapshot?.clientId || busy) return false;
    setBusy(true); setError('');
    try {
      await store.mutate({ operationId: newId(), entityType, entityId, kind, payload, baseVersion, clientId: snapshot.clientId,...(resolution ? {resolution} : {}) });
      await engine.current?.localChanged(); return true;
    } catch (value) { setError(String(value)); return false; }
    finally { setBusy(false); }
  }
  const openConflicts = snapshot?.conflicts.filter(conflict=>conflict.status==='open') ?? [];
  async function resolveConflict(conflict: Conflict,choice: 'local'|'remote') {
    const entity = conflict.entityType==='task' ? snapshot?.tasks.find(task=>task.id===conflict.entityId) : snapshot?.relations.find(relation=>relation.id===conflict.entityId);
    if (!entity || entity.deletedAt) { setError('対象が削除されたか、読み込めません。同期状態を確認してください。'); return; }
    const saved = await save(conflict.entityType,conflict.entityId,'update',{[conflict.field]:conflict[choice]},entity.version,{conflictIds:[conflict.id],choice});
    if (saved) setConflictFocusRequest(value=>value+1);
  }
  function valueLabel(field: Conflict['field'],value: unknown) {
    if (value===null) return '未設定';
    if (field==='status' && typeof value==='string' && value in labels) return labels[value as Task['status']];
    if (field==='fromId' || field==='toId') return endpoints.find(endpoint=>endpoint.value.endsWith(`:${String(value)}`))?.label ?? String(value);
    return String(value);
  }
  if (!store) return <section className="structured-panel" aria-label="TaskとRelation"><h2>TaskとRelation</h2><p>このブラウザプレビューでは端末保存を利用できません。Taskの編集はWindowsアプリで利用できます。</p></section>;
  return <section className="structured-panel" aria-label="TaskとRelation">
    <h2>TaskとRelation</h2>
    <p className="structured-note">TaskとRelationを端末へ保存し、接続中はサーバーへ同期します。</p>
    <output aria-label="Taskの保存状態" aria-live="polite">{busy ? '端末へ保存中…' : snapshot ? `端末に保存済み・送信待ち ${snapshot.operations.filter(operation => operation.status === 'pending').length}件` : 'Taskを読み込み中…'}</output>
    <div className="structured-sync"><output aria-label="TaskとRelationの同期状態" aria-live="polite">{busy ? '端末へ保存中…' : paused ? 'オフライン' : syncLabels[sync.phase]}</output>
      {sync.error && <span>{sync.error}</span>}
      {['retrying','storage-error','protocol-error','permission-error'].includes(sync.phase) && <button type="button" disabled={paused} onClick={()=>engine.current?.retry()}>Taskの同期を再試行</button>}
    </div>
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
    <section className="structured-conflicts" aria-label="競合一覧" ref={conflictSection} tabIndex={-1}>
      <h3>競合 {openConflicts.length}件</h3>
      {openConflicts.length===0 ? <p className="structured-note">未解決の競合はありません。</p> : <p className="structured-note">両方の変更を保持しています。採用する値を選ぶと、新しい変更として保存・同期します。</p>}
      {openConflicts.map(conflict=> <article key={conflict.id} className="conflict-card" aria-label={`${fieldLabels[conflict.field]}の競合`}>
        <strong>{conflict.entityType==='task' ? snapshot?.tasks.find(task=>task.id===conflict.entityId)?.title || 'Task' : 'Relation'}・{fieldLabels[conflict.field]}</strong>
        <dl><div><dt>変更前（base）</dt><dd>{valueLabel(conflict.field,conflict.base)}</dd></div><div><dt>この端末（local）</dt><dd>{valueLabel(conflict.field,conflict.local)}</dd></div><div><dt>他の端末（remote）</dt><dd>{valueLabel(conflict.field,conflict.remote)}</dd></div></dl>
        <time dateTime={conflict.createdAt}>{conflict.createdAt}</time>
        <div className="conflict-actions"><button type="button" disabled={busy || snapshot?.operations.some(operation=>operation.entityId===conflict.entityId && operation.status==='pending')} onClick={()=>void resolveConflict(conflict,'local')}>この端末の値を採用</button>
          <button type="button" disabled={busy || snapshot?.operations.some(operation=>operation.entityId===conflict.entityId && operation.status==='pending')} onClick={()=>void resolveConflict(conflict,'remote')}>他の端末の値を採用</button></div>
      </article>)}
    </section>
    {(snapshot?.errors.length ?? 0)>0 && <section className="structured-errors" aria-label="送信できない変更"><h3>送信できない変更</h3><p>元の操作と入力を端末に保持しています。原因を確認してから修正してください。</p>{snapshot?.errors.map(failure=> <div key={failure.operationId}><strong>{failure.error}</strong><pre>{JSON.stringify(snapshot.operations.find(operation=>operation.operationId===failure.operationId)?.payload,null,2)}</pre></div>)}</section>}
  </section>;
}
