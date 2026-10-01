import * as Y from 'yjs';
// Reserve client ID 1 for this seed, shared with a newly created offline Page.
export function emptyPageUpdate() {
  const seed = new Y.Doc();
  seed.clientID = 1;
  seed.getXmlFragment('body').insert(0, [new Y.XmlElement('paragraph')]);
  const update = Y.encodeStateAsUpdate(seed);
  seed.destroy();
  return update;
}
