import { describe, it, expect, vi } from 'vitest';
import { newId } from '@greiva/shared';
import { privateWorkspaceAccess, PrivateWorkspaceAccessDenied, type PrivateWorkspaceAccessStore } from '@greiva/application';
import type { PrivateAccessSnapshot, ResourceReference } from '@greiva/domain';

function fixture() {
  const workspace = { id: newId(), ownerSubjectId: 'provider-subject-A' };
  const resource = { type: 'page' as const, id: newId(), workspaceId: workspace.id, deleted: false };
  const read = vi.fn(async (_id: string, targets: readonly ResourceReference[]): Promise<PrivateAccessSnapshot | null> => ({ workspace, resources: targets.length ? [resource] : [] }));
  return { workspace, resource, read, access: privateWorkspaceAccess(workspace.ownerSubjectId, { read }) };
}
describe('private workspace ownership and resource access', () => {
  it('allows only the captured verified subject to read its workspace scope', async () => {
    const f = fixture(); await expect(f.access.workspace(f.workspace.id)).resolves.toEqual({ subjectId: f.workspace.ownerSubjectId, workspaceId: f.workspace.id, resources: [] });
    expect(f.read).toHaveBeenCalledWith(f.workspace.id, []);
    const other = privateWorkspaceAccess('provider-subject-B', { read: f.read });
    await expect(other.workspace(f.workspace.id)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
  });
  it('authorizes an exact typed Page/document and treats client ID as no identity proof', async () => {
    const f = fixture(); await expect(f.access.resources(f.workspace.id, [{ type: 'page', id: f.resource.id }])).resolves.toMatchObject({ workspaceId: f.workspace.id });
    await expect(f.access.pageDocument(f.workspace.id, `page:${f.resource.id}`)).resolves.toMatchObject({ workspaceId: f.workspace.id });
    const other = privateWorkspaceAccess(newId(), { read: f.read });
    await expect(other.pageDocument(f.workspace.id, `page:${f.resource.id}`)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
  });
  it('rejects missing or mismatched workspace metadata', async () => {
    const f = fixture(); f.read.mockResolvedValueOnce(null);
    await expect(f.access.workspace(f.workspace.id)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    f.read.mockResolvedValueOnce({ workspace: { ...f.workspace, id: newId() }, resources: [] });
    await expect(f.access.workspace(f.workspace.id)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
  });
  it('rejects foreign resources even when the user owns both workspaces', async () => {
    const f = fixture(); f.resource.workspaceId = newId();
    await expect(f.access.pageDocument(f.workspace.id, `page:${f.resource.id}`)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
  });
  it('rejects missing, deleted, duplicate, unexpected and wrong-type metadata', async () => {
    const f = fixture(), target = { type: 'page', id: f.resource.id };
    for (const resources of [[], [{ ...f.resource, deleted: true }], [f.resource, f.resource], [f.resource, { ...f.resource, id: newId() }], [{ ...f.resource, type: 'task' as const }]]) {
      f.read.mockResolvedValueOnce({ workspace: f.workspace, resources });
      await expect(f.access.resources(f.workspace.id, [target])).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    }
    await expect(f.access.resources(f.workspace.id, [target, target])).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
  });
  it('handles same UUID with different resource types using the typed identity', async () => {
    const f = fixture(); f.read.mockResolvedValueOnce({ workspace: f.workspace, resources: [f.resource, { ...f.resource, type: 'task' }] });
    await expect(f.access.resources(f.workspace.id, [{ type: 'page', id: f.resource.id }, { type: 'task', id: f.resource.id }])).resolves.toMatchObject({ workspaceId: f.workspace.id });
  });
  it('rejects empty targets and invalid workspace/resource IDs before reading metadata', async () => {
    const f = fixture();
    for (const [workspace, targets] of [[f.workspace.id, []], ['invalid', [{ type: 'page', id: f.resource.id }]], [f.workspace.id, [{ type: 'page', id: 'invalid' }]], [f.workspace.id, [{ type: 'page', id: f.resource.id, subjectId: f.workspace.ownerSubjectId }]]] as const) {
      await expect(f.access.resources(workspace, targets)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    }
    expect(f.read).not.toHaveBeenCalled();
  });
  it('does not permit a document namespace, suffix, path, case or encoding alias', async () => {
    const f = fixture();
    for (const name of [`task:${f.resource.id}`, `page:${f.resource.id}:body`, `page:${f.resource.id}/../other`, `PAGE:${f.resource.id}`, `page%3A${f.resource.id}`, `page:page:${f.resource.id}`, null]) {
      await expect(f.access.pageDocument(f.workspace.id, name)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    }
    expect(f.read).not.toHaveBeenCalled();
  });
  it('captures resources before an async read and returns immutable context', async () => {
    const f = fixture(), target = { type: 'page', id: f.resource.id };
    let release!: (value: PrivateAccessSnapshot) => void;
    f.read.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const result = f.access.resources(f.workspace.id, [target]); target.id = newId();
    release({ workspace: f.workspace, resources: [f.resource] });
    const scope = await result;
    expect(Object.isFrozen(scope)).toBe(true);
    expect(scope.resources).toEqual([{ type: 'page', id: f.resource.id }]);
    expect(Object.isFrozen(scope.resources[0])).toBe(true);
    expect(f.read.mock.calls[0]![1][0]!.id).toBe(f.resource.id);
    expect(Object.isFrozen(f.read.mock.calls[0]![1])).toBe(true);
  });
  it('fails closed on unavailable or invalid authority and never creates a default workspace', async () => {
    const f = fixture(), failure = Error('Metadata unavailable'); f.read.mockRejectedValueOnce(failure);
    await expect(f.access.workspace(f.workspace.id)).rejects.toBe(failure);
    const invalid: PrivateWorkspaceAccessStore = { read: async () => ({ workspace: { ...f.workspace, ownerSubjectId: '' }, resources: [] }) };
    await expect(privateWorkspaceAccess(f.workspace.ownerSubjectId, invalid).workspace(f.workspace.id)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    expect(() => privateWorkspaceAccess('  ', { read: f.read })).toThrow();
  });
});
