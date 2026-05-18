import * as opaque from '@serenity-kit/opaque';

export function startRegistration(password: string) {
  return opaque.client.startRegistration({ password });
}

export function finishRegistration(params: {
  clientRegistrationState: string;
  registrationResponse: string;
  password: string;
}) {
  return opaque.client.finishRegistration(params);
}

export function startLogin(password: string) {
  return opaque.client.startLogin({ password });
}

export function finishLogin(params: {
  clientLoginState: string;
  loginResponse: string;
  password: string;
}) {
  return opaque.client.finishLogin(params);
}
