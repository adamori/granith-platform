import * as projectsApi from '../api/projects.js';
import type { ProjectResponse } from '../api/projects.js';
import * as keys from '../crypto/keys.js';
import * as s from '../crypto/sodium.js';
import { getKek } from './auth.svelte.js';

export interface DecryptedProject {
  id: string;
  name: string;
  pdk: Uint8Array;
  createdAt: string;
  updatedAt: string;
  requireApproval: boolean;
}

let projects = $state<DecryptedProject[]>([]);

export function getProjects() {
  return projects;
}

export async function loadProjects() {
  const kek = getKek();
  if (!kek) return;

  const { projects: raw } = await projectsApi.listProjects();
  projects = raw.map((p) => decryptProject(p, kek));
}

export async function createProject(name: string): Promise<string> {
  const kek = getKek();
  if (!kek) throw new Error('Not authenticated');

  const pdk = keys.generatePDK();
  const { wrapped, nonce: wrapNonce } = keys.wrapPDKForUser(pdk, kek);
  const { ct: nameCt, nonce: nameNonce } = keys.encryptProjectName(name, pdk);

  const result = await projectsApi.createProject({
    name_ct: s.toBase64Standard(nameCt),
    name_nonce: s.toBase64Standard(nameNonce),
    wrapped_pdk_for_user: s.toBase64Standard(wrapped),
    wrap_nonce_for_user: s.toBase64Standard(wrapNonce),
  });

  projects = [
    { id: result.id, name, pdk, createdAt: result.created_at, updatedAt: result.created_at, requireApproval: false },
    ...projects,
  ];

  return result.id;
}

export async function setRequireApproval(id: string, value: boolean) {
  await projectsApi.setRequireApproval(id, value);
  projects = projects.map((p) => (p.id === id ? { ...p, requireApproval: value } : p));
}

export async function deleteProject(id: string) {
  await projectsApi.deleteProject(id);
  projects = projects.filter((p) => p.id !== id);
}

export function getProjectById(id: string): DecryptedProject | undefined {
  return projects.find((p) => p.id === id);
}

function decryptProject(raw: ProjectResponse, kek: Uint8Array): DecryptedProject {
  const wrappedPdk = s.fromBase64Standard(raw.wrapped_pdk_for_user);
  const wrapNonce = s.fromBase64Standard(raw.wrap_nonce_for_user);
  const pdk = keys.unwrapPDKForUser(wrappedPdk, wrapNonce, kek);
  const nameCt = s.fromBase64Standard(raw.name_ct);
  const nameNonce = s.fromBase64Standard(raw.name_nonce);
  const name = keys.decryptProjectName(nameCt, nameNonce, pdk);
  return { id: raw.id, name, pdk, createdAt: raw.created_at, updatedAt: raw.updated_at, requireApproval: raw.require_approval };
}
