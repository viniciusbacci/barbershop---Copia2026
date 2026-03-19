const http = require("node:http");
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const cors = require("cors");
const PORTA = Number(process.env.PORT) || 3333;
process.env.TZ = "America/Sao_Paulo";
const DIRETORIO_BASE = __dirname;
const DIRETORIO_DADOS = path.join(DIRETORIO_BASE, "dados");
const CAMINHO_BANCO = "./barbershop.db";
const HORARIOS_PADRAO = criarHorariosPadrao();

const TIPOS_ARQUIVO = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};

fs.mkdirSync(DIRETORIO_DADOS, { recursive: true });

const banco = new DatabaseSync(CAMINHO_BANCO);

banco.exec(`
    CREATE TABLE IF NOT EXISTS agendamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome_cliente TEXT NOT NULL,
        telefone_cliente TEXT NOT NULL,
        servico TEXT NOT NULL,
        duracao TEXT NOT NULL,
        preco TEXT NOT NULL,
        data_agendamento TEXT NOT NULL,
        horario_agendamento TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ativo',
        concluido_em TEXT,
        cancelado_em TEXT,
        criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (data_agendamento, horario_agendamento)
    )
`);

banco.exec(`
    CREATE TABLE IF NOT EXISTS lista_espera (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome_cliente TEXT NOT NULL,
        telefone_cliente TEXT NOT NULL,
        servico TEXT NOT NULL,
        data_interesse TEXT NOT NULL,
        observacoes TEXT,
        status TEXT NOT NULL DEFAULT 'pendente',
        criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`);

banco.exec(`
    CREATE TABLE IF NOT EXISTS bloqueios_horario (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data_agendamento TEXT NOT NULL,
        horario_agendamento TEXT NOT NULL,
        motivo TEXT,
        criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (data_agendamento, horario_agendamento)
    )
`);

garantirColunaAgendamentos("status", "TEXT NOT NULL DEFAULT 'ativo'");
garantirColunaAgendamentos("concluido_em", "TEXT");
garantirColunaAgendamentos("cancelado_em", "TEXT");
garantirColunaAgendamentos("lembrete_em", "TEXT");

banco.exec(`
    UPDATE agendamentos
    SET status = 'ativo'
    WHERE status IS NULL OR status = ''
`);

const inserirAgendamento = banco.prepare(`
    INSERT INTO agendamentos (
        nome_cliente,
        telefone_cliente,
        servico,
        duracao,
        preco,
        data_agendamento,
        horario_agendamento,
        lembrete_em
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const buscarAgendamentos = banco.prepare(`
    SELECT
        id,
        nome_cliente AS nomeCliente,
        telefone_cliente AS telefoneCliente,
        servico,
        duracao,
        preco,
        data_agendamento AS dataAgendamento,
        horario_agendamento AS horarioAgendamento,
        criado_em AS criadoEm,
        status,
        concluido_em AS concluidoEm,
        cancelado_em AS canceladoEm
    FROM agendamentos
    ORDER BY data_agendamento ASC, horario_agendamento ASC
`);

const buscarAgendamentoPorId = banco.prepare(`
    SELECT
        id,
        nome_cliente AS nomeCliente,
        telefone_cliente AS telefoneCliente,
        data_agendamento AS dataAgendamento,
        horario_agendamento AS horarioAgendamento,
        status
    FROM agendamentos
    WHERE id = ?
`);

const concluirAgendamento = banco.prepare(`
    UPDATE agendamentos
    SET status = 'concluido',
        concluido_em = CURRENT_TIMESTAMP,
        cancelado_em = NULL
    WHERE id = ?
`);

const cancelarAgendamento = banco.prepare(`
    UPDATE agendamentos
    SET status = 'cancelado',
        cancelado_em = CURRENT_TIMESTAMP,
        concluido_em = NULL
    WHERE id = ?
`);

const cancelarAgendamentosPorData = banco.prepare(`
    UPDATE agendamentos
    SET status = 'cancelado',
        cancelado_em = CURRENT_TIMESTAMP,
        concluido_em = NULL
    WHERE data_agendamento = ?
      AND status != 'cancelado'
`);

const buscarHorariosOcupados = banco.prepare(`
    SELECT horario_agendamento AS horario
    FROM agendamentos
    WHERE data_agendamento = ?
      AND status != 'cancelado'
    ORDER BY horario_agendamento ASC
`);

const buscarBloqueiosPorData = banco.prepare(`
    SELECT
        id,
        data_agendamento AS dataAgendamento,
        horario_agendamento AS horarioAgendamento,
        motivo,
        criado_em AS criadoEm
    FROM bloqueios_horario
    WHERE data_agendamento = ?
    ORDER BY horario_agendamento ASC
`);

const buscarBloqueiosEntreDatas = banco.prepare(`
    SELECT
        data_agendamento AS data,
        COUNT(*) AS totalBloqueios
    FROM bloqueios_horario
    WHERE data_agendamento BETWEEN ? AND ?
    GROUP BY data_agendamento
    ORDER BY data_agendamento ASC
`);

const buscarDatasOcupadas = banco.prepare(`
    SELECT
        data_agendamento AS data,
        COUNT(*) AS totalAgendamentos
    FROM agendamentos
    WHERE data_agendamento BETWEEN ? AND ?
      AND status != 'cancelado'
    GROUP BY data_agendamento
    ORDER BY data_agendamento ASC
`);

const buscarAgendamentoPorDataHorario = banco.prepare(`
    SELECT
        id,
        status
    FROM agendamentos
    WHERE data_agendamento = ?
      AND horario_agendamento = ?
`);

const buscarBloqueioPorDataHorario = banco.prepare(`
    SELECT
        id,
        motivo
    FROM bloqueios_horario
    WHERE data_agendamento = ?
      AND horario_agendamento = ?
`);

const reativarAgendamento = banco.prepare(`
    UPDATE agendamentos
    SET nome_cliente = ?,
        telefone_cliente = ?,
        servico = ?,
        duracao = ?,
        preco = ?,
        status = 'ativo',
        concluido_em = NULL,
        cancelado_em = NULL,
        criado_em = CURRENT_TIMESTAMP,
        lembrete_em = ?
    WHERE id = ?
`);

const buscarAgendamentosAtivosFuturos = banco.prepare(`
    SELECT
        id,
        nome_cliente AS nomeCliente,
        telefone_cliente AS telefoneCliente,
        servico,
        duracao,
        preco,
        data_agendamento AS dataAgendamento,
        horario_agendamento AS horarioAgendamento,
        status
    FROM agendamentos
    WHERE status = 'ativo'
      AND data_agendamento >= ?
    ORDER BY data_agendamento ASC, horario_agendamento ASC
`);

const buscarHistoricoAgendamentosCliente = banco.prepare(`
    SELECT
        id,
        nome_cliente AS nomeCliente,
        telefone_cliente AS telefoneCliente,
        servico,
        duracao,
        preco,
        data_agendamento AS dataAgendamento,
        horario_agendamento AS horarioAgendamento,
        criado_em AS criadoEm,
        status,
        concluido_em AS concluidoEm,
        cancelado_em AS canceladoEm
    FROM agendamentos
    ORDER BY data_agendamento DESC, horario_agendamento DESC
`);

const inserirListaEspera = banco.prepare(`
    INSERT INTO lista_espera (
        nome_cliente,
        telefone_cliente,
        servico,
        data_interesse,
        observacoes
    ) VALUES (?, ?, ?, ?, ?)
`);

const buscarListaEspera = banco.prepare(`
    SELECT
        id,
        nome_cliente AS nomeCliente,
        telefone_cliente AS telefoneCliente,
        servico,
        data_interesse AS dataInteresse,
        observacoes,
        status,
        criado_em AS criadoEm,
        atualizado_em AS atualizadoEm
    FROM lista_espera
    ORDER BY
        CASE status
            WHEN 'pendente' THEN 0
            WHEN 'contatado' THEN 1
            ELSE 2
        END ASC,
        data_interesse ASC,
        criado_em DESC
`);

const buscarListaEsperaPorId = banco.prepare(`
    SELECT
        id,
        nome_cliente AS nomeCliente,
        telefone_cliente AS telefoneCliente,
        servico,
        data_interesse AS dataInteresse,
        observacoes,
        status
    FROM lista_espera
    WHERE id = ?
`);

const atualizarStatusListaEspera = banco.prepare(`
    UPDATE lista_espera
    SET status = ?,
        atualizado_em = CURRENT_TIMESTAMP
    WHERE id = ?
`);

const inserirBloqueioHorario = banco.prepare(`
    INSERT INTO bloqueios_horario (
        data_agendamento,
        horario_agendamento,
        motivo
    ) VALUES (?, ?, ?)
`);

const removerBloqueioHorario = banco.prepare(`
    DELETE FROM bloqueios_horario
    WHERE data_agendamento = ?
      AND horario_agendamento = ?
`);

const removerBloqueiosPorData = banco.prepare(`
    DELETE FROM bloqueios_horario
    WHERE data_agendamento = ?
`);

function criarHorariosPadrao() {
  const horarios = [];

  for (let hora = 9; hora <= 17; hora += 1) {
    horarios.push(`${String(hora).padStart(2, "0")}:00`);

    if (hora !== 17) {
      horarios.push(`${String(hora).padStart(2, "0")}:30`);
    }
  }

  return horarios;
}

function garantirColunaAgendamentos(nomeColuna, definicaoColuna) {
  const colunas = banco.prepare("PRAGMA table_info(agendamentos)").all();
  const colunaExiste = colunas.some((coluna) => coluna.name === nomeColuna);

  if (!colunaExiste) {
    banco.exec(
      `ALTER TABLE agendamentos ADD COLUMN ${nomeColuna} ${definicaoColuna}`,
    );
  }
}

function obterCabecalhosApi(cabecalhosExtras = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...cabecalhosExtras,
  };
}

function enviarJson(resposta, statusCode, dados) {
  resposta.writeHead(statusCode, {
    ...obterCabecalhosApi(),
    "Content-Type": "application/json; charset=utf-8",
  });
  resposta.end(JSON.stringify(dados));
}

function enviarTexto(resposta, statusCode, texto) {
  resposta.writeHead(statusCode, {
    ...obterCabecalhosApi(),
    "Content-Type": "text/plain; charset=utf-8",
  });
  resposta.end(texto);
}

async function lerCorpoJson(requisicao) {
  let conteudo = "";

  for await (const parte of requisicao) {
    conteudo += parte;

    if (conteudo.length > 1_000_000) {
      throw new Error("Corpo da requisicao muito grande.");
    }
  }

  if (!conteudo) {
    return {};
  }

  return JSON.parse(conteudo);
}

function validarData(valor) {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

function validarHorario(valor) {
  return HORARIOS_PADRAO.includes(valor);
}

function dataEhDomingo(valor) {
  const data = new Date(`${valor}T12:00:00`);
  return data.getDay() === 0;
}

function obterDataHoje() {
  const agora = new Date();
  const formatador = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatador.format(agora);
}

function obterHorarioAgora() {
  const agora = new Date();
  const formatador = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return formatador.format(agora);
}

function obterHorariosPassados(dataAgendamento) {
  if (dataAgendamento !== obterDataHoje()) {
    return [];
  }

  const horarioAtual = obterHorarioAgora();

  return HORARIOS_PADRAO.filter((horario) => horario <= horarioAtual);
}

function somarDiasNaData(valorData, quantidadeDias) {
  const data = new Date(`${valorData}T12:00:00`);
  data.setDate(data.getDate() + quantidadeDias);

  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function calcularLembreteEm(dataAgendamento, horarioAgendamento) {
  const dataHoraAgendamento = new Date(
    `${dataAgendamento}T${horarioAgendamento}:00`,
  );
  const dataHoraLembrete = new Date(
    dataHoraAgendamento.getTime() - 60 * 60 * 1000,
  );
  const ano = dataHoraLembrete.getFullYear();
  const mes = String(dataHoraLembrete.getMonth() + 1).padStart(2, "0");
  const dia = String(dataHoraLembrete.getDate()).padStart(2, "0");
  const hora = String(dataHoraLembrete.getHours()).padStart(2, "0");
  const minuto = String(dataHoraLembrete.getMinutes()).padStart(2, "0");
  const segundo = String(dataHoraLembrete.getSeconds()).padStart(2, "0");

  return `${ano}-${mes}-${dia} ${hora}:${minuto}:${segundo}`;
}

function limparTexto(valor) {
  return String(valor || "").trim();
}

function normalizarTextoComparacao(valor) {
  return limparTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizarTelefoneComparacao(valor) {
  return limparTexto(valor).replace(/\D/g, "");
}

function agendamentoAindaCancelavel(dataAgendamento, horarioAgendamento) {
  const hoje = obterDataHoje();

  if (dataAgendamento > hoje) {
    return true;
  }

  if (dataAgendamento < hoje) {
    return false;
  }

  return horarioAgendamento > obterHorarioAgora();
}

function validarAgendamento(dados) {
  const nomeCliente = limparTexto(dados.nomeCliente);
  const telefoneCliente = limparTexto(dados.telefoneCliente);
  const servico = limparTexto(dados.servico);
  const duracao = limparTexto(dados.duracao);
  const preco = limparTexto(dados.preco);
  const dataAgendamento = limparTexto(dados.dataAgendamento);
  const horarioAgendamento = limparTexto(dados.horarioAgendamento);

  if (nomeCliente.length < 3) {
    return { erro: "Informe o nome do cliente." };
  }

  if (telefoneCliente.length < 8) {
    return { erro: "Informe um telefone valido." };
  }

  if (!servico || !duracao || !preco) {
    return { erro: "Selecione um servico valido." };
  }

  if (!validarData(dataAgendamento)) {
    return { erro: "Informe uma data valida." };
  }

  if (dataAgendamento < obterDataHoje()) {
    return { erro: "Nao e possivel agendar em uma data passada." };
  }

  if (dataEhDomingo(dataAgendamento)) {
    return { erro: "Domingo e folga. Escolha outro dia." };
  }

  if (!validarHorario(horarioAgendamento)) {
    return { erro: "Escolha um horario valido." };
  }

  if (obterHorariosPassados(dataAgendamento).includes(horarioAgendamento)) {
    return {
      erro: "Esse horario ja passou para hoje. Escolha um horario futuro.",
    };
  }

  return {
    nomeCliente,
    telefoneCliente,
    servico,
    duracao,
    preco,
    dataAgendamento,
    horarioAgendamento,
  };
}

function validarListaEspera(dados) {
  const nomeCliente = limparTexto(dados.nomeCliente);
  const telefoneCliente = limparTexto(dados.telefoneCliente);
  const servico = limparTexto(dados.servico);
  const dataInteresse = limparTexto(dados.dataInteresse);
  const observacoes = limparTexto(dados.observacoes).slice(0, 240);

  if (nomeCliente.length < 3) {
    return {
      erro: "Informe o nome do cliente para entrar na lista de espera.",
    };
  }

  if (telefoneCliente.length < 8) {
    return { erro: "Informe um telefone valido para a lista de espera." };
  }

  if (!servico) {
    return { erro: "Escolha um servico antes de entrar na lista de espera." };
  }

  if (!validarData(dataInteresse)) {
    return { erro: "Informe uma data valida para a lista de espera." };
  }

  if (dataInteresse < obterDataHoje()) {
    return {
      erro: "Nao e possivel entrar na lista de espera para uma data passada.",
    };
  }

  if (dataEhDomingo(dataInteresse)) {
    return {
      erro: "Domingo e folga. Escolha outro dia para a lista de espera.",
    };
  }

  return {
    nomeCliente,
    telefoneCliente,
    servico,
    dataInteresse,
    observacoes,
  };
}

function validarBloqueioHorario(dados) {
  const dataAgendamento = limparTexto(dados.dataAgendamento);
  const horarioAgendamento = limparTexto(dados.horarioAgendamento);
  const motivo = limparTexto(dados.motivo).slice(0, 180);

  if (!validarData(dataAgendamento)) {
    return { erro: "Informe uma data valida para o bloqueio." };
  }

  if (dataAgendamento < obterDataHoje()) {
    return { erro: "Nao e possivel bloquear horarios em uma data passada." };
  }

  if (dataEhDomingo(dataAgendamento)) {
    return { erro: "Domingo ja e folga. Escolha outro dia para bloquear." };
  }

  if (!validarHorario(horarioAgendamento)) {
    return { erro: "Escolha um horario valido para o bloqueio." };
  }

  return {
    dataAgendamento,
    horarioAgendamento,
    motivo,
  };
}

function validarBloqueioDia(dados) {
  const dataAgendamento = limparTexto(dados.dataAgendamento);
  const motivo = limparTexto(dados.motivo).slice(0, 180);

  if (!validarData(dataAgendamento)) {
    return { erro: "Informe uma data valida para o bloqueio do dia." };
  }

  if (dataAgendamento < obterDataHoje()) {
    return { erro: "Nao e possivel bloquear uma data passada." };
  }

  if (dataEhDomingo(dataAgendamento)) {
    return { erro: "Domingo ja e folga. Escolha outro dia para bloquear." };
  }

  return {
    dataAgendamento,
    motivo,
  };
}

function bloquearHorario(dataAgendamento, horarioAgendamento, motivo = "") {
  const agendamentoExistente = buscarAgendamentoPorDataHorario.get(
    dataAgendamento,
    horarioAgendamento,
  );

  if (agendamentoExistente && agendamentoExistente.status !== "cancelado") {
    return { erro: "Esse horario ja possui um agendamento ativo." };
  }

  const bloqueioExistente = buscarBloqueioPorDataHorario.get(
    dataAgendamento,
    horarioAgendamento,
  );

  if (bloqueioExistente) {
    return { erro: "Esse horario ja esta bloqueado." };
  }

  inserirBloqueioHorario.run(dataAgendamento, horarioAgendamento, motivo);
  return { sucesso: true };
}

function bloquearDiaInteiro(dataAgendamento, motivo = "") {
  let totalBloqueados = 0;
  let totalOcupados = 0;
  let totalJaBloqueados = 0;

  for (const horario of HORARIOS_PADRAO) {
    const agendamentoExistente = buscarAgendamentoPorDataHorario.get(
      dataAgendamento,
      horario,
    );
    const bloqueioExistente = buscarBloqueioPorDataHorario.get(
      dataAgendamento,
      horario,
    );

    if (agendamentoExistente && agendamentoExistente.status !== "cancelado") {
      totalOcupados += 1;
      continue;
    }

    if (bloqueioExistente) {
      totalJaBloqueados += 1;
      continue;
    }

    inserirBloqueioHorario.run(dataAgendamento, horario, motivo);
    totalBloqueados += 1;
  }

  return {
    totalBloqueados,
    totalOcupados,
    totalJaBloqueados,
  };
}

async function enviarArquivo(resposta, caminhoArquivo) {
  const extensao = path.extname(caminhoArquivo).toLowerCase();
  const tipoArquivo = TIPOS_ARQUIVO[extensao] || "application/octet-stream";

  try {
    const conteudo = await fsPromises.readFile(caminhoArquivo);
    resposta.writeHead(200, { "Content-Type": tipoArquivo });
    resposta.end(conteudo);
  } catch (erro) {
    if (erro.code === "ENOENT") {
      enviarTexto(resposta, 404, "Arquivo nao encontrado.");
      return;
    }

    enviarTexto(resposta, 500, "Erro ao carregar arquivo.");
  }
}

function resolverArquivoEstatico(caminhoUrl) {
  if (caminhoUrl === "/") caminhoUrl = "/index.html";
  if (caminhoUrl === "/admin") caminhoUrl = "/admin.html";
  if (caminhoUrl === "/sistema") caminhoUrl = "/sistema.html";

  const caminhoRelativo = caminhoUrl.replace(/^\/+/, "");
  const diretorioPublico = path.join(DIRETORIO_BASE, "public");
  const caminhoArquivo = path.normalize(
    path.join(diretorioPublico, caminhoRelativo),
  );

  if (!caminhoArquivo.startsWith(diretorioPublico)) {
    return null;
  }

  return caminhoArquivo;
}

async function tratarRotasApi(requisicao, resposta, url) {
  if (requisicao.method === "OPTIONS") {
    resposta.writeHead(204, obterCabecalhosApi());
    resposta.end();
    return true;
  }

  if (requisicao.method === "GET" && url.pathname === "/api/agendamentos") {
    const agendamentos = buscarAgendamentos.all();
    enviarJson(resposta, 200, { agendamentos });
    return true;
  }

  if (
    requisicao.method === "GET" &&
    url.pathname === "/api/meus-agendamentos"
  ) {
    const nomeCliente = limparTexto(url.searchParams.get("nomeCliente"));
    const telefoneCliente = limparTexto(
      url.searchParams.get("telefoneCliente"),
    );

    if (
      nomeCliente.length < 3 ||
      normalizarTelefoneComparacao(telefoneCliente).length < 8
    ) {
      enviarJson(resposta, 400, {
        erro: "Informe nome e telefone validos para localizar seus agendamentos.",
      });
      return true;
    }

    const agendamentos = buscarAgendamentosAtivosFuturos
      .all(obterDataHoje())
      .filter(
        (agendamento) =>
          normalizarTextoComparacao(agendamento.nomeCliente) ===
            normalizarTextoComparacao(nomeCliente) &&
          normalizarTelefoneComparacao(agendamento.telefoneCliente) ===
            normalizarTelefoneComparacao(telefoneCliente) &&
          agendamentoAindaCancelavel(
            agendamento.dataAgendamento,
            agendamento.horarioAgendamento,
          ),
      );

    enviarJson(resposta, 200, { agendamentos });
    return true;
  }

  if (
    requisicao.method === "GET" &&
    url.pathname === "/api/historico-cliente"
  ) {
    const nomeCliente = limparTexto(url.searchParams.get("nomeCliente"));
    const telefoneCliente = limparTexto(
      url.searchParams.get("telefoneCliente"),
    );

    if (
      nomeCliente.length < 3 ||
      normalizarTelefoneComparacao(telefoneCliente).length < 8
    ) {
      enviarJson(resposta, 400, {
        erro: "Informe nome e telefone validos para localizar seu historico.",
      });
      return true;
    }

    const historico = buscarHistoricoAgendamentosCliente
      .all()
      .filter(
        (agendamento) =>
          normalizarTextoComparacao(agendamento.nomeCliente) ===
            normalizarTextoComparacao(nomeCliente) &&
          normalizarTelefoneComparacao(agendamento.telefoneCliente) ===
            normalizarTelefoneComparacao(telefoneCliente),
      );

    enviarJson(resposta, 200, { historico });
    return true;
  }

  if (requisicao.method === "GET" && url.pathname === "/api/lista-espera") {
    const listaEspera = buscarListaEspera.all();
    enviarJson(resposta, 200, { listaEspera });
    return true;
  }

  if (requisicao.method === "GET" && url.pathname === "/api/bloqueios") {
    const data = limparTexto(url.searchParams.get("data"));

    if (!validarData(data)) {
      enviarJson(resposta, 400, {
        erro: "Informe uma data valida para consultar bloqueios.",
      });
      return true;
    }

    const bloqueios = buscarBloqueiosPorData.all(data);
    enviarJson(resposta, 200, { bloqueios });
    return true;
  }

  const resultadoRotaConcluir = url.pathname.match(
    /^\/api\/agendamentos\/(\d+)\/concluir$/,
  );
  const resultadoRotaCancelar = url.pathname.match(
    /^\/api\/agendamentos\/(\d+)\/cancelar$/,
  );
  const resultadoRotaListaEspera = url.pathname.match(
    /^\/api\/lista-espera\/(\d+)$/,
  );

  if (requisicao.method === "PATCH" && resultadoRotaConcluir) {
    const idAgendamento = Number(resultadoRotaConcluir[1]);
    const agendamento = buscarAgendamentoPorId.get(idAgendamento);

    if (!agendamento) {
      enviarJson(resposta, 404, { erro: "Agendamento nao encontrado." });
      return true;
    }

    if (agendamento.status === "concluido") {
      enviarJson(resposta, 200, {
        mensagem: "Esse agendamento ja estava concluido.",
      });
      return true;
    }

    concluirAgendamento.run(idAgendamento);
    enviarJson(resposta, 200, {
      mensagem: "Agendamento marcado como concluido.",
    });
    return true;
  }

  if (requisicao.method === "PATCH" && resultadoRotaCancelar) {
    let corpo;

    try {
      corpo = await lerCorpoJson(requisicao);
    } catch (erro) {
      enviarJson(resposta, 400, {
        erro: "Nao foi possivel validar os dados do cliente.",
      });
      return true;
    }

    const idAgendamento = Number(resultadoRotaCancelar[1]);
    const nomeCliente = limparTexto(corpo.nomeCliente);
    const telefoneCliente = limparTexto(corpo.telefoneCliente);
    const agendamento = buscarAgendamentoPorId.get(idAgendamento);

    if (!agendamento) {
      enviarJson(resposta, 404, { erro: "Agendamento nao encontrado." });
      return true;
    }

    if (agendamento.status === "cancelado") {
      enviarJson(resposta, 200, {
        mensagem: "Esse agendamento ja estava cancelado.",
      });
      return true;
    }

    if (agendamento.status !== "ativo") {
      enviarJson(resposta, 400, {
        erro: "Esse agendamento nao pode mais ser cancelado.",
      });
      return true;
    }

    if (
      normalizarTextoComparacao(agendamento.nomeCliente) !==
        normalizarTextoComparacao(nomeCliente) ||
      normalizarTelefoneComparacao(agendamento.telefoneCliente) !==
        normalizarTelefoneComparacao(telefoneCliente)
    ) {
      enviarJson(resposta, 403, {
        erro: "Nome ou telefone nao conferem com o agendamento informado.",
      });
      return true;
    }

    if (
      !agendamentoAindaCancelavel(
        agendamento.dataAgendamento,
        agendamento.horarioAgendamento,
      )
    ) {
      enviarJson(resposta, 400, {
        erro: "Esse horario ja passou e nao pode mais ser cancelado por aqui.",
      });
      return true;
    }

    cancelarAgendamento.run(idAgendamento);
    enviarJson(resposta, 200, {
      mensagem: "Agendamento cancelado com sucesso.",
    });
    return true;
  }

  if (requisicao.method === "PATCH" && resultadoRotaListaEspera) {
    let corpo;

    try {
      corpo = await lerCorpoJson(requisicao);
    } catch (erro) {
      enviarJson(resposta, 400, {
        erro: "Nao foi possivel validar a atualizacao da lista de espera.",
      });
      return true;
    }

    const idListaEspera = Number(resultadoRotaListaEspera[1]);
    const novoStatus = limparTexto(corpo.status);
    const itemListaEspera = buscarListaEsperaPorId.get(idListaEspera);

    if (!itemListaEspera) {
      enviarJson(resposta, 404, {
        erro: "Item da lista de espera nao encontrado.",
      });
      return true;
    }

    if (!["pendente", "contatado", "encerrado"].includes(novoStatus)) {
      enviarJson(resposta, 400, {
        erro: "Status invalido para a lista de espera.",
      });
      return true;
    }

    atualizarStatusListaEspera.run(novoStatus, idListaEspera);
    enviarJson(resposta, 200, {
      mensagem: "Lista de espera atualizada com sucesso.",
    });
    return true;
  }

  if (requisicao.method === "GET" && url.pathname === "/api/horarios") {
    const data = limparTexto(url.searchParams.get("data"));

    if (!validarData(data)) {
      enviarJson(resposta, 400, { erro: "Data invalida." });
      return true;
    }

    if (dataEhDomingo(data)) {
      enviarJson(resposta, 200, {
        data,
        diaFechado: true,
        motivo: "Domingo e folga.",
        horariosPadrao: HORARIOS_PADRAO,
        horariosOcupados: [],
        horariosBloqueados: [],
        horariosDisponiveis: [],
      });
      return true;
    }

    const horariosOcupados = buscarHorariosOcupados
      .all(data)
      .map((item) => item.horario);
    const horariosBloqueados = buscarBloqueiosPorData
      .all(data)
      .map((item) => item.horarioAgendamento);
    const horariosPassados = obterHorariosPassados(data);
    const horariosIndisponiveis = HORARIOS_PADRAO.filter(
      (horario) =>
        horariosOcupados.includes(horario) ||
        horariosBloqueados.includes(horario) ||
        horariosPassados.includes(horario),
    );
    const horariosDisponiveis = HORARIOS_PADRAO.filter(
      (horario) => !horariosIndisponiveis.includes(horario),
    );

    enviarJson(resposta, 200, {
      data,
      diaFechado: false,
      horariosPadrao: HORARIOS_PADRAO,
      horariosOcupados,
      horariosBloqueados,
      horariosPassados,
      horariosIndisponiveis,
      horariosDisponiveis,
    });
    return true;
  }

  if (requisicao.method === "GET" && url.pathname === "/api/datas-ocupadas") {
    const inicio =
      limparTexto(url.searchParams.get("inicio")) || obterDataHoje();
    const dias = Number(url.searchParams.get("dias")) || 30;

    if (!validarData(inicio)) {
      enviarJson(resposta, 400, { erro: "Data inicial invalida." });
      return true;
    }

    if (!Number.isInteger(dias) || dias < 1 || dias > 90) {
      enviarJson(resposta, 400, { erro: "Quantidade de dias invalida." });
      return true;
    }

    const fim = somarDiasNaData(inicio, dias - 1);
    const mapaOcupacao = new Map(
      buscarDatasOcupadas
        .all(inicio, fim)
        .map((item) => [item.data, Number(item.totalAgendamentos)]),
    );
    const mapaBloqueios = new Map(
      buscarBloqueiosEntreDatas
        .all(inicio, fim)
        .map((item) => [item.data, Number(item.totalBloqueios)]),
    );
    const datas = [];

    for (let indice = 0; indice < dias; indice += 1) {
      const data = somarDiasNaData(inicio, indice);
      const totalAgendamentos = mapaOcupacao.get(data) || 0;
      const totalBloqueios = mapaBloqueios.get(data) || 0;
      const totalIndisponiveis = totalAgendamentos + totalBloqueios;

      datas.push({
        data,
        totalAgendamentos,
        totalBloqueios,
        totalHorarios: HORARIOS_PADRAO.length,
        horariosRestantes: Math.max(
          HORARIOS_PADRAO.length - totalIndisponiveis,
          0,
        ),
        lotada: totalIndisponiveis >= HORARIOS_PADRAO.length,
      });
    }

    enviarJson(resposta, 200, {
      inicio,
      fim,
      totalHorarios: HORARIOS_PADRAO.length,
      datas,
    });
    return true;
  }

  if (requisicao.method === "POST" && url.pathname === "/api/agendamentos") {
    let corpo;

    try {
      corpo = await lerCorpoJson(requisicao);
    } catch (erro) {
      enviarJson(resposta, 400, {
        erro: "Nao foi possivel ler os dados enviados.",
      });
      return true;
    }

    const dadosValidados = validarAgendamento(corpo);

    if (dadosValidados.erro) {
      enviarJson(resposta, 400, { erro: dadosValidados.erro });
      return true;
    }

    try {
      const lembreteEm = calcularLembreteEm(
        dadosValidados.dataAgendamento,
        dadosValidados.horarioAgendamento,
      );
      const agendamentoExistente = buscarAgendamentoPorDataHorario.get(
        dadosValidados.dataAgendamento,
        dadosValidados.horarioAgendamento,
      );
      const bloqueioExistente = buscarBloqueioPorDataHorario.get(
        dadosValidados.dataAgendamento,
        dadosValidados.horarioAgendamento,
      );

      if (bloqueioExistente) {
        enviarJson(resposta, 409, {
          erro: "Esse horario esta bloqueado pela barbearia. Escolha outro.",
        });
        return true;
      }

      if (agendamentoExistente && agendamentoExistente.status !== "cancelado") {
        enviarJson(resposta, 409, {
          erro: "Esse horario ja foi agendado. Escolha outro.",
        });
        return true;
      }

      if (agendamentoExistente && agendamentoExistente.status === "cancelado") {
        reativarAgendamento.run(
          dadosValidados.nomeCliente,
          dadosValidados.telefoneCliente,
          dadosValidados.servico,
          dadosValidados.duracao,
          dadosValidados.preco,
          lembreteEm,
          agendamentoExistente.id,
        );

        enviarJson(resposta, 201, {
          mensagem: "Agendamento realizado com sucesso!",
          id: Number(agendamentoExistente.id),
          lembreteEm,
        });
        return true;
      }

      const resultado = inserirAgendamento.run(
        dadosValidados.nomeCliente,
        dadosValidados.telefoneCliente,
        dadosValidados.servico,
        dadosValidados.duracao,
        dadosValidados.preco,
        dadosValidados.dataAgendamento,
        dadosValidados.horarioAgendamento,
        lembreteEm,
      );

      enviarJson(resposta, 201, {
        mensagem: "Agendamento realizado com sucesso!",
        id: Number(resultado.lastInsertRowid),
        lembreteEm,
      });
    } catch (erro) {
      enviarJson(resposta, 500, {
        erro: "Erro interno ao salvar o agendamento.",
      });
    }

    return true;
  }

  if (requisicao.method === "POST" && url.pathname === "/api/lista-espera") {
    let corpo;

    try {
      corpo = await lerCorpoJson(requisicao);
    } catch (erro) {
      enviarJson(resposta, 400, {
        erro: "Nao foi possivel ler os dados da lista de espera.",
      });
      return true;
    }

    const dadosValidados = validarListaEspera(corpo);

    if (dadosValidados.erro) {
      enviarJson(resposta, 400, { erro: dadosValidados.erro });
      return true;
    }

    try {
      const resultado = inserirListaEspera.run(
        dadosValidados.nomeCliente,
        dadosValidados.telefoneCliente,
        dadosValidados.servico,
        dadosValidados.dataInteresse,
        dadosValidados.observacoes,
      );

      enviarJson(resposta, 201, {
        mensagem: "Voce entrou na lista de espera com sucesso.",
        id: Number(resultado.lastInsertRowid),
      });
    } catch (erro) {
      enviarJson(resposta, 500, {
        erro: "Erro interno ao salvar a lista de espera.",
      });
    }

    return true;
  }

  if (requisicao.method === "POST" && url.pathname === "/api/bloqueios") {
    let corpo;

    try {
      corpo = await lerCorpoJson(requisicao);
    } catch (erro) {
      enviarJson(resposta, 400, {
        erro: "Nao foi possivel ler os dados do bloqueio.",
      });
      return true;
    }

    const dadosValidados = validarBloqueioHorario(corpo);

    if (dadosValidados.erro) {
      enviarJson(resposta, 400, { erro: dadosValidados.erro });
      return true;
    }

    const resultado = bloquearHorario(
      dadosValidados.dataAgendamento,
      dadosValidados.horarioAgendamento,
      dadosValidados.motivo,
    );

    if (resultado.erro) {
      enviarJson(resposta, 409, { erro: resultado.erro });
      return true;
    }

    enviarJson(resposta, 201, { mensagem: "Horario bloqueado com sucesso." });
    return true;
  }

  if (requisicao.method === "PATCH" && url.pathname === "/api/bloqueios") {
    let corpo;

    try {
      corpo = await lerCorpoJson(requisicao);
    } catch (erro) {
      enviarJson(resposta, 400, {
        erro: "Nao foi possivel ler os dados para liberar o horario.",
      });
      return true;
    }

    const dadosValidados = validarBloqueioHorario(corpo);

    if (dadosValidados.erro) {
      enviarJson(resposta, 400, { erro: dadosValidados.erro });
      return true;
    }

    const bloqueioExistente = buscarBloqueioPorDataHorario.get(
      dadosValidados.dataAgendamento,
      dadosValidados.horarioAgendamento,
    );

    if (!bloqueioExistente) {
      enviarJson(resposta, 404, {
        erro: "Nenhum bloqueio encontrado para esse horario.",
      });
      return true;
    }

    removerBloqueioHorario.run(
      dadosValidados.dataAgendamento,
      dadosValidados.horarioAgendamento,
    );
    enviarJson(resposta, 200, { mensagem: "Horario liberado com sucesso." });
    return true;
  }

  if (requisicao.method === "POST" && url.pathname === "/api/bloqueios-dia") {
    let corpo;

    try {
      corpo = await lerCorpoJson(requisicao);
    } catch (erro) {
      enviarJson(resposta, 400, {
        erro: "Nao foi possivel ler os dados para bloquear o dia.",
      });
      return true;
    }

    const dadosValidados = validarBloqueioDia(corpo);

    if (dadosValidados.erro) {
      enviarJson(resposta, 400, { erro: dadosValidados.erro });
      return true;
    }

    const resultado = bloquearDiaInteiro(
      dadosValidados.dataAgendamento,
      dadosValidados.motivo,
    );
    enviarJson(resposta, 200, {
      mensagem: `${resultado.totalBloqueados} horario(s) bloqueado(s). ${resultado.totalOcupados} ocupado(s) foram preservados.`,
    });
    return true;
  }

  if (requisicao.method === "PATCH" && url.pathname === "/api/bloqueios-dia") {
    let corpo;

    try {
      corpo = await lerCorpoJson(requisicao);
    } catch (erro) {
      enviarJson(resposta, 400, {
        erro: "Nao foi possivel ler os dados para liberar o dia.",
      });
      return true;
    }

    const dadosValidados = validarBloqueioDia(corpo);

    if (dadosValidados.erro) {
      enviarJson(resposta, 400, { erro: dadosValidados.erro });
      return true;
    }

    removerBloqueiosPorData.run(dadosValidados.dataAgendamento);
    enviarJson(resposta, 200, {
      mensagem: "Todos os bloqueios desse dia foram liberados.",
    });
    return true;
  }

  if (requisicao.method === "PATCH" && url.pathname === "/api/resetar-dia") {
    let corpo;

    try {
      corpo = await lerCorpoJson(requisicao);
    } catch (erro) {
      enviarJson(resposta, 400, {
        erro: "Nao foi possivel ler os dados para resetar o dia.",
      });
      return true;
    }

    const dataAgendamento = limparTexto(corpo.dataAgendamento);

    if (!validarData(dataAgendamento)) {
      enviarJson(resposta, 400, {
        erro: "Informe uma data valida para resetar o dia.",
      });
      return true;
    }

    cancelarAgendamentosPorData.run(dataAgendamento);
    enviarJson(resposta, 200, {
      mensagem: "Todos os agendamentos desse dia foram cancelados.",
    });
    return true;
  }

  return false;
}

const servidor = http.createServer(async (requisicao, resposta) => {
  if (requisicao.method === "OPTIONS") {
    resposta.writeHead(204, obterCabecalhosApi());
    resposta.end();
    return;
  }
  const url = new URL(requisicao.url, `http://${requisicao.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    const rotaFoiTratada = await tratarRotasApi(requisicao, resposta, url);

    if (!rotaFoiTratada) {
      enviarJson(resposta, 404, { erro: "Rota nao encontrada." });
    }

    return;
  }

  const caminhoArquivo = resolverArquivoEstatico(url.pathname);

  if (!caminhoArquivo) {
    enviarTexto(resposta, 403, "Acesso negado.");
    return;
  }

  await enviarArquivo(resposta, caminhoArquivo);
});

servidor.listen(PORTA, () => {
  console.log(`Servidor rodando em http://localhost:${PORTA}`);
});
