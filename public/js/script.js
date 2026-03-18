const cartoesServico = document.querySelectorAll(".cartao-servico");
const entradasServico = document.querySelectorAll('input[name="servico"]');
const botaoAbrirAgendamento = document.getElementById(
  "botao-abrir-agendamento",
);
const botaoEscolherData = document.getElementById("botao-escolher-data");
const secaoHorarios = document.getElementById("secao-horarios");
const secaoConfirmacao = document.getElementById("secao-confirmacao");
const campoNome = document.getElementById("nome-cliente");
const campoTelefone = document.getElementById("telefone-cliente");
const campoData = document.getElementById("data-agendamento");
const textoDataSelecionada = document.getElementById("texto-data-selecionada");
const textoAjudaDatas = document.getElementById("texto-ajuda-datas");
const gradeDatas = document.getElementById("grade-datas");
const gradeHorarios = document.getElementById("grade-horarios");
const textoAjudaHorarios = document.getElementById("texto-ajuda-horarios");
const secaoListaEspera = document.getElementById("secao-lista-espera");
const textoListaEsperaData = document.getElementById("texto-lista-espera-data");
const observacoesListaEspera = document.getElementById(
  "observacoes-lista-espera",
);
const botaoEntrarListaEspera = document.getElementById(
  "botao-entrar-lista-espera",
);
const mensagemListaEspera = document.getElementById("mensagem-lista-espera");
const resumoCliente = document.getElementById("resumo-cliente");
const resumoServico = document.getElementById("resumo-servico");
const resumoData = document.getElementById("resumo-data");
const resumoHorario = document.getElementById("resumo-horario");
const botaoConfirmar = document.getElementById("botao-confirmar");
const mensagemAgendamento = document.getElementById("mensagem-agendamento");
const painelSucessoAgendamento = document.getElementById(
  "painel-sucesso-agendamento",
);
const textoSucessoAgendamento = document.getElementById(
  "texto-sucesso-agendamento",
);
const linkWhatsappConfirmacao = document.getElementById(
  "link-whatsapp-confirmacao",
);
const botaoAdicionarCalendario = document.getElementById(
  "botao-adicionar-calendario",
);
const botaoNovoAgendamento = document.getElementById("botao-novo-agendamento");
const botaoPainelAdmin = document.getElementById("botao-painel-admin");
const botaoToggleAreaCliente = document.getElementById(
  "botao-toggle-area-cliente",
);
const nomeLoginCliente = document.getElementById("nome-login-cliente");
const telefoneLoginCliente = document.getElementById("telefone-login-cliente");
const botaoLoginCliente = document.getElementById("botao-login-cliente");
const botaoSairCliente = document.getElementById("botao-sair-cliente");
const mensagemLoginCliente = document.getElementById("mensagem-login-cliente");
const painelAgendamentosCliente = document.getElementById(
  "painel-agendamentos-cliente",
);
const listaAgendamentosCliente = document.getElementById(
  "lista-agendamentos-cliente",
);
const painelHistoricoCliente = document.getElementById(
  "painel-historico-cliente",
);
const listaHistoricoCliente = document.getElementById(
  "lista-historico-cliente",
);
const elementosModoSimplesOcultos = document.querySelectorAll(
  '[data-modo-simples="ocultar"]',
);
const elementosModoSimplesAlternaveis = document.querySelectorAll(
  '[data-modo-simples="alternar"]',
);

const HORARIOS_PADRAO = criarHorariosPadrao();
const URL_BASE_API = obterUrlBaseApi();
const MODO_SIMPLES = true;
const CHAVE_ACESSO_ADMIN = "barbershopAdminAutorizado";
const CHAVE_CLIENTE = "barbershopCliente";
const SENHA_ADMIN = "admin";

let servicoSelecionado = null;
let dataSelecionada = "";
let horarioSelecionado = "";
let datasComOcupacao = new Map();
let clienteLogado = null;
let ultimoResultadoHorarios = null;
let ultimoAgendamentoConfirmado = null;
let painelSucessoAtivo = false;

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

function obterUrlBaseApi() {
return "https://barbershop-api-4g5z.onrender.com";
}
  // Rodando local (VS Code, Live Server, etc)
  if (
    window.location.hostname.includes("localhost") ||
    window.location.protocol === "file:"
  ) {
    return "http://localhost:3333";
  }

  // Produção (Vercel, Render, etc)
  return API_URL_PRODUCAO;
}
function obterUrlApi(caminho) {
  return `${URL_BASE_API}${caminho}`;
}

function obterUrlPainelAdmin() {
  if (URL_BASE_API) {
    return `${URL_BASE_API}/admin`;
  }

  return `${window.location.origin}/admin`;
}

function obterDataHoje() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function obterBotoesHorario() {
  return gradeHorarios.querySelectorAll(".botao-horario");
}

function obterBotoesDataDisponiveis() {
  return gradeDatas.querySelectorAll(".botao-data:not(:disabled)");
}

function obterBotoesHorarioDisponiveis() {
  return gradeHorarios.querySelectorAll(".botao-horario:not(:disabled)");
}

function renderizarHorarios() {
  gradeHorarios.innerHTML = HORARIOS_PADRAO.map(
    (horario) => `
        <button type="button" class="botao-horario" data-horario="${horario}">${horario}</button>
    `,
  ).join("");
}

function somarDias(valorData, quantidadeDias) {
  const data = new Date(`${valorData}T12:00:00`);
  data.setDate(data.getDate() + quantidadeDias);

  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function formatarLegendaData(valorData) {
  const data = new Date(`${valorData}T12:00:00`);

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  })
    .format(data)
    .replace(".", "");
}

function formatarData(valorData) {
  if (!valorData) {
    return "-";
  }

  const [ano, mes, dia] = valorData.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarDataHoraAgendamento(valorData, horario) {
  return `${formatarData(valorData)} as ${horario}`;
}

function limparMensagem() {
  mensagemAgendamento.textContent = "";
  mensagemAgendamento.className = "mensagem-status oculto";
}

function mostrarMensagem(texto, tipo) {
  mensagemAgendamento.textContent = texto;
  mensagemAgendamento.className = `mensagem-status ${tipo}`;
}

function mostrarMensagemLogin(texto, tipo) {
  mensagemLoginCliente.textContent = texto;
  mensagemLoginCliente.className = `mensagem-status ${tipo}`;
}

function limparMensagemLogin() {
  mensagemLoginCliente.textContent = "";
  mensagemLoginCliente.className = "mensagem-status oculto";
}

function mostrarMensagemListaEspera(texto, tipo) {
  mensagemListaEspera.textContent = texto;
  mensagemListaEspera.className = `mensagem-status ${tipo}`;
}

function limparMensagemListaEspera() {
  mensagemListaEspera.textContent = "";
  mensagemListaEspera.className = "mensagem-status oculto";
}

function rolarParaElemento(elemento, elementoFoco = null) {
  if (!elemento) {
    return;
  }

  elemento.scrollIntoView({ behavior: "smooth", block: "start" });

  if (!elementoFoco) {
    return;
  }

  window.setTimeout(() => {
    elementoFoco.focus({ preventScroll: true });
  }, 240);
}

function obterNomeCliente() {
  return campoNome.value.trim();
}

function obterTelefoneCliente() {
  return campoTelefone.value.trim();
}

function obterCredenciaisInformadas() {
  return {
    nomeCliente: nomeLoginCliente.value.trim(),
    telefoneCliente: telefoneLoginCliente.value.trim(),
  };
}

function normalizarTelefone(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function normalizarTelefoneWhatsapp(valor) {
  const somenteDigitos = normalizarTelefone(valor);

  if (!somenteDigitos) {
    return "";
  }

  if (somenteDigitos.startsWith("55")) {
    return somenteDigitos;
  }

  return `55${somenteDigitos}`;
}

function atualizarResumo() {
  resumoCliente.textContent = obterNomeCliente() || "-";
  resumoServico.textContent = servicoSelecionado
    ? `${servicoSelecionado.nome} (${servicoSelecionado.duracao} - ${servicoSelecionado.preco})`
    : "-";
  resumoData.textContent = dataSelecionada
    ? formatarData(dataSelecionada)
    : "-";
  resumoHorario.textContent = horarioSelecionado || "-";

  const podeMostrarConfirmacao =
    servicoSelecionado &&
    obterNomeCliente() &&
    obterTelefoneCliente() &&
    dataSelecionada &&
    horarioSelecionado;

  secaoConfirmacao.classList.toggle(
    "oculto",
    !podeMostrarConfirmacao && !painelSucessoAtivo,
  );
}

function aplicarModoSimples() {
  if (!MODO_SIMPLES) {
    return;
  }

  document.body.classList.add("modo-simples");
  elementosModoSimplesOcultos.forEach((elemento) => {
    elemento.classList.add("oculto");
  });
  elementosModoSimplesAlternaveis.forEach((elemento) => {
    elemento.classList.add("oculto");
  });

  if (botaoToggleAreaCliente) {
    botaoToggleAreaCliente.classList.remove("oculto");
  }

  botaoAbrirAgendamento.classList.add("oculto");
}

async function alternarAreaClienteModoSimples() {
  if (!MODO_SIMPLES || !elementosModoSimplesAlternaveis.length) {
    return;
  }

  const areaCliente = elementosModoSimplesAlternaveis[0];
  const vaiAbrir = areaCliente.classList.contains("oculto");

  areaCliente.classList.toggle("oculto", !vaiAbrir);

  if (botaoToggleAreaCliente) {
    botaoToggleAreaCliente.textContent = vaiAbrir
      ? "Ocultar area do cliente"
      : "Ja agendou? Localizar ou cancelar horario";
  }

  if (vaiAbrir) {
    nomeLoginCliente.value = "";
    telefoneLoginCliente.value = "";
    botaoSairCliente.classList.add("oculto");
    painelAgendamentosCliente.classList.add("oculto");
    painelHistoricoCliente.classList.add("oculto");
    limparMensagemLogin();
    clienteLogado = null;

    rolarParaElemento(areaCliente, nomeLoginCliente);
  }
}

function definirDataMinima() {
  campoData.min = obterDataHoje();
}

function obterPeriodoSemanaRapida() {
  const hoje = obterDataHoje();
  const dataHoje = new Date(`${hoje}T12:00:00`);
  const diaSemana = dataHoje.getDay();

  if (diaSemana === 0) {
    return {
      inicio: somarDias(hoje, 1),
      totalDias: 6,
    };
  }

  return {
    inicio: hoje,
    totalDias: 7 - diaSemana,
  };
}

function atualizarTextoDataSelecionada() {
  if (!dataSelecionada) {
    textoDataSelecionada.textContent =
      "Semana atual visivel abaixo. Para outra data, use o botao Escolher data.";
    return;
  }

  textoDataSelecionada.textContent = `Data escolhida: ${formatarData(dataSelecionada)}. Para trocar por uma data distante, use o botao Escolher data.`;
}

function formatarStatusHistorico(agendamento) {
  if (agendamento.status === "cancelado") {
    return "Cancelado";
  }

  if (agendamento.status === "concluido") {
    return "Concluido";
  }

  const dataHoraAgendamento = `${agendamento.dataAgendamento}T${agendamento.horarioAgendamento}:00`;
  return new Date(dataHoraAgendamento) >= new Date()
    ? "Agendado"
    : "Finalizado";
}

function obterClasseStatusHistorico(agendamento) {
  return `tag-historico-status-${formatarStatusHistorico(agendamento)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()}`;
}

function obterDuracaoEmMinutos(textoDuracao) {
  const valor = String(textoDuracao || "")
    .toLowerCase()
    .trim();

  if (valor.endsWith("min")) {
    return Number.parseInt(valor, 10) || 30;
  }

  if (valor.endsWith("h")) {
    return (Number.parseInt(valor, 10) || 1) * 60;
  }

  return 30;
}

function formatarDataParaIcs(valorData, horario) {
  const [ano, mes, dia] = valorData.split("-");
  const [hora, minuto] = horario.split(":");
  return `${ano}${mes}${dia}T${hora}${minuto}00`;
}

function criarConteudoCalendario(agendamento) {
  const duracaoMinutos = obterDuracaoEmMinutos(agendamento.duracao);
  const inicio = new Date(
    `${agendamento.dataAgendamento}T${agendamento.horarioAgendamento}:00`,
  );
  const fim = new Date(inicio.getTime() + duracaoMinutos * 60 * 1000);
  const fimTexto = `${fim.getFullYear()}${String(fim.getMonth() + 1).padStart(2, "0")}${String(fim.getDate()).padStart(2, "0")}T${String(fim.getHours()).padStart(2, "0")}${String(fim.getMinutes()).padStart(2, "0")}00`;
  const inicioTexto = formatarDataParaIcs(
    agendamento.dataAgendamento,
    agendamento.horarioAgendamento,
  );

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Barber shop Custom//Agendamento//PT-BR",
    "BEGIN:VEVENT",
    `UID:barbershop-custom-${agendamento.dataAgendamento}-${agendamento.horarioAgendamento}-${normalizarTelefone(agendamento.telefoneCliente) || "cliente"}`,
    `DTSTAMP:${inicioTexto}`,
    `DTSTART:${inicioTexto}`,
    `DTEND:${fimTexto}`,
    `SUMMARY:${agendamento.servico} - Barber shop Custom`,
    `DESCRIPTION:Agendamento de ${agendamento.nomeCliente} para ${agendamento.servico}.`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function baixarArquivo(nomeArquivo, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function criarMensagemCompartilhamentoAgendamento(agendamento) {
  return encodeURIComponent(
    [
      "Agendamento confirmado ✅",
      `Servico: ${agendamento.servico}`,
      `Data: ${formatarData(agendamento.dataAgendamento)} as ${agendamento.horarioAgendamento}`,
      "",
      "Se precisar remarcar, e so responder aqui 👍",
    ].join("\n"),
  );
}

function obterUrlCompartilharWhatsapp(agendamento) {
  const telefone = normalizarTelefoneWhatsapp(agendamento.telefoneCliente);
  const mensagem = criarMensagemCompartilhamentoAgendamento(agendamento);

  if (telefone) {
    return `https://wa.me/${telefone}?text=${mensagem}`;
  }

  return `https://wa.me/?text=${mensagem}`;
}

function limparPainelSucesso() {
  painelSucessoAgendamento.classList.add("oculto");
  textoSucessoAgendamento.textContent = "Seu horario foi salvo com sucesso.";
  linkWhatsappConfirmacao.classList.add("oculto");
  linkWhatsappConfirmacao.href = "#";
}

function mostrarPainelSucesso(agendamento) {
  ultimoAgendamentoConfirmado = agendamento;
  painelSucessoAtivo = true;
  textoSucessoAgendamento.textContent = `Tudo certo. Seu horario para ${agendamento.servico} esta confirmado em ${formatarData(agendamento.dataAgendamento)} as ${agendamento.horarioAgendamento}, com confirmacao imediata pronta no WhatsApp.`;
  linkWhatsappConfirmacao.href = obterUrlCompartilharWhatsapp(agendamento);
  linkWhatsappConfirmacao.classList.remove("oculto");
  painelSucessoAgendamento.classList.remove("oculto");
  atualizarResumo();
  rolarParaElemento(painelSucessoAgendamento, linkWhatsappConfirmacao);
}

function ocultarListaEspera() {
  secaoListaEspera.classList.add("oculto");
  limparMensagemListaEspera();
}

function atualizarEstadoListaEspera() {
  const podeEntrarListaEspera =
    servicoSelecionado &&
    dataSelecionada &&
    ultimoResultadoHorarios &&
    !ultimoResultadoHorarios.diaFechado &&
    Array.isArray(ultimoResultadoHorarios.horariosDisponiveis) &&
    ultimoResultadoHorarios.horariosDisponiveis.length === 0;

  if (!podeEntrarListaEspera) {
    ocultarListaEspera();
    return;
  }

  textoListaEsperaData.textContent = `A data ${formatarData(dataSelecionada)} esta sem vagas para ${servicoSelecionado.nome}. Entre na lista de espera para ser avisado se surgir um encaixe.`;
  secaoListaEspera.classList.remove("oculto");
}

function renderizarDatas() {
  const { inicio, totalDias } = obterPeriodoSemanaRapida();
  const datas = [];

  for (let indice = 0; indice < totalDias; indice += 1) {
    const data = somarDias(inicio, indice);
    const ocupacao = datasComOcupacao.get(data);
    const dataFechada = new Date(`${data}T12:00:00`).getDay() === 0;
    const dataLotada = ocupacao?.lotada || false;
    const quantidadeOcupada = ocupacao?.totalAgendamentos || 0;
    const classes = ["botao-data"];

    if (dataSelecionada === data) {
      classes.push("ativo");
    }

    if (dataFechada) {
      classes.push("indisponivel");
    }

    if (quantidadeOcupada > 0 || dataLotada) {
      classes.push("parcial");
    }

    datas.push(`
            <button
                type="button"
                class="${classes.join(" ")}"
                data-data="${data}"
                ${dataFechada ? "disabled" : ""}
            >
                <strong>${formatarLegendaData(data)}</strong>
                <span>${dataFechada ? "Folga" : dataLotada ? "Lotado" : quantidadeOcupada > 0 ? `${quantidadeOcupada} agend.` : "Livre"}</span>
            </button>
        `);
  }

  gradeDatas.innerHTML = datas.join("");
  atualizarTextoDataSelecionada();
}

async function carregarDatasOcupadas() {
  textoAjudaDatas.textContent = "Atualizando dias da semana...";

  try {
    const periodo = obterPeriodoSemanaRapida();
    const resposta = await fetch(
      obterUrlApi(
        `/api/datas-ocupadas?inicio=${encodeURIComponent(periodo.inicio)}&dias=${periodo.totalDias}`,
      ),
    );
    const tipoConteudo = resposta.headers.get("content-type") || "";

    if (!tipoConteudo.includes("application/json")) {
      throw new Error(
        "A API nao respondeu em JSON. Rode o Node em http://127.0.0.1:3000.",
      );
    }

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        dados.erro || "Nao foi possivel consultar as datas ocupadas.",
      );
    }

    datasComOcupacao = new Map(
      (dados.datas || []).map((item) => [item.data, item]),
    );
    renderizarDatas();
    textoAjudaDatas.textContent =
      "A selecao rapida mostra apenas a semana atual. Para outras datas, use o calendario.";
  } catch (erro) {
    datasComOcupacao = new Map();
    renderizarDatas();
    textoAjudaDatas.textContent = erro.message;
  }
}

function prepararHorariosSemData() {
  horarioSelecionado = "";
  ultimoResultadoHorarios = null;

  obterBotoesHorario().forEach((botao) => {
    botao.disabled = true;
    botao.classList.remove("ativo");
    botao.classList.add("indisponivel");
  });

  textoAjudaHorarios.textContent =
    "Escolha uma data para consultar os horarios.";
  ocultarListaEspera();
  atualizarResumo();
}

function selecionarServico(entrada) {
  cartoesServico.forEach((cartao) => {
    cartao.classList.remove("esta-selecionado");
  });

  entrada.checked = true;
  entrada.closest(".cartao-servico").classList.add("esta-selecionado");

  servicoSelecionado = {
    nome: entrada.value,
    duracao: entrada.dataset.duracao,
    preco: entrada.dataset.preco,
  };

  atualizarEstadoListaEspera();
  atualizarResumo();

  if (MODO_SIMPLES) {
    mostrarSecaoHorarios(true);
    return;
  }

  botaoAbrirAgendamento.classList.remove("oculto");
}

function mostrarSecaoHorarios(focarProximaEtapa = false) {
  if (!servicoSelecionado) {
    return;
  }

  secaoHorarios.classList.remove("oculto");

  if (!focarProximaEtapa) {
    secaoHorarios.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const primeiroBotaoData = obterBotoesDataDisponiveis()[0];
  rolarParaElemento(secaoHorarios, primeiroBotaoData || botaoEscolherData);
}

function selecionarHorario(botao) {
  if (botao.disabled) {
    return;
  }

  const nome = obterNomeCliente();
  const telefone = normalizarTelefone(obterTelefoneCliente());

  if (nome.length < 3 || telefone.length < 8) {
    window.alert(
      "Por favor, preencha o seu nome e telefone antes de escolher o horário.",
    );
    rolarParaElemento(
      campoNome.closest(".grade-campos") || campoNome,
      campoNome,
    );
    return;
  }

  obterBotoesHorario().forEach((botaoHorario) => {
    botaoHorario.classList.remove("ativo");
  });

  botao.classList.add("ativo");
  horarioSelecionado = botao.dataset.horario;
  atualizarResumo();

  if (MODO_SIMPLES) {
    tentarGuiarConfirmacaoModoSimples();
  }
}

async function carregarHorariosDaData(data) {
  textoAjudaHorarios.textContent = "Consultando horarios no servidor...";
  horarioSelecionado = "";
  limparMensagemListaEspera();

  obterBotoesHorario().forEach((botao) => {
    botao.disabled = true;
    botao.classList.remove("ativo");
  });

  try {
    const resposta = await fetch(
      obterUrlApi(`/api/horarios?data=${encodeURIComponent(data)}`),
    );
    const tipoConteudo = resposta.headers.get("content-type") || "";

    if (!tipoConteudo.includes("application/json")) {
      throw new Error(
        "A API nao respondeu em JSON. Rode o Node em http://127.0.0.1:3000.",
      );
    }

    const dados = await resposta.json();
    ultimoResultadoHorarios = dados;

    if (!resposta.ok) {
      throw new Error(dados.erro || "Nao foi possivel consultar os horarios.");
    }

    if (dados.diaFechado) {
      prepararHorariosSemData();
      textoAjudaHorarios.textContent =
        "Domingo e folga. Escolha um dia de segunda a sabado.";
      return;
    }

    obterBotoesHorario().forEach((botao) => {
      const horario = botao.dataset.horario;
      const horarioIndisponivel = (
        dados.horariosIndisponiveis ||
        dados.horariosOcupados ||
        []
      ).includes(horario);

      botao.disabled = horarioIndisponivel;
      botao.classList.toggle("indisponivel", horarioIndisponivel);
      botao.classList.remove("ativo");
    });

    if (dados.horariosDisponiveis.length === 0) {
      textoAjudaHorarios.textContent = "Nao ha horarios livres nesta data.";
    } else if ((dados.horariosBloqueados || []).length > 0) {
      textoAjudaHorarios.textContent =
        "Alguns horarios foram bloqueados pela barbearia. Escolha uma opcao livre.";
    } else if (
      (dados.horariosPassados || []).length > 0 &&
      data === campoData.min
    ) {
      textoAjudaHorarios.textContent =
        "Horarios que ja passaram hoje foram riscados. Escolha um horario futuro.";
    } else {
      textoAjudaHorarios.textContent =
        "Horarios livres carregados. Escolha um horario e finalize em segundos.";
    }

    atualizarEstadoListaEspera();

    if (MODO_SIMPLES) {
      const primeiroHorarioDisponivel = obterBotoesHorarioDisponiveis()[0];

      if (primeiroHorarioDisponivel) {
        rolarParaElemento(gradeHorarios, primeiroHorarioDisponivel);
      }
    }
  } catch (erro) {
    prepararHorariosSemData();
    textoAjudaHorarios.textContent = erro.message;
  }

  atualizarResumo();
}

async function selecionarData(valorData) {
  dataSelecionada = valorData;
  campoData.value = valorData;
  limparMensagem();
  renderizarDatas();

  if (!dataSelecionada) {
    prepararHorariosSemData();
    return;
  }

  await carregarHorariosDaData(dataSelecionada);
}

function abrirCalendarioCompleto() {
  if (typeof campoData.showPicker === "function") {
    campoData.showPicker();
    return;
  }

  campoData.focus();
  campoData.click();
}

function tentarGuiarConfirmacaoModoSimples() {
  if (!MODO_SIMPLES) {
    return;
  }

  if (
    !servicoSelecionado ||
    !dataSelecionada ||
    !horarioSelecionado ||
    obterNomeCliente().length < 3 ||
    normalizarTelefone(obterTelefoneCliente()).length < 8
  ) {
    return;
  }

  rolarParaElemento(secaoConfirmacao, botaoConfirmar);
}

function abrirPainelAdmin() {
  const senhaInformada = window.prompt("Digite a senha do painel admin:");

  if (senhaInformada === null) {
    return;
  }

  if (senhaInformada !== SENHA_ADMIN) {
    window.alert("Senha incorreta.");
    return;
  }

  window.localStorage.setItem(CHAVE_ACESSO_ADMIN, SENHA_ADMIN);
  window.open(obterUrlPainelAdmin(), "_blank", "noopener");
}

function salvarCredenciaisClienteLocalmente(cliente) {
  window.localStorage.setItem(CHAVE_CLIENTE, JSON.stringify(cliente));
}

function restaurarCredenciaisCliente() {
  try {
    const clienteSalvo = JSON.parse(
      window.localStorage.getItem(CHAVE_CLIENTE) || "null",
    );

    if (!clienteSalvo?.nomeCliente || !clienteSalvo?.telefoneCliente) {
      return null;
    }

    return clienteSalvo;
  } catch (erro) {
    return null;
  }
}

function aplicarCredenciaisCliente(cliente) {
  clienteLogado = cliente;
  nomeLoginCliente.value = cliente.nomeCliente;
  telefoneLoginCliente.value = cliente.telefoneCliente;
  botaoSairCliente.classList.remove("oculto");

  campoNome.value = cliente.nomeCliente;
  campoTelefone.value = cliente.telefoneCliente;
  atualizarResumo();
}

function limparAcessoCliente() {
  clienteLogado = null;
  nomeLoginCliente.value = "";
  telefoneLoginCliente.value = "";
  campoNome.value = "";
  campoTelefone.value = "";
  botaoSairCliente.classList.add("oculto");
  painelAgendamentosCliente.classList.add("oculto");
  painelHistoricoCliente.classList.add("oculto");
  listaAgendamentosCliente.innerHTML = "";
  listaHistoricoCliente.innerHTML = "";
  limparMensagemLogin();
  window.localStorage.removeItem(CHAVE_CLIENTE);
  atualizarResumo();
}

function renderizarListaAgendamentosCliente(agendamentos) {
  if (!agendamentos.length) {
    painelAgendamentosCliente.classList.remove("oculto");
    listaAgendamentosCliente.innerHTML = `
            <article class="item-agendamento-cliente item-agendamento-cliente-vazio">
                <strong>Nenhum horario futuro encontrado.</strong>
                <p>Se voce acabou de agendar, atualize em alguns segundos ou confira nome e telefone informados.</p>
            </article>
        `;
    return;
  }

  painelAgendamentosCliente.classList.remove("oculto");
  listaAgendamentosCliente.innerHTML = agendamentos
    .map(
      (agendamento) => `
        <article class="item-agendamento-cliente">
            <div class="item-agendamento-cliente-topo">
                <strong>${agendamento.servico}</strong>
                <span>${agendamento.horarioAgendamento}</span>
            </div>
            <p>${formatarDataHoraAgendamento(agendamento.dataAgendamento, agendamento.horarioAgendamento)}</p>
            <button class="botao-secundario botao-cancelar-cliente" type="button" data-id="${Number(agendamento.id)}">
                Cancelar meu agendamento
            </button>
        </article>
    `,
    )
    .join("");
}

function renderizarHistoricoCliente(historico) {
  painelHistoricoCliente.classList.remove("oculto");

  if (!historico.length) {
    listaHistoricoCliente.innerHTML = `
            <article class="item-agendamento-cliente item-agendamento-cliente-vazio">
                <strong>Nenhum historico encontrado.</strong>
                <p>Assim que houver atendimento salvo para este cliente, ele aparecera aqui.</p>
            </article>
        `;
    return;
  }

  listaHistoricoCliente.innerHTML = historico
    .map(
      (agendamento) => `
        <article class="item-agendamento-cliente">
            <div class="item-agendamento-cliente-topo">
                <strong>${agendamento.servico}</strong>
                <span class="tag-historico-status ${obterClasseStatusHistorico(agendamento)}">${formatarStatusHistorico(agendamento)}</span>
            </div>
            <p>${formatarDataHoraAgendamento(agendamento.dataAgendamento, agendamento.horarioAgendamento)}</p>
            <button class="botao-secundario botao-reagendar-cliente" type="button" data-servico="${agendamento.servico}">
                Agendar este servico novamente
            </button>
        </article>
    `,
    )
    .join("");
}

async function carregarAgendamentosCliente() {
  if (!clienteLogado) {
    return;
  }

  mostrarMensagemLogin("Localizando seus agendamentos...", "informacao");

  try {
    const parametros = new URLSearchParams(clienteLogado);
    const resposta = await fetch(
      obterUrlApi(`/api/meus-agendamentos?${parametros.toString()}`),
    );
    const tipoConteudo = resposta.headers.get("content-type") || "";

    if (!tipoConteudo.includes("application/json")) {
      throw new Error(
        "A API nao respondeu em JSON. Rode o Node em http://127.0.0.1:3000.",
      );
    }

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        dados.erro || "Nao foi possivel localizar seus agendamentos.",
      );
    }

    renderizarListaAgendamentosCliente(dados.agendamentos || []);
    mostrarMensagemLogin(
      "Acesso liberado. Voce pode cancelar seu proprio agendamento por aqui.",
      "sucesso",
    );
  } catch (erro) {
    painelAgendamentosCliente.classList.add("oculto");
    listaAgendamentosCliente.innerHTML = "";
    mostrarMensagemLogin(erro.message, "erro");
  }
}

async function carregarHistoricoCliente() {
  if (!clienteLogado) {
    return;
  }

  try {
    const parametros = new URLSearchParams(clienteLogado);
    const resposta = await fetch(
      obterUrlApi(`/api/historico-cliente?${parametros.toString()}`),
    );
    const tipoConteudo = resposta.headers.get("content-type") || "";

    if (!tipoConteudo.includes("application/json")) {
      throw new Error(
        "A API nao respondeu em JSON. Rode o Node em http://127.0.0.1:3000.",
      );
    }

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        dados.erro || "Nao foi possivel localizar seu historico.",
      );
    }

    renderizarHistoricoCliente(dados.historico || []);
  } catch (erro) {
    painelHistoricoCliente.classList.add("oculto");
    listaHistoricoCliente.innerHTML = "";
  }
}

async function carregarAreaCliente() {
  await carregarAgendamentosCliente();
  await carregarHistoricoCliente();
}

async function entrarCliente() {
  const credenciais = obterCredenciaisInformadas();

  if (
    credenciais.nomeCliente.length < 3 ||
    normalizarTelefone(credenciais.telefoneCliente).length < 8
  ) {
    mostrarMensagemLogin(
      "Informe nome e telefone validos para localizar seus agendamentos.",
      "erro",
    );
    return;
  }

  aplicarCredenciaisCliente(credenciais);
  salvarCredenciaisClienteLocalmente(credenciais);
  await carregarAreaCliente();
}

async function cancelarAgendamentoCliente(idAgendamento, botao) {
  if (!clienteLogado) {
    return;
  }

  botao.disabled = true;
  botao.textContent = "Cancelando...";

  try {
    const resposta = await fetch(
      obterUrlApi(`/api/agendamentos/${idAgendamento}/cancelar`),
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(clienteLogado),
      },
    );
    const tipoConteudo = resposta.headers.get("content-type") || "";

    if (!tipoConteudo.includes("application/json")) {
      throw new Error("A API nao respondeu em JSON ao cancelar o agendamento.");
    }

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.erro || "Nao foi possivel cancelar o agendamento.");
    }

    mostrarMensagemLogin(dados.mensagem, "sucesso");
    await carregarDatasOcupadas();

    if (dataSelecionada) {
      await carregarHorariosDaData(dataSelecionada);
    }

    await carregarAreaCliente();
  } catch (erro) {
    mostrarMensagemLogin(erro.message, "erro");
  } finally {
    botao.disabled = false;
    botao.textContent = "Cancelar meu agendamento";
  }
}

async function salvarListaEspera() {
  if (!servicoSelecionado || !dataSelecionada) {
    mostrarMensagemListaEspera(
      "Escolha um servico e uma data antes de entrar na lista de espera.",
      "erro",
    );
    return;
  }

  const nomeCliente = obterNomeCliente();
  const telefoneCliente = obterTelefoneCliente();

  if (
    nomeCliente.length < 3 ||
    normalizarTelefone(telefoneCliente).length < 8
  ) {
    mostrarMensagemListaEspera(
      "Preencha nome e telefone validos para entrar na lista de espera.",
      "erro",
    );
    return;
  }

  botaoEntrarListaEspera.disabled = true;
  botaoEntrarListaEspera.textContent = "Salvando...";

  try {
    const resposta = await fetch(obterUrlApi("/api/lista-espera"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nomeCliente,
        telefoneCliente,
        servico: servicoSelecionado.nome,
        dataInteresse: dataSelecionada,
        observacoes: observacoesListaEspera.value.trim(),
      }),
    });
    const tipoConteudo = resposta.headers.get("content-type") || "";

    if (!tipoConteudo.includes("application/json")) {
      throw new Error(
        "A API nao respondeu em JSON. Rode o Node em http://127.0.0.1:3000.",
      );
    }

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        dados.erro || "Nao foi possivel entrar na lista de espera.",
      );
    }

    mostrarMensagemListaEspera(dados.mensagem, "sucesso");
    observacoesListaEspera.value = "";
  } catch (erro) {
    mostrarMensagemListaEspera(erro.message, "erro");
  } finally {
    botaoEntrarListaEspera.disabled = false;
    botaoEntrarListaEspera.textContent = "Entrar na lista de espera";
  }
}

function selecionarServicoPorNome(nomeServico) {
  const entrada = Array.from(entradasServico).find(
    (item) => item.value === nomeServico,
  );

  if (!entrada) {
    return false;
  }

  selecionarServico(entrada);
  return true;
}

function prepararReagendamento(nomeServico) {
  if (!selecionarServicoPorNome(nomeServico)) {
    return;
  }

  dataSelecionada = "";
  horarioSelecionado = "";
  campoData.value = "";
  painelSucessoAtivo = false;
  limparPainelSucesso();
  renderizarDatas();
  prepararHorariosSemData();
  mostrarSecaoHorarios(MODO_SIMPLES);
  atualizarResumo();
}

async function salvarAgendamento() {
  if (!servicoSelecionado || !dataSelecionada || !horarioSelecionado) {
    return;
  }

  const nomeCliente = obterNomeCliente();
  const telefoneCliente = obterTelefoneCliente();

  if (!nomeCliente || !telefoneCliente) {
    mostrarMensagem("Preencha nome e telefone para continuar.", "erro");
    return;
  }

  limparMensagem();
  botaoConfirmar.disabled = true;
  botaoConfirmar.textContent = "Salvando...";

  try {
    const agendamentoParaSalvar = {
      nomeCliente,
      telefoneCliente,
      servico: servicoSelecionado.nome,
      duracao: servicoSelecionado.duracao,
      preco: servicoSelecionado.preco,
      dataAgendamento: dataSelecionada,
      horarioAgendamento: horarioSelecionado,
    };

    const resposta = await fetch(obterUrlApi("/api/agendamentos"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(agendamentoParaSalvar),
    });

    const tipoConteudo = resposta.headers.get("content-type") || "";

    if (!tipoConteudo.includes("application/json")) {
      throw new Error(
        "A API nao respondeu em JSON. Rode o Node em http://127.0.0.1:3000.",
      );
    }

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.erro || "Nao foi possivel salvar o agendamento.");
    }

    aplicarCredenciaisCliente({ nomeCliente, telefoneCliente });
    salvarCredenciaisClienteLocalmente({ nomeCliente, telefoneCliente });

    if (!MODO_SIMPLES) {
      await carregarAreaCliente();
    }
    await carregarDatasOcupadas();

    const agendamentoConfirmado = {
      ...agendamentoParaSalvar,
      lembreteEm: dados.lembreteEm || "",
    };

    mostrarMensagem(dados.mensagem, "sucesso");
    mostrarPainelSucesso(agendamentoConfirmado);
    resetarFormulario(true);
  } catch (erro) {
    mostrarMensagem(erro.message, "erro");

    await carregarDatasOcupadas();

    if (dataSelecionada) {
      await carregarHorariosDaData(dataSelecionada);
    }
  } finally {
    botaoConfirmar.disabled = false;
    botaoConfirmar.textContent = "Confirmar agendamento";
  }
}

function resetarFormulario(preservarPainelSucesso = false) {
  entradasServico.forEach((entrada) => {
    entrada.checked = false;
  });

  cartoesServico.forEach((cartao) => {
    cartao.classList.remove("esta-selecionado");
  });

  servicoSelecionado = null;
  dataSelecionada = "";
  horarioSelecionado = "";
  campoData.value = "";

  campoNome.value = clienteLogado?.nomeCliente || "";
  campoTelefone.value = clienteLogado?.telefoneCliente || "";

  botaoAbrirAgendamento.classList.add("oculto");
  secaoHorarios.classList.add("oculto");

  if (!preservarPainelSucesso) {
    painelSucessoAtivo = false;
    limparPainelSucesso();
    secaoConfirmacao.classList.add("oculto");
  }

  prepararHorariosSemData();
  renderizarDatas();
  atualizarResumo();
}

entradasServico.forEach((entrada) => {
  entrada.addEventListener("change", () => {
    selecionarServico(entrada);
  });
});

botaoAbrirAgendamento.addEventListener("click", () =>
  mostrarSecaoHorarios(true),
);
botaoEscolherData.addEventListener("click", abrirCalendarioCompleto);
campoNome.addEventListener("input", () => {
  atualizarResumo();
  tentarGuiarConfirmacaoModoSimples();
});
campoTelefone.addEventListener("input", () => {
  atualizarResumo();
  tentarGuiarConfirmacaoModoSimples();
});

campoData.addEventListener("change", async (evento) => {
  await selecionarData(evento.target.value);
});

gradeDatas.addEventListener("click", async (evento) => {
  const botao = evento.target.closest(".botao-data");

  if (!botao || botao.disabled) {
    return;
  }

  await selecionarData(botao.dataset.data);
});

gradeHorarios.addEventListener("click", (evento) => {
  const botao = evento.target.closest(".botao-horario");

  if (!botao) {
    return;
  }

  selecionarHorario(botao);
});

botaoConfirmar.addEventListener("click", salvarAgendamento);
botaoLoginCliente.addEventListener("click", entrarCliente);
botaoSairCliente.addEventListener("click", limparAcessoCliente);
botaoEntrarListaEspera.addEventListener("click", salvarListaEspera);
botaoAdicionarCalendario.addEventListener("click", () => {
  if (!ultimoAgendamentoConfirmado) {
    return;
  }

  const conteudo = criarConteudoCalendario(ultimoAgendamentoConfirmado);
  baixarArquivo(
    "agendamento-barber-shop-custom.ics",
    conteudo,
    "text/calendar;charset=utf-8;",
  );
});
botaoNovoAgendamento.addEventListener("click", () => {
  resetarFormulario();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

listaAgendamentosCliente.addEventListener("click", async (evento) => {
  const botao = evento.target.closest(".botao-cancelar-cliente");

  if (!botao) {
    return;
  }

  await cancelarAgendamentoCliente(Number(botao.dataset.id), botao);
});

listaHistoricoCliente.addEventListener("click", (evento) => {
  const botao = evento.target.closest(".botao-reagendar-cliente");

  if (!botao) {
    return;
  }

  prepararReagendamento(botao.dataset.servico);
});

if (botaoPainelAdmin) {
  botaoPainelAdmin.addEventListener("click", abrirPainelAdmin);
}

if (botaoToggleAreaCliente) {
  botaoToggleAreaCliente.addEventListener(
    "click",
    alternarAreaClienteModoSimples,
  );
}

renderizarHorarios();
definirDataMinima();
prepararHorariosSemData();
renderizarDatas();
aplicarModoSimples();
carregarDatasOcupadas();

const clienteSalvo = restaurarCredenciaisCliente();

if (clienteSalvo) {
  aplicarCredenciaisCliente(clienteSalvo);

  if (!MODO_SIMPLES) {
    carregarAreaCliente();
  }
}
