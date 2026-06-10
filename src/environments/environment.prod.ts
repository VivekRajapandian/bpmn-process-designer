// This file replaces `environment.ts` during build with `ng build --prod`.

export const environment = {
  production: true,
  camunda8: {
    restAddress: 'http://localhost:8088',
    authStrategy: 'BEARER',
    auth: {
      tokenUrl: 'http://localhost:18080/auth/realms/camunda-platform/protocol/openid-connect/token',
      clientId: 'orchestration',
      clientSecret: 'secret',
      audience: 'orchestration-api'
    }
  }
};
