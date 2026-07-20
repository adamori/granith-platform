#!/usr/bin/env node
import { Command } from 'commander';

const API_URL = process.env['GRANITH_API_URL'] ?? 'http://localhost:3000';
const ADMIN_KEY = process.env['GRANITH_ADMIN_KEY'] ?? '';

async function request(method: string, path: string, body?: unknown) {
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${ADMIN_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Error ${res.status}: ${text}`);
    process.exit(1);
  }

  if (res.status === 204) return null;
  return res.json();
}

const program = new Command();
program.name('granith-admin').version('1.0.0');

// Accepts plain bytes ("1048576") or human-readable forms ("512KB", "5MB"); 1024-based.
function parseBytes(input: string): number {
  const match = input.trim().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i);
  if (!match) {
    console.error(`Invalid byte value: ${input} (use e.g. 1048576, 512KB, 5MB)`);
    process.exit(1);
  }
  const value = parseFloat(match[1]!);
  const unit = (match[2] ?? 'b').toLowerCase();
  const multiplier = unit === 'gb' ? 1024 ** 3 : unit === 'mb' ? 1024 ** 2 : unit === 'kb' ? 1024 : 1;
  return Math.round(value * multiplier);
}

const limits = program.command('limits');

limits
  .command('show')
  .argument('<handle>')
  .action(async (handle) => {
    const data = await request('GET', `/admin/users/${encodeURIComponent(handle)}/limits`);
    if (data) {
      console.log(`Handle:          ${data.handle}`);
      console.log(`Storage limit:   ${data.effective.storage_bytes} bytes`);
      console.log(`Storage used:    ${data.used_bytes} bytes`);
      console.log(`Override active: ${data.limit_overrides ? JSON.stringify(data.limit_overrides) : 'none (default)'}`);
    }
  });

limits
  .command('set')
  .argument('<handle>')
  .argument('<bytes>', 'byte count, or human form like 5MB / 512KB')
  .action(async (handle, bytes) => {
    const storage_bytes = parseBytes(bytes);
    await request('PUT', `/admin/users/${encodeURIComponent(handle)}/limits`, { storage_bytes });
    console.log(`Storage limit for ${handle} set to ${storage_bytes} bytes.`);
  });

limits
  .command('clear')
  .argument('<handle>')
  .action(async (handle) => {
    await request('PUT', `/admin/users/${encodeURIComponent(handle)}/limits`, { storage_bytes: null });
    console.log(`Override cleared for ${handle}; back to default limits.`);
  });

const user = program.command('user');

user
  .command('list')
  .action(async () => {
    const data = await request('GET', '/admin/users');
    if (data?.users) {
      console.log('Handle\t\tCreated');
      for (const u of data.users) {
        console.log(`${u.handle}\t\t${u.created_at}`);
      }
    }
  });

user
  .command('delete')
  .argument('<handle>')
  .action(async (handle) => {
    await request('DELETE', `/admin/users/${encodeURIComponent(handle)}`);
    console.log('User deleted.');
  });

program.parse();
