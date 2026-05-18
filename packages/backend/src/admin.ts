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
program.name('granith-admin').version('0.1.0');

const invite = program.command('invite');

invite
  .command('create')
  .option('--ttl <duration>', 'TTL for invite code', '7d')
  .option('--count <n>', 'Number of codes to generate', '1')
  .action(async (opts) => {
    const data = await request('POST', '/admin/invites', {
      ttl: opts.ttl,
      count: parseInt(opts.count, 10),
    });
    if (data?.codes) {
      for (const code of data.codes) {
        console.log(code);
      }
      console.log(`\nExpires: ${data.expires_at}`);
    }
  });

invite
  .command('list')
  .action(async () => {
    const data = await request('GET', '/admin/invites');
    if (data?.invites) {
      console.log('Code\t\t\t\tExpires\t\t\t\tUsed');
      for (const inv of data.invites) {
        console.log(`${inv.code}\t${inv.expires_at}\t${inv.used_at ? 'Yes' : 'No'}`);
      }
    }
  });

invite
  .command('revoke')
  .argument('<code>')
  .action(async (code) => {
    await request('DELETE', `/admin/invites/${encodeURIComponent(code)}`);
    console.log('Invite revoked.');
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
