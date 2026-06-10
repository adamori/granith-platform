import * as opaque from '@serenity-kit/opaque';
import { randomBytes } from 'node:crypto';

// A registration record for an account that does not exist. Used by login/start to
// produce a well-formed login response for unknown handles, so that the response is
// byte-shape-identical to a real account and the eventual login/finish fails the same
// way a wrong password does. This is what prevents handle enumeration (OPAQUE is
// designed for this). Memoized per server setup; the record is reusable across any
// userIdentifier and never lets a login complete (the password is random and discarded).
const dummyRecordCache = new Map<string, string>();

export async function getDummyRegistrationRecord(serverSetup: string): Promise<string> {
  const cached = dummyRecordCache.get(serverSetup);
  if (cached) return cached;

  await opaque.ready;
  const password = randomBytes(32).toString('base64');
  const { clientRegistrationState, registrationRequest } = opaque.client.startRegistration({ password });
  const { registrationResponse } = opaque.server.createRegistrationResponse({
    serverSetup,
    userIdentifier: 'granith:nonexistent-account',
    registrationRequest,
  });
  const { registrationRecord } = opaque.client.finishRegistration({
    clientRegistrationState,
    registrationResponse,
    password,
  });

  dummyRecordCache.set(serverSetup, registrationRecord);
  return registrationRecord;
}

export function createRegistrationResponse(params: {
  serverSetup: string;
  userIdentifier: string;
  registrationRequest: string;
}) {
  return opaque.server.createRegistrationResponse({
    serverSetup: params.serverSetup,
    userIdentifier: params.userIdentifier,
    registrationRequest: params.registrationRequest,
  });
}

export function startLogin(params: {
  serverSetup: string;
  userIdentifier: string;
  registrationRecord: string;
  startLoginRequest: string;
}) {
  return opaque.server.startLogin({
    serverSetup: params.serverSetup,
    userIdentifier: params.userIdentifier,
    registrationRecord: params.registrationRecord,
    startLoginRequest: params.startLoginRequest,
  });
}

export function finishLogin(params: {
  serverLoginState: string;
  finishLoginRequest: string;
}) {
  return opaque.server.finishLogin({
    serverLoginState: params.serverLoginState,
    finishLoginRequest: params.finishLoginRequest,
  });
}
