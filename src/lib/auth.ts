/**
 * Acesso restrito ao painel.
 *
 * Trava simples do lado do cliente (a senha fica no próprio código) — pensada
 * para um uso pontual e restrito, não para segurança forte. Para trocar as
 * credenciais, edite o objeto CREDENTIALS abaixo.
 */
export const CREDENTIALS = {
  email: "admin@atonns.com.br",
  password: "MixMateus@2026",
};

const STORAGE_KEY = "mm_painel_auth";

export function checkCredentials(email: string, password: string): boolean {
  return (
    email.trim().toLowerCase() === CREDENTIALS.email.toLowerCase() &&
    password === CREDENTIALS.password
  );
}

/** Lê o estado de sessão (só existe no cliente). */
export function isAuthed(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAuthed(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* sessionStorage indisponível — segue sem persistir */
  }
}

export function clearAuthed(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}
