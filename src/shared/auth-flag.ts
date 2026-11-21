export const AUTH_FLAG = "nr8r_auth";

export function clientHasAuthFlag(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((part) => part.trim() === `${AUTH_FLAG}=1`);
}
