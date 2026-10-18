// A passkey only works on the site it was made for: the browser checks the
// page's address against these, so APP_URL must be the address staff open.
export function relyingParty(appUrl: string) {
  const url = new URL(appUrl);
  return { rpID: url.hostname, origin: url.origin };
}
