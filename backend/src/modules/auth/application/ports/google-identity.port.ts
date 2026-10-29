export type GoogleIdentity = { subject: string; email: string };
export abstract class GoogleIdentityPort {
  abstract authorize(email: string): {
    authorizationUrl: string;
    browserToken: string;
    secure: boolean;
  };
  abstract exchange(
    code: string,
    state: string,
    browserToken: string,
  ): Promise<GoogleIdentity>;
}
