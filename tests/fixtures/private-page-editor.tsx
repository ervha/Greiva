import { createRoot } from 'react-dom/client';
import { PrivatePageEditor } from '../../apps/client/src/editor/PrivatePageEditor';
import { PrivatePageEditorSession } from '../../apps/client/src/editor/private-page-session';
import { privateEditorFixture } from '../support/private-page-editor-fixture';
import '../../apps/client/src/style.css';
if (import.meta.env.VITE_GREIVA_TEST_HOOKS !== '1') throw Error('Test fixture disabled');
const fixture = await privateEditorFixture();
let session = await PrivatePageEditorSession.open(fixture.connection, fixture.store, fixture.pageId, { kind: 'create', title: '検証用Page' });
const root = createRoot(document.getElementById('root')!);
const render = () => root.render(<main><h1>Page編集の検証</h1><PrivatePageEditor session={session} /></main>);
render();
const test = {
  snapshot: () => ({ state: session.snapshot, body: session.document.getXmlFragment('body').toString(), server: fixture.server.getXmlFragment('body').toString(), pending: fixture.state.queue.length, events: fixture.state.events.slice() }),
  remote: (text: string) => fixture.edit(fixture.server, text),
  durable: () => session.durable(),
  refresh: () => fixture.auth.refresh(),
  loseAck: () => { fixture.state.loseAck = true; },
  failStorage: () => { fixture.state.nativeHook = async request => { if (request.command === 'page_append') throw Error('fixture-private-storage'); }; },
  reopen: async () => { await session.close(); session = await PrivatePageEditorSession.open(fixture.connection, fixture.store, fixture.pageId, { kind: 'local' }); render(); },
};
(window as unknown as { privateEditorTest: typeof test }).privateEditorTest = test;
