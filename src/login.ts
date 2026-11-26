import { iniciarSessao, obterSessao } from "./auth";
import "./login.css";

interface ContaArmazenada {
    nome: string;
    email: string;
    telefone?: string;
    cpf?: string;
    salt: string;
    hashSenha: string;
}

const CHAVE_CONTAS = "controle-financeiro.contas.v1";
const ITERACOES_HASH = 120_000;

function obterElemento<T extends HTMLElement>(seletor: string): T {
    const elemento = document.querySelector<T>(seletor);

    if (elemento === null) {
        throw new Error(`Elemento não encontrado: ${seletor}`);
    }

    return elemento;
}

const cardLogin = obterElemento<HTMLElement>("#cardLogin");
const cardCadastro = obterElemento<HTMLElement>("#cardCadastro");
const formularioLogin = obterElemento<HTMLFormElement>("#formLogin");
const formularioCadastro = obterElemento<HTMLFormElement>("#formCadastro");
const campoEmailLogin = obterElemento<HTMLInputElement>("#emailLogin");
const campoSenhaLogin = obterElemento<HTMLInputElement>("#senhaLogin");
const campoNomeCadastro = obterElemento<HTMLInputElement>("#nomeCadastro");
const campoEmailCadastro = obterElemento<HTMLInputElement>("#emailCadastro");
const campoTelefoneCadastro = obterElemento<HTMLInputElement>("#telefoneCadastro");
const campoCpfCadastro = obterElemento<HTMLInputElement>("#cpfCadastro");
const campoSenhaCadastro = obterElemento<HTMLInputElement>("#senhaCadastro");
const botaoCadastrar = obterElemento<HTMLButtonElement>("#botaoCadastrar");
const botaoEntrar = obterElemento<HTMLButtonElement>("#botaoEntrar");
const mensagemErroLogin = obterElemento<HTMLParagraphElement>("#mensagemErroLogin");
const mensagemErroCadastro = obterElemento<HTMLParagraphElement>("#mensagemErroCadastro");
const mensagemSucessoLogin = obterElemento<HTMLParagraphElement>("#mensagemSucessoLogin");
const regraTamanhoSenha = obterElemento<HTMLLIElement>("#regraTamanhoSenha");
const regraEspecialSenha = obterElemento<HTMLLIElement>("#regraEspecialSenha");

function obterContas(): ContaArmazenada[] {
    const contasSalvas = localStorage.getItem(CHAVE_CONTAS);

    if (contasSalvas === null) {
        return [];
    }

    let contasLidas: unknown;

    try {
        contasLidas = JSON.parse(contasSalvas);
    } catch {
        throw new Error("As contas salvas estão inválidas. Limpe os dados do site e tente novamente.");
    }

    if (
        !Array.isArray(contasLidas) ||
        !contasLidas.every((conta: unknown) => ehContaArmazenada(conta))
    ) {
        throw new Error("As contas salvas estão inválidas. Limpe os dados do site e tente novamente.");
    }

    return contasLidas;
}

function ehContaArmazenada(valor: unknown): valor is ContaArmazenada {
    return (
        typeof valor === "object" &&
        valor !== null &&
        "nome" in valor &&
        "email" in valor &&
        "salt" in valor &&
        "hashSenha" in valor &&
        typeof valor.nome === "string" &&
        typeof valor.email === "string" &&
        (!("telefone" in valor) || typeof valor.telefone === "string") &&
        (!("cpf" in valor) || typeof valor.cpf === "string") &&
        typeof valor.salt === "string" &&
        typeof valor.hashSenha === "string"
    );
}

function formatarTelefone(valor: string): string {
    const digitos = valor.replace(/\D/g, "").slice(0, 11);

    if (digitos.length <= 2) {
        return digitos.length === 0 ? digitos : `(${digitos}`;
    }

    const ddd = digitos.slice(0, 2);
    const numero = digitos.slice(2);
    const limite = digitos.length > 10 ? 5 : 4;

    if (numero.length <= limite) {
        return `(${ddd}) ${numero}`;
    }

    return `(${ddd}) ${numero.slice(0, limite)}-${numero.slice(limite)}`;
}

function formatarCpf(valor: string): string {
    const digitos = valor.replace(/\D/g, "").slice(0, 11);

    if (digitos.length <= 3) {
        return digitos;
    }

    if (digitos.length <= 6) {
        return `${digitos.slice(0, 3)}.${digitos.slice(3)}`;
    }

    if (digitos.length <= 9) {
        return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6)}`;
    }

    return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}

function cpfValido(cpf: string): boolean {
    if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) {
        return false;
    }

    const calcularDigito = (base: string, pesoInicial: number): number => {
        let soma = 0;

        for (let indice = 0; indice < base.length; indice += 1) {
            soma += Number(base[indice]) * (pesoInicial - indice);
        }

        const resto = (soma * 10) % 11;
        return resto === 10 ? 0 : resto;
    };

    const primeiroDigito = calcularDigito(cpf.slice(0, 9), 10);
    const segundoDigito = calcularDigito(cpf.slice(0, 10), 11);

    return (
        primeiroDigito === Number(cpf[9]) &&
        segundoDigito === Number(cpf[10])
    );
}

function converterHexadecimalParaBuffer(valor: string): ArrayBuffer {
    const bytes = new ArrayBuffer(valor.length / 2);
    const vista = new DataView(bytes);

    for (let indice = 0; indice < bytes.byteLength; indice += 1) {
        vista.setUint8(
            indice,
            Number.parseInt(valor.slice(indice * 2, indice * 2 + 2), 16),
        );
    }

    return bytes;
}

function gerarSalt(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));

    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function gerarHashSenha(senha: string, salt: string): Promise<string> {
    const chave = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(senha),
        "PBKDF2",
        false,
        ["deriveBits"],
    );
    const hash = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: converterHexadecimalParaBuffer(salt),
            iterations: ITERACOES_HASH,
            hash: "SHA-256",
        },
        chave,
        256,
    );

    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function senhaAtendeRegras(senha: string): boolean {
    return senha.length >= 6 && /[^\p{L}\p{N}\s]/u.test(senha);
}

function atualizarRegrasSenha(): void {
    regraTamanhoSenha.classList.toggle(
        "regras-senha__item--ok",
        campoSenhaCadastro.value.length >= 6,
    );
    regraEspecialSenha.classList.toggle(
        "regras-senha__item--ok",
        /[^\p{L}\p{N}\s]/u.test(campoSenhaCadastro.value),
    );
}

function exibirMensagem(
    elemento: HTMLParagraphElement,
    mensagem: string | null,
): void {
    elemento.textContent = mensagem ?? "";
    elemento.hidden = mensagem === null;
}

function exibirErro(
    elemento: HTMLParagraphElement,
    erro: unknown,
    mensagemPadrao: string,
): void {
    exibirMensagem(
        elemento,
        erro instanceof Error ? erro.message : mensagemPadrao,
    );
}

function limparMensagens(): void {
    exibirMensagem(mensagemErroLogin, null);
    exibirMensagem(mensagemErroCadastro, null);
    exibirMensagem(mensagemSucessoLogin, null);
}

function mostrarLogin(): void {
    limparMensagens();
    cardLogin.hidden = false;
    cardCadastro.hidden = true;
    campoEmailLogin.focus();
}

function mostrarCadastro(): void {
    limparMensagens();
    cardLogin.hidden = true;
    cardCadastro.hidden = false;
    campoNomeCadastro.focus();
}

async function aoEnviarCadastro(evento: SubmitEvent): Promise<void> {
    evento.preventDefault();
    limparMensagens();

    const nome = campoNomeCadastro.value.trim();
    const email = campoEmailCadastro.value.trim().toLowerCase();
    const telefone = campoTelefoneCadastro.value.replace(/\D/g, "");
    const cpf = campoCpfCadastro.value.replace(/\D/g, "");
    const senha = campoSenhaCadastro.value;

    if (nome.length < 2) {
        exibirMensagem(mensagemErroCadastro, "Informe seu nome completo.");
        campoNomeCadastro.focus();
        return;
    }

    if (!campoEmailCadastro.validity.valid || email.length === 0) {
        exibirMensagem(mensagemErroCadastro, "Informe um e-mail válido.");
        campoEmailCadastro.focus();
        return;
    }

    if (telefone.length !== 10 && telefone.length !== 11) {
        exibirMensagem(mensagemErroCadastro, "Informe um telefone com DDD válido.");
        campoTelefoneCadastro.focus();
        return;
    }

    if (!cpfValido(cpf)) {
        exibirMensagem(mensagemErroCadastro, "Informe um CPF válido.");
        campoCpfCadastro.focus();
        return;
    }

    if (!senhaAtendeRegras(senha)) {
        exibirMensagem(
            mensagemErroCadastro,
            "A senha deve ter pelo menos 6 caracteres e 1 caractere especial.",
        );
        campoSenhaCadastro.focus();
        return;
    }

    botaoCadastrar.disabled = true;

    try {
        const contas = obterContas();

        if (contas.some((conta) => conta.email === email)) {
            exibirMensagem(mensagemErroCadastro, "Já existe uma conta com este e-mail.");
            campoEmailCadastro.focus();
            return;
        }

        const salt = gerarSalt();
        const hashSenha = await gerarHashSenha(senha, salt);
        contas.push({ nome, email, telefone, cpf, salt, hashSenha });
        localStorage.setItem(CHAVE_CONTAS, JSON.stringify(contas));

        formularioCadastro.reset();
        atualizarRegrasSenha();
        campoEmailLogin.value = email;
        mostrarLogin();
        exibirMensagem(
            mensagemSucessoLogin,
            "Cadastro concluído. Entre com seu e-mail e senha.",
        );
        campoSenhaLogin.focus();
    } catch (erro: unknown) {
        exibirErro(
            mensagemErroCadastro,
            erro,
            "Não foi possível concluir o cadastro neste navegador.",
        );
    } finally {
        botaoCadastrar.disabled = false;
    }
}

async function aoEnviarLogin(evento: SubmitEvent): Promise<void> {
    evento.preventDefault();
    limparMensagens();

    const email = campoEmailLogin.value.trim().toLowerCase();
    const senha = campoSenhaLogin.value;

    if (!campoEmailLogin.validity.valid || email.length === 0) {
        exibirMensagem(mensagemErroLogin, "Informe um e-mail válido.");
        campoEmailLogin.focus();
        return;
    }

    if (senha.length === 0) {
        exibirMensagem(mensagemErroLogin, "Informe sua senha.");
        campoSenhaLogin.focus();
        return;
    }

    botaoEntrar.disabled = true;

    try {
        const conta = obterContas().find((item) => item.email === email);

        if (conta === undefined || (await gerarHashSenha(senha, conta.salt)) !== conta.hashSenha) {
            exibirMensagem(mensagemErroLogin, "E-mail ou senha incorretos.");
            campoSenhaLogin.focus();
            return;
        }

        iniciarSessao({ nome: conta.nome, email: conta.email });
        window.location.replace("/");
    } catch (erro: unknown) {
        exibirErro(
            mensagemErroLogin,
            erro,
            "Não foi possível entrar neste navegador.",
        );
    } finally {
        botaoEntrar.disabled = false;
    }
}

document
    .querySelector<HTMLButtonElement>("#botaoIrParaCadastro")
    ?.addEventListener("click", mostrarCadastro);
document
    .querySelector<HTMLButtonElement>("#botaoIrParaLogin")
    ?.addEventListener("click", mostrarLogin);
formularioCadastro.addEventListener("submit", (evento) => {
    void aoEnviarCadastro(evento);
});
formularioLogin.addEventListener("submit", (evento) => {
    void aoEnviarLogin(evento);
});
campoSenhaCadastro.addEventListener("input", atualizarRegrasSenha);
campoTelefoneCadastro.addEventListener("input", () => {
    campoTelefoneCadastro.value = formatarTelefone(campoTelefoneCadastro.value);
});
campoCpfCadastro.addEventListener("input", () => {
    campoCpfCadastro.value = formatarCpf(campoCpfCadastro.value);
});

try {
    if (obterSessao() !== null) {
        window.location.replace("/");
    }
} catch (erro: unknown) {
    exibirErro(
        mensagemErroLogin,
        erro,
        "Não foi possível acessar a sessão neste navegador.",
    );
}
