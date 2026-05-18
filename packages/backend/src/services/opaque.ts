import * as opaque from '@serenity-kit/opaque';

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
