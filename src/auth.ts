export interface SessaoUsuario {
    nome: string;
    email: string;
}

const CHAVE_SESSAO = "controle-financeiro.sessao";

export function obterSessao(): SessaoUsuario | null {
    const sessaoSalva = sessionStorage.getItem(CHAVE_SESSAO);

    if (sessaoSalva === null) {
        return null;
    }

    let sessaoLida: unknown;

    try {
        sessaoLida = JSON.parse(sessaoSalva);
    } catch {
        sessionStorage.removeItem(CHAVE_SESSAO);
        return null;
    }

    if (
        typeof sessaoLida !== "object" ||
        sessaoLida === null ||
        !("nome" in sessaoLida) ||
        !("email" in sessaoLida) ||
        typeof sessaoLida.nome !== "string" ||
        typeof sessaoLida.email !== "string"
    ) {
        sessionStorage.removeItem(CHAVE_SESSAO);
        return null;
    }

    return {
        nome: sessaoLida.nome,
        email: sessaoLida.email,
    };
}

export function iniciarSessao(usuario: SessaoUsuario): void {
    sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(usuario));
}

export function encerrarSessao(): void {
    sessionStorage.removeItem(CHAVE_SESSAO);
}
