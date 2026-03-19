const http = require("node:http");
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const path = require("node:path");
const { Pool } = require("pg");
const PORTA = Number(process.env.PORT) || 3333;
process.env.TZ = "America/Sao_Paulo";
const DIRETORIO_BASE = __dirname;
const DIRETORIO_DADOS = path.join(DIRETORIO_BASE, "dados");
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

// ================= POSTGRESQL =================
const banco = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

async function inicializarBanco() {
  const client = await banco.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS agendamentos (
        id SERIAL PRIMARY KEY,
        nome_cliente TEXT NOT NULL,
        telefone_cliente TEXT NOT NULL,
        servico TEXT NOT NULL,
        duracao TEXT NOT NULL,
        preco TEXT NOT NULL,
        data_agendamento TEXT NOT NULL,
        horario_agendamento TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ativo',
        lembrete_em TEXT,
        concluido_em TEXT,
        cancelado_em TEXT,
        criado_em TEXT NOT NULL DEFAULT TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS'),
        UNIQUE (data_agendamento, horario_agendamento)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS lista_espera (
        id SERIAL PRIMARY KEY,
        nome_cliente TEXT NOT NULL,
        telefone_cliente TEXT NOT NULL,
        servico TEXT NOT NULL,
        data_interesse TEXT NOT NULL,
        observacoes TEXT,
        status TEXT NOT NULL DEFAULT 'pendente',
        criado_em TEXT NOT NULL DEFAULT TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS'),
        atualizado_em TEXT NOT NULL DEFAULT TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS')
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bloqueios_horario (
        id SERIAL PRIMARY KEY,
        data_agendamento TEXT NOT NULL,
        horario_agendamento TEXT NOT NULL,
        motivo TEXT,
        criado_em TEXT NOT NULL DEFAULT TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS'),
        UNIQUE (data_agendamento, horario_agendamento)
      )
    `);

    console.log("Banco de dados PostgreSQL inicializado com sucesso.");
  } catch (erro) {
    console.error("Erro ao inicializar banco de dados:", erro.message);
    throw erro;
  } finally {
    client.release();
  }
}

// ================= FUNÇÕES AUXILIARES =================

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
  if (!conteudo) return {};
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
  const formatador = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatador.format(agora);
}

function obterHorarioAgora() {
  const agora = new Date();
  const formatador = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatador.format(agora);
}

function obterHorariosPassados(dataAgendamento) {
  if (dataAgendamento !== obterDataHoje()) return [];
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
  const dataHoraAgendamento = new Date(`${dataAgendamento}T${horarioAgendamento}:00`);
  const dataHoraLembrete = new Date(dataHoraAgendamento.getTime() - 60 * 60 * 1000);
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
  if (dataAgendamento > hoje) return true;
  if (dataAgendamento < hoje) return false;
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

  if (nomeCliente.length < 3) return { erro: "Informe o nome do cliente." };
  if (telefoneCliente.length < 8) return { erro: "Informe um telefone valido." };
  if (!servico || !duracao || !preco) return { erro: "Selecione um servico valido." };
  if (!validarData(dataAgendamento)) return { erro: "Informe uma data valida." };
  if (dataAgendamento < obterDataHoje()) return { erro: "Nao e possivel agendar em uma data passada." };
  if (dataEhDomingo(dataAgendamento)) return { erro: "Domingo e folga. Escolha outro dia." };
  if (!validarHorario(horarioAgendamento)) return { erro: "Escolha um horario valido." };
  if (obterHorariosPassados(dataAgendamento).includes(horarioAgendamento)) {
    return { erro: "Esse horario ja passou para hoje. Escolha um horario futuro." };
  }

  return { nomeCliente, telefoneCliente, servico, duracao, preco, dataAgendamento, horarioAgendamento };
}

function validarListaEspera(dados) {
  const nomeCliente = limparTexto(dados.nomeCliente);
  const telefoneCliente = limparTexto(dados.telefoneCliente);
  const servico = limparTexto(dados.servico);
  const dataInteresse = limparTexto(dados.dataInteresse);
  const observacoes = limparTexto(dados.observacoes).slice(0, 240);

  if (nomeCliente.length < 3) return { erro: "Informe o nome do cliente para entrar na lista de espera." };
  if (telefoneCliente.length < 8) return { erro: "Informe um telefone valido para a lista de espera." };
  if (!servico) return { erro: "Escolha um servico antes de entrar na lista de espera." };
  if (!validarData(dataInteresse)) return { erro: "Informe uma data valida para a lista de espera." };
  if (dataInteresse < obterDataHoje()) return { erro: "Nao e possivel entrar na lista de espera para uma data passada." };
  if (dataEhDomingo(dataInteresse)) return { erro: "Domingo e folga. Escolha outro dia para a lista de espera." };

  return { nomeCliente, telefoneCliente, servico, dataInteresse, observacoes };
}

function validarBloqueioHorario(dados) {
  const dataAgendamento = limparTexto(dados.dataAgendamento);
  const horarioAgendamento = limparTexto(dados.horarioAgendamento);
  const motivo = limparTexto(dados.motivo).slice(0, 180);

  if (!validarData(dataAgendamento)) return { erro: "Informe uma data valida para o bloqueio." };
  if (dataAgendamento < obterDataHoje()) return { erro: "Nao e possivel bloquear horarios em uma data passada." };
  if (dataEhDomingo(dataAgendamento)) return { erro: "Domingo ja e folga. Escolha outro dia para bloquear." };
  if (!validarHorario(horarioAgendamento)) return { erro: "Escolha um horario valido para o bloqueio." };

  return { dataAgendamento, horarioAgendamento, motivo };
}

function validarBloqueioDia(dados) {
  const dataAgendamento = limparTexto(dados.dataAgendamento);
  const motivo = limparTexto(dados.motivo).slice(0, 180);

  if (!validarData(dataAgendamento)) return { erro: "Informe uma data valida para o bloqueio do dia." };
  if (dataAgendamento < obterDataHoje()) return { erro: "Nao e possivel bloquear uma data passada." };
  if (dataEhDomingo(dataAgendamento)) return { erro: "Domingo ja e folga. Escolha outro dia para bloquear." };

  return { dataAgendamento, motivo };
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
  const caminhoArquivo = path.normalize(path.join(diretorioPublico, caminhoRelativo));

  if (!caminhoArquivo.startsWith(diretorioPublico)) return null;
  return caminhoArquivo;
}

// ================= ROTAS DA API =================

async function tratarRotasApi(requisicao, resposta, url) {
  if (requisicao.method === "OPTIONS") {
    resposta.writeHead(204, obterCabecalhosApi());
    resposta.end();
    return true;
  }

  // ── HEALTH CHECK ──────────────────────────────────────────
  if (requisicao.method === "GET" && url.pathname === "/health") {
    enviarJson(resposta, 200, { ok: true, timestamp: new Date().toISOString() });
    return true;
  }

  // ── GET /api/agendamentos ──────────────────────────────────
  if (requisicao.method === "GET" && url.pathname === "/api/agendamentos") {
    const resultado = await banco.query(`
      SELECT
        id,
        nome_cliente AS "nomeCliente",
        telefone_cliente AS "telefoneCliente",
        servico,
        duracao,
        preco,
        data_agendamento AS "dataAgendamento",
        horario_agendamento AS "horarioAgendamento",
        criado_em AS "criadoEm",
        status,
        concluido_em AS "concluidoEm",
        cancelado_em AS "canceladoEm"
      FROM agendamentos
      ORDER BY data_agendamento ASC, horario_agendamento ASC
    `);
    enviarJson(resposta, 200, { agendamentos: resultado.rows });
    return true;
  }

  // ── GET /api/meus-agendamentos ─────────────────────────────
  if (requisicao.method === "GET" && url.pathname === "/api/meus-agendamentos") {
    const nomeCliente = limparTexto(url.searchParams.get("nomeCliente"));
    const telefoneCliente = limparTexto(url.searchParams.get("telefoneCliente"));

    if (nomeCliente.length < 3 || normalizarTelefoneComparacao(telefoneCliente).length < 8) {
      enviarJson(resposta, 400, { erro: "Informe nome e telefone validos para localizar seus agendamentos." });
      return true;
    }

    const hoje = obterDataHoje();
    const resultado = await banco.query(`
      SELECT
        id,
        nome_cliente AS "nomeCliente",
        telefone_cliente AS "telefoneCliente",
        servico,
        duracao,
        preco,
        data_agendamento AS "dataAgendamento",
        horario_agendamento AS "horarioAgendamento",
        status
      FROM agendamentos
      WHERE status = 'ativo'
        AND data_agendamento >= $1
      ORDER BY data_agendamento ASC, horario_agendamento ASC
    `, [hoje]);

    const agendamentos = resultado.rows.filter(
      (ag) =>
        normalizarTextoComparacao(ag.nomeCliente) === normalizarTextoComparacao(nomeCliente) &&
        normalizarTelefoneComparacao(ag.telefoneCliente) === normalizarTelefoneComparacao(telefoneCliente) &&
        agendamentoAindaCancelavel(ag.dataAgendamento, ag.horarioAgendamento),
    );

    enviarJson(resposta, 200, { agendamentos });
    return true;
  }

  // ── GET /api/historico-cliente ─────────────────────────────
  if (requisicao.method === "GET" && url.pathname === "/api/historico-cliente") {
    const nomeCliente = limparTexto(url.searchParams.get("nomeCliente"));
    const telefoneCliente = limparTexto(url.searchParams.get("telefoneCliente"));

    if (nomeCliente.length < 3 || normalizarTelefoneComparacao(telefoneCliente).length < 8) {
      enviarJson(resposta, 400, { erro: "Informe nome e telefone validos para localizar seu historico." });
      return true;
    }

    const resultado = await banco.query(`
      SELECT
        id,
        nome_cliente AS "nomeCliente",
        telefone_cliente AS "telefoneCliente",
        servico,
        duracao,
        preco,
        data_agendamento AS "dataAgendamento",
        horario_agendamento AS "horarioAgendamento",
        criado_em AS "criadoEm",
        status,
        concluido_em AS "concluidoEm",
        cancelado_em AS "canceladoEm"
      FROM agendamentos
      ORDER BY data_agendamento DESC, horario_agendamento DESC
    `);

    const historico = resultado.rows.filter(
      (ag) =>
        normalizarTextoComparacao(ag.nomeCliente) === normalizarTextoComparacao(nomeCliente) &&
        normalizarTelefoneComparacao(ag.telefoneCliente) === normalizarTelefoneComparacao(telefoneCliente),
    );

    enviarJson(resposta, 200, { historico });
    return true;
  }

  // ── GET /api/lista-espera ──────────────────────────────────
  if (requisicao.method === "GET" && url.pathname === "/api/lista-espera") {
    const resultado = await banco.query(`
      SELECT
        id,
        nome_cliente AS "nomeCliente",
        telefone_cliente AS "telefoneCliente",
        servico,
        data_interesse AS "dataInteresse",
        observacoes,
        status,
        criado_em AS "criadoEm",
        atualizado_em AS "atualizadoEm"
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
    enviarJson(resposta, 200, { listaEspera: resultado.rows });
    return true;
  }

  // ── GET /api/bloqueios ─────────────────────────────────────
  if (requisicao.method === "GET" && url.pathname === "/api/bloqueios") {
    const data = limparTexto(url.searchParams.get("data"));

    if (!validarData(data)) {
      enviarJson(resposta, 400, { erro: "Informe uma data valida para consultar bloqueios." });
      return true;
    }

    const resultado = await banco.query(`
      SELECT
        id,
        data_agendamento AS "dataAgendamento",
        horario_agendamento AS "horarioAgendamento",
        motivo,
        criado_em AS "criadoEm"
      FROM bloqueios_horario
      WHERE data_agendamento = $1
      ORDER BY horario_agendamento ASC
    `, [data]);

    enviarJson(resposta, 200, { bloqueios: resultado.rows });
    return true;
  }

  // ── GET /api/horarios ──────────────────────────────────────
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

    const [resOcupados, resBloqueados] = await Promise.all([
      banco.query(
        `SELECT horario_agendamento AS horario FROM agendamentos WHERE data_agendamento = $1 AND status != 'cancelado' ORDER BY horario_agendamento ASC`,
        [data]
      ),
      banco.query(
        `SELECT horario_agendamento FROM bloqueios_horario WHERE data_agendamento = $1 ORDER BY horario_agendamento ASC`,
        [data]
      ),
    ]);

    const horariosOcupados = resOcupados.rows.map((r) => r.horario);
    const horariosBloqueados = resBloqueados.rows.map((r) => r.horario_agendamento);
    const horariosPassados = obterHorariosPassados(data);
    const horariosIndisponiveis = HORARIOS_PADRAO.filter(
      (h) => horariosOcupados.includes(h) || horariosBloqueados.includes(h) || horariosPassados.includes(h)
    );
    const horariosDisponiveis = HORARIOS_PADRAO.filter((h) => !horariosIndisponiveis.includes(h));

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

  // ── GET /api/datas-ocupadas ────────────────────────────────
  if (requisicao.method === "GET" && url.pathname === "/api/datas-ocupadas") {
    const inicio = limparTexto(url.searchParams.get("inicio")) || obterDataHoje();
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

    const [resOcupadas, resBloqueios] = await Promise.all([
      banco.query(
        `SELECT data_agendamento AS data, COUNT(*) AS total FROM agendamentos WHERE data_agendamento BETWEEN $1 AND $2 AND status != 'cancelado' GROUP BY data_agendamento ORDER BY data_agendamento ASC`,
        [inicio, fim]
      ),
      banco.query(
        `SELECT data_agendamento AS data, COUNT(*) AS total FROM bloqueios_horario WHERE data_agendamento BETWEEN $1 AND $2 GROUP BY data_agendamento ORDER BY data_agendamento ASC`,
        [inicio, fim]
      ),
    ]);

    const mapaOcupacao = new Map(resOcupadas.rows.map((r) => [r.data, Number(r.total)]));
    const mapaBloqueios = new Map(resBloqueios.rows.map((r) => [r.data, Number(r.total)]));
    const datas = [];

    for (let i = 0; i < dias; i++) {
      const data = somarDiasNaData(inicio, i);
      const totalAgendamentos = mapaOcupacao.get(data) || 0;
      const totalBloqueios = mapaBloqueios.get(data) || 0;
      const totalIndisponiveis = totalAgendamentos + totalBloqueios;

      datas.push({
        data,
        totalAgendamentos,
        totalBloqueios,
        totalHorarios: HORARIOS_PADRAO.length,
        horariosRestantes: Math.max(HORARIOS_PADRAO.length - totalIndisponiveis, 0),
        lotada: totalIndisponiveis >= HORARIOS_PADRAO.length,
      });
    }

    enviarJson(resposta, 200, { inicio, fim, totalHorarios: HORARIOS_PADRAO.length, datas });
    return true;
  }

  // ── PATCH /api/agendamentos/:id/concluir ───────────────────
  const rotaConcluir = url.pathname.match(/^\/api\/agendamentos\/(\d+)\/concluir$/);
  if (requisicao.method === "PATCH" && rotaConcluir) {
    const id = Number(rotaConcluir[1]);
    const res = await banco.query(`SELECT id, status FROM agendamentos WHERE id = $1`, [id]);
    const ag = res.rows[0];

    if (!ag) { enviarJson(resposta, 404, { erro: "Agendamento nao encontrado." }); return true; }
    if (ag.status === "concluido") { enviarJson(resposta, 200, { mensagem: "Esse agendamento ja estava concluido." }); return true; }

    await banco.query(
      `UPDATE agendamentos SET status = 'concluido', concluido_em = TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS'), cancelado_em = NULL WHERE id = $1`,
      [id]
    );
    enviarJson(resposta, 200, { mensagem: "Agendamento marcado como concluido." });
    return true;
  }

  // ── PATCH /api/agendamentos/:id/cancelar ───────────────────
  const rotaCancelar = url.pathname.match(/^\/api\/agendamentos\/(\d+)\/cancelar$/);
  if (requisicao.method === "PATCH" && rotaCancelar) {
    let corpo;
    try { corpo = await lerCorpoJson(requisicao); }
    catch { enviarJson(resposta, 400, { erro: "Nao foi possivel validar os dados do cliente." }); return true; }

    const id = Number(rotaCancelar[1]);
    const nomeCliente = limparTexto(corpo.nomeCliente);
    const telefoneCliente = limparTexto(corpo.telefoneCliente);

    const res = await banco.query(
      `SELECT id, nome_cliente AS "nomeCliente", telefone_cliente AS "telefoneCliente", data_agendamento AS "dataAgendamento", horario_agendamento AS "horarioAgendamento", status FROM agendamentos WHERE id = $1`,
      [id]
    );
    const ag = res.rows[0];

    if (!ag) { enviarJson(resposta, 404, { erro: "Agendamento nao encontrado." }); return true; }
    if (ag.status === "cancelado") { enviarJson(resposta, 200, { mensagem: "Esse agendamento ja estava cancelado." }); return true; }
    if (ag.status !== "ativo") { enviarJson(resposta, 400, { erro: "Esse agendamento nao pode mais ser cancelado." }); return true; }

    if (
      normalizarTextoComparacao(ag.nomeCliente) !== normalizarTextoComparacao(nomeCliente) ||
      normalizarTelefoneComparacao(ag.telefoneCliente) !== normalizarTelefoneComparacao(telefoneCliente)
    ) {
      enviarJson(resposta, 403, { erro: "Nome ou telefone nao conferem com o agendamento informado." });
      return true;
    }

    if (!agendamentoAindaCancelavel(ag.dataAgendamento, ag.horarioAgendamento)) {
      enviarJson(resposta, 400, { erro: "Esse horario ja passou e nao pode mais ser cancelado por aqui." });
      return true;
    }

    await banco.query(
      `UPDATE agendamentos SET status = 'cancelado', cancelado_em = TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS'), concluido_em = NULL WHERE id = $1`,
      [id]
    );
    enviarJson(resposta, 200, { mensagem: "Agendamento cancelado com sucesso." });
    return true;
  }

  // ── PATCH /api/lista-espera/:id ────────────────────────────
  const rotaListaEspera = url.pathname.match(/^\/api\/lista-espera\/(\d+)$/);
  if (requisicao.method === "PATCH" && rotaListaEspera) {
    let corpo;
    try { corpo = await lerCorpoJson(requisicao); }
    catch { enviarJson(resposta, 400, { erro: "Nao foi possivel validar a atualizacao da lista de espera." }); return true; }

    const id = Number(rotaListaEspera[1]);
    const novoStatus = limparTexto(corpo.status);

    const res = await banco.query(`SELECT id FROM lista_espera WHERE id = $1`, [id]);
    if (!res.rows[0]) { enviarJson(resposta, 404, { erro: "Item da lista de espera nao encontrado." }); return true; }
    if (!["pendente", "contatado", "encerrado"].includes(novoStatus)) {
      enviarJson(resposta, 400, { erro: "Status invalido para a lista de espera." });
      return true;
    }

    await banco.query(
      `UPDATE lista_espera SET status = $1, atualizado_em = TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS') WHERE id = $2`,
      [novoStatus, id]
    );
    enviarJson(resposta, 200, { mensagem: "Lista de espera atualizada com sucesso." });
    return true;
  }

  // ── POST /api/agendamentos ─────────────────────────────────
  if (requisicao.method === "POST" && url.pathname === "/api/agendamentos") {
    let corpo;
    try { corpo = await lerCorpoJson(requisicao); }
    catch { enviarJson(resposta, 400, { erro: "Nao foi possivel ler os dados enviados." }); return true; }

    const dados = validarAgendamento(corpo);
    if (dados.erro) { enviarJson(resposta, 400, { erro: dados.erro }); return true; }

    try {
      const lembreteEm = calcularLembreteEm(dados.dataAgendamento, dados.horarioAgendamento);

      const [resBloqueio, resExistente] = await Promise.all([
        banco.query(`SELECT id FROM bloqueios_horario WHERE data_agendamento = $1 AND horario_agendamento = $2`, [dados.dataAgendamento, dados.horarioAgendamento]),
        banco.query(`SELECT id, status FROM agendamentos WHERE data_agendamento = $1 AND horario_agendamento = $2`, [dados.dataAgendamento, dados.horarioAgendamento]),
      ]);

      if (resBloqueio.rows[0]) {
        enviarJson(resposta, 409, { erro: "Esse horario esta bloqueado pela barbearia. Escolha outro." });
        return true;
      }

      const agExistente = resExistente.rows[0];

      if (agExistente && agExistente.status !== "cancelado") {
        enviarJson(resposta, 409, { erro: "Esse horario ja foi agendado. Escolha outro." });
        return true;
      }

      if (agExistente && agExistente.status === "cancelado") {
        // Reativa agendamento cancelado no mesmo horário
        await banco.query(
          `UPDATE agendamentos SET
            nome_cliente = $1,
            telefone_cliente = $2,
            servico = $3,
            duracao = $4,
            preco = $5,
            status = 'ativo',
            concluido_em = NULL,
            cancelado_em = NULL,
            criado_em = TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS'),
            lembrete_em = $6
          WHERE id = $7`,
          [dados.nomeCliente, dados.telefoneCliente, dados.servico, dados.duracao, dados.preco, lembreteEm, agExistente.id]
        );
        enviarJson(resposta, 201, { mensagem: "Agendamento realizado com sucesso!", id: Number(agExistente.id), lembreteEm });
        return true;
      }

      const resInserir = await banco.query(
        `INSERT INTO agendamentos (nome_cliente, telefone_cliente, servico, duracao, preco, data_agendamento, horario_agendamento, lembrete_em)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [dados.nomeCliente, dados.telefoneCliente, dados.servico, dados.duracao, dados.preco, dados.dataAgendamento, dados.horarioAgendamento, lembreteEm]
      );

      enviarJson(resposta, 201, {
        mensagem: "Agendamento realizado com sucesso!",
        id: Number(resInserir.rows[0].id),
        lembreteEm,
      });
    } catch (erro) {
      console.error("Erro ao salvar agendamento:", erro.message);
      enviarJson(resposta, 500, { erro: "Erro interno ao salvar o agendamento." });
    }
    return true;
  }

  // ── POST /api/lista-espera ─────────────────────────────────
  if (requisicao.method === "POST" && url.pathname === "/api/lista-espera") {
    let corpo;
    try { corpo = await lerCorpoJson(requisicao); }
    catch { enviarJson(resposta, 400, { erro: "Nao foi possivel ler os dados da lista de espera." }); return true; }

    const dados = validarListaEspera(corpo);
    if (dados.erro) { enviarJson(resposta, 400, { erro: dados.erro }); return true; }

    try {
      const res = await banco.query(
        `INSERT INTO lista_espera (nome_cliente, telefone_cliente, servico, data_interesse, observacoes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [dados.nomeCliente, dados.telefoneCliente, dados.servico, dados.dataInteresse, dados.observacoes]
      );
      enviarJson(resposta, 201, { mensagem: "Voce entrou na lista de espera com sucesso.", id: Number(res.rows[0].id) });
    } catch (erro) {
      enviarJson(resposta, 500, { erro: "Erro interno ao salvar a lista de espera." });
    }
    return true;
  }

  // ── POST /api/bloqueios ────────────────────────────────────
  if (requisicao.method === "POST" && url.pathname === "/api/bloqueios") {
    let corpo;
    try { corpo = await lerCorpoJson(requisicao); }
    catch { enviarJson(resposta, 400, { erro: "Nao foi possivel ler os dados do bloqueio." }); return true; }

    const dados = validarBloqueioHorario(corpo);
    if (dados.erro) { enviarJson(resposta, 400, { erro: dados.erro }); return true; }

    const [resAg, resBloq] = await Promise.all([
      banco.query(`SELECT id, status FROM agendamentos WHERE data_agendamento = $1 AND horario_agendamento = $2`, [dados.dataAgendamento, dados.horarioAgendamento]),
      banco.query(`SELECT id FROM bloqueios_horario WHERE data_agendamento = $1 AND horario_agendamento = $2`, [dados.dataAgendamento, dados.horarioAgendamento]),
    ]);

    if (resAg.rows[0] && resAg.rows[0].status !== "cancelado") {
      enviarJson(resposta, 409, { erro: "Esse horario ja possui um agendamento ativo." });
      return true;
    }
    if (resBloq.rows[0]) {
      enviarJson(resposta, 409, { erro: "Esse horario ja esta bloqueado." });
      return true;
    }

    await banco.query(
      `INSERT INTO bloqueios_horario (data_agendamento, horario_agendamento, motivo) VALUES ($1, $2, $3)`,
      [dados.dataAgendamento, dados.horarioAgendamento, dados.motivo]
    );
    enviarJson(resposta, 201, { mensagem: "Horario bloqueado com sucesso." });
    return true;
  }

  // ── PATCH /api/bloqueios (liberar horário) ─────────────────
  if (requisicao.method === "PATCH" && url.pathname === "/api/bloqueios") {
    let corpo;
    try { corpo = await lerCorpoJson(requisicao); }
    catch { enviarJson(resposta, 400, { erro: "Nao foi possivel ler os dados para liberar o horario." }); return true; }

    const dados = validarBloqueioHorario(corpo);
    if (dados.erro) { enviarJson(resposta, 400, { erro: dados.erro }); return true; }

    const res = await banco.query(
      `SELECT id FROM bloqueios_horario WHERE data_agendamento = $1 AND horario_agendamento = $2`,
      [dados.dataAgendamento, dados.horarioAgendamento]
    );

    if (!res.rows[0]) {
      enviarJson(resposta, 404, { erro: "Nenhum bloqueio encontrado para esse horario." });
      return true;
    }

    await banco.query(
      `DELETE FROM bloqueios_horario WHERE data_agendamento = $1 AND horario_agendamento = $2`,
      [dados.dataAgendamento, dados.horarioAgendamento]
    );
    enviarJson(resposta, 200, { mensagem: "Horario liberado com sucesso." });
    return true;
  }

  // ── POST /api/bloqueios-dia ────────────────────────────────
  if (requisicao.method === "POST" && url.pathname === "/api/bloqueios-dia") {
    let corpo;
    try { corpo = await lerCorpoJson(requisicao); }
    catch { enviarJson(resposta, 400, { erro: "Nao foi possivel ler os dados para bloquear o dia." }); return true; }

    const dados = validarBloqueioDia(corpo);
    if (dados.erro) { enviarJson(resposta, 400, { erro: dados.erro }); return true; }

    let totalBloqueados = 0;
    let totalOcupados = 0;
    let totalJaBloqueados = 0;

    for (const horario of HORARIOS_PADRAO) {
      const [resAg, resBloq] = await Promise.all([
        banco.query(`SELECT id, status FROM agendamentos WHERE data_agendamento = $1 AND horario_agendamento = $2`, [dados.dataAgendamento, horario]),
        banco.query(`SELECT id FROM bloqueios_horario WHERE data_agendamento = $1 AND horario_agendamento = $2`, [dados.dataAgendamento, horario]),
      ]);

      if (resAg.rows[0] && resAg.rows[0].status !== "cancelado") { totalOcupados++; continue; }
      if (resBloq.rows[0]) { totalJaBloqueados++; continue; }

      await banco.query(
        `INSERT INTO bloqueios_horario (data_agendamento, horario_agendamento, motivo) VALUES ($1, $2, $3)`,
        [dados.dataAgendamento, horario, dados.motivo]
      );
      totalBloqueados++;
    }

    enviarJson(resposta, 200, {
      mensagem: `${totalBloqueados} horario(s) bloqueado(s). ${totalOcupados} ocupado(s) foram preservados.`,
    });
    return true;
  }

  // ── PATCH /api/bloqueios-dia (liberar dia) ─────────────────
  if (requisicao.method === "PATCH" && url.pathname === "/api/bloqueios-dia") {
    let corpo;
    try { corpo = await lerCorpoJson(requisicao); }
    catch { enviarJson(resposta, 400, { erro: "Nao foi possivel ler os dados para liberar o dia." }); return true; }

    const dados = validarBloqueioDia(corpo);
    if (dados.erro) { enviarJson(resposta, 400, { erro: dados.erro }); return true; }

    await banco.query(`DELETE FROM bloqueios_horario WHERE data_agendamento = $1`, [dados.dataAgendamento]);
    enviarJson(resposta, 200, { mensagem: "Todos os bloqueios desse dia foram liberados." });
    return true;
  }

  // ── PATCH /api/resetar-dia ─────────────────────────────────
  if (requisicao.method === "PATCH" && url.pathname === "/api/resetar-dia") {
    let corpo;
    try { corpo = await lerCorpoJson(requisicao); }
    catch { enviarJson(resposta, 400, { erro: "Nao foi possivel ler os dados para resetar o dia." }); return true; }

    const dataAgendamento = limparTexto(corpo.dataAgendamento);
    if (!validarData(dataAgendamento)) {
      enviarJson(resposta, 400, { erro: "Informe uma data valida para resetar o dia." });
      return true;
    }

    await banco.query(
      `UPDATE agendamentos SET status = 'cancelado', cancelado_em = TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS'), concluido_em = NULL WHERE data_agendamento = $1 AND status != 'cancelado'`,
      [dataAgendamento]
    );
    enviarJson(resposta, 200, { mensagem: "Todos os agendamentos desse dia foram cancelados." });
    return true;
  }

  return false;
}

// ================= SERVIDOR HTTP =================

const servidor = http.createServer(async (requisicao, resposta) => {
  if (requisicao.method === "OPTIONS") {
    resposta.writeHead(204, obterCabecalhosApi());
    resposta.end();
    return;
  }

  const url = new URL(requisicao.url, `http://${requisicao.headers.host}`);

  // /health fora do prefixo /api/ também funciona
  if (requisicao.method === "GET" && url.pathname === "/health") {
    enviarJson(resposta, 200, { ok: true, timestamp: new Date().toISOString() });
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    try {
      const rotaFoiTratada = await tratarRotasApi(requisicao, resposta, url);
      if (!rotaFoiTratada) {
        enviarJson(resposta, 404, { erro: "Rota nao encontrada." });
      }
    } catch (erro) {
      console.error("Erro nao tratado na rota:", erro.message);
      enviarJson(resposta, 500, { erro: "Erro interno do servidor." });
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

// Inicializa o banco e só então sobe o servidor
inicializarBanco()
  .then(() => {
    servidor.listen(PORTA, () => {
      console.log(`Servidor rodando em http://localhost:${PORTA}`);
    });
  })
  .catch((erro) => {
    console.error("Falha ao inicializar. Encerrando.", erro.message);
    process.exit(1);
  });