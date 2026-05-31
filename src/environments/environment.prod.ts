// This file replaces `environment.ts` during build with `ng build --prod`.

export const environment = {
  production: true,
  camunda8: {
    restAddress: 'http://localhost:8080',
    authStrategy: 'NONE'
  }
};
