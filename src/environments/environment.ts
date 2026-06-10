// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.

export const environment = {
  production: false,
  camunda8: {
    restAddress: '/camunda8-api',
    authStrategy: 'BEARER',
    auth: {
      tokenUrl: '/camunda-auth/realms/camunda-platform/protocol/openid-connect/token',
      clientId: 'orchestration',
      clientSecret: 'secret',
      audience: 'orchestration-api'
    }
  }
};
