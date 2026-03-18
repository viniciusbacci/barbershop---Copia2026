const botaoAtualizarAdmin = document.getElementById("botao-atualizar-admin");
const totalAgendamentos = document.getElementById("total-agendamentos");
const totalHoje = document.getElementById("total-hoje");
const proximoHorario = document.getElementById("proximo-horario");
const totalConcluidosHoje = document.getElementById("total-concluidos-hoje");
const faturamentoPrevisto = document.getElementById("faturamento-previsto");
const ticketMedio = document.getElementById("ticket-medio");
const clientesUnicos = document.getElementById("clientes-unicos");
const taxaConclusao = document.getElementById("taxa-conclusao");
const mensagemAdmin = document.getElementById("mensagem-admin");
const mensagemBloqueioAdmin = document.getElementById(
  "mensagem-bloqueio-admin",
);
const listaAgendamentosAdmin = document.getElementById(
  "lista-agendamentos-admin",
);
const listaConcluidosAdmin = document.getElementById("lista-concluidos-admin");
const listaServicosAdmin = document.getElementById("lista-servicos-admin");
const listaListaEsperaAdmin = document.getElementById(
  "lista-lista-espera-admin",
);
const lucroTotalMes = document.getElementById("lucro-total-mes");
const clientesAtendidosMes = document.getElementById("clientes-atendidos-mes");
const ticketMedioMes = document.getElementById("ticket-medio-mes");
const servicoCampeaoMes = document.getElementById("servico-campeao-mes");
const filtroMesAdmin = document.getElementById("filtro-mes-admin");
const listaServicosMes = document.getElementById("lista-servicos-mes");
const listaIndicadoresMes = document.getElementById("lista-indicadores-mes");
const botaoResumoMensal = document.getElementById("botao-resumo-mensal");
const dataBloqueioAdmin = document.getElementById("data-bloqueio-admin");
const motivoBloqueioAdmin = document.getElementById("motivo-bloqueio-admin");
const botaoBloquearDiaAdmin = document.getElementById(
  "botao-bloquear-dia-admin",
);
const botaoLiberarDiaAdmin = document.getElementById("botao-liberar-dia-admin");
const botaoResetarDiaAdmin = document.getElementById("botao-resetar-dia-admin");
const gradeBloqueioAdmin = document.getElementById("grade-bloqueio-admin");
const filtroDataAdmin = document.getElementById("filtro-data-admin");
const filtroBuscaAdmin = document.getElementById("filtro-busca-admin");
const botaoLimparFiltros = document.getElementById("botao-limpar-filtros");

const alertaListaEsperaAdmin = document.getElementById(
  "alerta-lista-espera-admin",
);
const qtdListaEsperaAdmin = document.getElementById("qtd-lista-espera-admin");
const secaoListaEsperaAdmin = document.querySelector(
  ".secao-lista-espera-admin",
);

const CHAVE_ACESSO_ADMIN = "barbershopAdminAutorizado";
const SENHA_ADMIN = "admin";
const URL_BASE_API = obterUrlBaseApi();
const secoesColapsaveisAdmin = document.querySelectorAll(
  "[data-admin-section]",
);
const painelMensalColapsavel = document.getElementById(
  "painel-mensal-colapsavel",
);

let agendamentosCarregados = [];
let agendamentosAtivosFiltrados = [];
let concluidosHojeFiltrados = [];
let listaEsperaCarregada = [];
let bloqueiosDataAdmin = [];
let horariosDataAdmin = null;

function adminEmModoCompacto() {
  return window.matchMedia("(max-width: 1099px)").matches;
}

function abrirSecaoAdmin(secao) {
  if (!secao) {
    return;
  }

  if (adminEmModoCompacto()) {
    secoesColapsaveisAdmin.forEach((item) => {
      if (item !== secao) {
        item.open = false;
      }
    });
  }

  secao.open = true;
}

function obterUrlBaseApi() {
  return "https://barbershop-api-4g5z.onrender.com";
}

function obterUrlApi(caminho) {
  return `${URL_BASE_API}${caminho}`;
}

function obterUrlInicio() {
  if (URL_BASE_API) {
    return `${URL_BASE_API}/`;
  }

  return `${window.location.origin}/`;
}

function garantirAcessoAdmin() {
  const acesso = localStorage.getItem(CHAVE_ACESSO_ADMIN);

  // Já está autenticado
  if (acesso === SENHA_ADMIN) {
    return true;
  }

  // Pede senha apenas se não estiver logado
  const senhaInformada = window.prompt("Digite a senha do painel admin:");

  if (senhaInformada === SENHA_ADMIN) {
    localStorage.setItem(CHAVE_ACESSO_ADMIN, SENHA_ADMIN);
    return true;
  }

  window.alert("Acesso negado.");
  window.location.replace(obterUrlInicio());
  return false;
}

function escaparHtml(valor) {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatarData(valorData) {
  const [ano, mes, dia] = valorData.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarDiaSemana(valorData) {
  const data = new Date(`${valorData}T12:00:00`);
  const diaSemana = data.toLocaleDateString("pt-BR", { weekday: "long" });
  return diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
}

function obterDataHoje() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function obterMesAtual() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

function mostrarMensagemBloqueioAdmin(texto, tipo) {
  mensagemBloqueioAdmin.textContent = texto;
  mensagemBloqueioAdmin.className = `mensagem-status ${tipo}`;
}

function limparMensagemBloqueioAdmin() {
  mensagemBloqueioAdmin.textContent = "";
  mensagemBloqueioAdmin.className = "mensagem-status oculto";
}

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function ordenarAgendamentos(agendamentos) {
  return [...agendamentos].sort((a, b) => {
    if (a.dataAgendamento === b.dataAgendamento) {
      return a.horarioAgendamento.localeCompare(b.horarioAgendamento);
    }

    return a.dataAgendamento.localeCompare(b.dataAgendamento);
  });
}

function obterStatusAgendamento(agendamento) {
  if (agendamento.status === "cancelado") {
    return "Cancelado";
  }

  if (agendamento.status === "concluido") {
    return "Concluido";
  }

  const hoje = obterDataHoje();

  if (agendamento.dataAgendamento === hoje) {
    return "Hoje";
  }

  if (agendamento.dataAgendamento < hoje) {
    return "Passado";
  }

  return "Proximo";
}

function normalizarTelefoneWhatsapp(telefone) {
  const somenteDigitos = String(telefone || "").replace(/\D/g, "");

  if (!somenteDigitos) {
    return "";
  }

  if (somenteDigitos.startsWith("55")) {
    return somenteDigitos;
  }

  return `55${somenteDigitos}`;
}

function extrairValorMonetario(preco) {
  const texto = String(preco || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  return Number.parseFloat(texto) || 0;
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor || 0);
}

function filtrarAgendamentosDoMes(agendamentos) {
  const mesSelecionado = filtroMesAdmin.value || obterMesAtual();
  return agendamentos.filter((item) =>
    String(item.dataAgendamento || "").startsWith(`${mesSelecionado}-`),
  );
}

function renderizarDashboardMensal(agendamentos) {
  const agendamentosDoMes = filtrarAgendamentosDoMes(agendamentos);
  const concluidosDoMes = agendamentosDoMes.filter(
    (item) => item.status === "concluido",
  );
  const canceladosDoMes = agendamentosDoMes.filter(
    (item) => item.status === "cancelado",
  );
  const ativosDoMes = agendamentosDoMes.filter(
    (item) => item.status === "ativo",
  );
  const lucro = concluidosDoMes.reduce(
    (total, item) => total + extrairValorMonetario(item.preco),
    0,
  );
  const clientes = new Set(
    concluidosDoMes.map(
      (item) =>
        `${normalizarTexto(item.nomeCliente)}-${String(item.telefoneCliente || "").replace(/\D/g, "")}`,
    ),
  );
  const ticket = concluidosDoMes.length ? lucro / concluidosDoMes.length : 0;
  const servicos = Array.from(
    concluidosDoMes
      .reduce((mapa, agendamento) => {
        const itemAtual = mapa.get(agendamento.servico) || {
          nome: agendamento.servico,
          total: 0,
          valor: 0,
        };

        itemAtual.total += 1;
        itemAtual.valor += extrairValorMonetario(agendamento.preco);
        mapa.set(agendamento.servico, itemAtual);
        return mapa;
      }, new Map())
      .values(),
  ).sort((a, b) => {
    if (b.total === a.total) {
      return b.valor - a.valor;
    }

    return b.total - a.total;
  });
  const servicoCampeao = servicos[0]?.nome || "Nenhum";
  const maiorVolume = servicos[0]?.total || 1;
  const totalMes = agendamentosDoMes.length || 1;

  lucroTotalMes.textContent = formatarMoeda(lucro);
  clientesAtendidosMes.textContent = clientes.size;
  ticketMedioMes.textContent = formatarMoeda(ticket);
  servicoCampeaoMes.textContent = servicoCampeao;

  if (!agendamentosDoMes.length) {
    listaServicosMes.innerHTML = `
      <article class="mensagem-vazia">
        <strong>Nenhum dado neste mes.</strong>
        <p>Escolha outro mes ou aguarde novos atendimentos para montar o dashboard.</p>
      </article>
    `;
    listaIndicadoresMes.innerHTML = `
      <article class="mensagem-vazia">
        <strong>Sem indicadores no periodo.</strong>
        <p>Assim que houver movimentacao no mes selecionado, os destaques aparecem aqui.</p>
      </article>
    `;
    return;
  }

  listaServicosMes.innerHTML = servicos.length
    ? servicos
        .slice(0, 5)
        .map(
          (servico) => `
        <article class="item-insight-servico">
          <div class="item-insight-servico-topo">
            <strong>${escaparHtml(servico.nome)}</strong>
            <span>${escaparHtml(`${servico.total} concluidos`)}</span>
          </div>
          <div class="barra-insight-servico">
            <span style="width: ${(servico.total / maiorVolume) * 100}%"></span>
          </div>
          <p>${escaparHtml(formatarMoeda(servico.valor))} gerados no mes</p>
        </article>
      `,
        )
        .join("")
    : `
      <article class="mensagem-vazia">
        <strong>Nenhum servico concluido no mes.</strong>
        <p>O ranking aparece aqui assim que houver atendimentos concluidos.</p>
      </article>
    `;

  listaIndicadoresMes.innerHTML = `
    <article class="item-indicador-mensal">
      <div class="item-indicador-mensal-topo">
        <strong>Atendimentos concluidos</strong>
        <span>${escaparHtml(`${concluidosDoMes.length}`)}</span>
      </div>
      <div class="barra-insight-servico">
        <span style="width: ${(concluidosDoMes.length / totalMes) * 100}%"></span>
      </div>
      <p>${escaparHtml(`${Math.round((concluidosDoMes.length / totalMes) * 100)}% do movimento do mes`)}</p>
    </article>
    <article class="item-indicador-mensal">
      <div class="item-indicador-mensal-topo">
        <strong>Agendamentos ativos</strong>
        <span>${escaparHtml(`${ativosDoMes.length}`)}</span>
      </div>
      <div class="barra-insight-servico">
        <span style="width: ${(ativosDoMes.length / totalMes) * 100}%"></span>
      </div>
      <p>${escaparHtml(`${Math.round((ativosDoMes.length / totalMes) * 100)}% ainda na agenda`)}</p>
    </article>
    <article class="item-indicador-mensal">
      <div class="item-indicador-mensal-topo">
        <strong>Cancelamentos</strong>
        <span>${escaparHtml(`${canceladosDoMes.length}`)}</span>
      </div>
      <div class="barra-insight-servico">
        <span style="width: ${(canceladosDoMes.length / totalMes) * 100}%"></span>
      </div>
      <p>${escaparHtml(`${Math.round((canceladosDoMes.length / totalMes) * 100)}% cancelados no mes`)}</p>
    </article>
  `;
}

function criarMensagemWhatsapp(agendamento) {
  return encodeURIComponent(
    `Ola ${agendamento.nomeCliente}, seu horario na Barber shop Custom esta registrado para ${formatarData(
      agendamento.dataAgendamento,
    )} as ${agendamento.horarioAgendamento}.`,
  );
}

function obterUrlWhatsapp(agendamento) {
  const telefone = normalizarTelefoneWhatsapp(agendamento.telefoneCliente);

  if (!telefone) {
    return "";
  }

  return `https://wa.me/${telefone}?text=${criarMensagemWhatsapp(agendamento)}`;
}

function criarMensagemWhatsappListaEspera(item) {
  return encodeURIComponent(
    `Ola ${item.nomeCliente}, surgiu uma possibilidade de encaixe para ${item.servico} na data ${formatarData(
      item.dataInteresse,
    )}. Se quiser, me responde para confirmar.`,
  );
}

function obterUrlWhatsappListaEspera(item) {
  const telefone = normalizarTelefoneWhatsapp(item.telefoneCliente);

  if (!telefone) {
    return "";
  }

  return `https://wa.me/${telefone}?text=${criarMensagemWhatsappListaEspera(item)}`;
}

function atualizarResumo(agendamentos) {
  const hoje = obterDataHoje();
  const ativos = agendamentos.filter((item) => item.status === "ativo");
  const ativosHoje = ativos.filter((item) => item.dataAgendamento === hoje);
  const concluidosHoje = agendamentos.filter(
    (item) => item.status === "concluido" && item.dataAgendamento === hoje,
  );
  const naoCancelados = agendamentos.filter(
    (item) => item.status !== "cancelado",
  );
  const faturamento = ativos.reduce(
    (total, item) => total + extrairValorMonetario(item.preco),
    0,
  );
  const ticketMedioValor =
    naoCancelados.length > 0
      ? naoCancelados.reduce(
          (total, item) => total + extrairValorMonetario(item.preco),
          0,
        ) / naoCancelados.length
      : 0;
  const clientes = new Set(
    naoCancelados.map(
      (item) =>
        `${normalizarTexto(item.nomeCliente)}-${String(item.telefoneCliente || "").replace(/\D/g, "")}`,
    ),
  );
  const baseTaxa = agendamentos.filter(
    (item) => item.status === "ativo" || item.status === "concluido",
  ).length;
  const taxa = baseTaxa
    ? Math.round(
        (agendamentos.filter((item) => item.status === "concluido").length /
          baseTaxa) *
          100,
      )
    : 0;
  const proximo = ordenarAgendamentos(ativos).find(
    (item) => item.dataAgendamento >= hoje,
  );

  totalAgendamentos.textContent = agendamentos.length;
  totalHoje.textContent = ativosHoje.length;
  totalConcluidosHoje.textContent = concluidosHoje.length;
  faturamentoPrevisto.textContent = formatarMoeda(faturamento);
  ticketMedio.textContent = formatarMoeda(ticketMedioValor);
  clientesUnicos.textContent = clientes.size;
  taxaConclusao.textContent = `${taxa}%`;
  proximoHorario.innerHTML = proximo
    ? `<span>${formatarData(proximo.dataAgendamento)}</span><small>${proximo.horarioAgendamento}</small>`
    : "Nenhum";
}

function agruparAgendamentosPorData(agendamentos) {
  return ordenarAgendamentos(agendamentos).reduce((grupos, agendamento) => {
    const listaDoDia = grupos.get(agendamento.dataAgendamento) || [];
    listaDoDia.push(agendamento);
    grupos.set(agendamento.dataAgendamento, listaDoDia);
    return grupos;
  }, new Map());
}

function renderizarAcoesAgendamento(agendamento) {
  const urlWhatsapp = obterUrlWhatsapp(agendamento);

  if (agendamento.status === "concluido") {
    return `
      <div class="acoes-cartao-agendamento">
        <span class="acao-desabilitada">Atendimento concluido</span>
      </div>
    `;
  }

  return `
    <div class="acoes-cartao-agendamento acoes-cartao-agendamento-botoes">
      ${
        urlWhatsapp
          ? `<a class="botao-secundario" href="${escaparHtml(
              urlWhatsapp,
            )}" target="_blank" rel="noreferrer">Chamar no WhatsApp</a>`
          : `<span class="acao-desabilitada">Telefone indisponivel</span>`
      }
      <button class="botao-secundario botao-concluir" type="button" data-id="${Number(
        agendamento.id,
      )}">
        Concluido
      </button>
    </div>
  `;
}

function renderizarCartaoAgendamentoAtivo(agendamento) {
  return `
    <article class="cartao-agendamento cartao-agendamento-enxuto">
      <div class="topo-cartao-agendamento">
        <div class="linha-agendamento">
          <span>Horario</span>
          <strong class="valor-destaque">
            ${escaparHtml(agendamento.horarioAgendamento)}
            &nbsp; | &nbsp;
            ${escaparHtml(agendamento.nomeCliente)}
          </strong>
        </div>
      </div>

      ${renderizarAcoesAgendamento(agendamento)}
    </article>
  `;
}

function renderizarCartaoAgendamento(agendamento) {
  const statusAgendamento = obterStatusAgendamento(agendamento);

  return `
    <article class="cartao-agendamento">
      <div class="topo-cartao-agendamento">
        <div class="linha-agendamento">
          <span>Horario</span>
          <strong class="valor-destaque">${escaparHtml(
            agendamento.horarioAgendamento,
          )}</strong>
        </div>
        <span class="etiqueta-status etiqueta-status-${normalizarTexto(
          statusAgendamento,
        )}">${escaparHtml(statusAgendamento)}</span>
      </div>

      <div class="linha-agendamento">
        <span>Cliente</span>
        <strong>${escaparHtml(agendamento.nomeCliente)}</strong>
      </div>

      <div class="linha-agendamento">
        <span>Telefone</span>
        <strong>${escaparHtml(agendamento.telefoneCliente)}</strong>
      </div>

      <div class="linha-agendamento">
        <span>Servico</span>
        <strong>${escaparHtml(agendamento.servico)}</strong>
      </div>

      <div class="linha-agendamento">
        <span>Duracao</span>
        <strong>${escaparHtml(agendamento.duracao)}</strong>
      </div>

      <div class="linha-agendamento">
        <span>Preco</span>
        <strong>${escaparHtml(agendamento.preco)}</strong>
      </div>

      ${renderizarAcoesAgendamento(agendamento)}
    </article>
  `;
}

function renderizarListaAgrupada(
  elementoLista,
  agendamentos,
  mensagemVazia,
  renderizarCartao = renderizarCartaoAgendamento,
) {
  if (agendamentos.length === 0) {
    elementoLista.innerHTML = `
      <article class="mensagem-vazia">
        <strong>${escaparHtml(mensagemVazia.titulo)}</strong>
        <p>${escaparHtml(mensagemVazia.texto)}</p>
      </article>
    `;
    return;
  }

  const grupos = agruparAgendamentosPorData(agendamentos);

  elementoLista.innerHTML = Array.from(grupos.entries())
    .map(([dataAgendamento, agendamentosDoDia]) => {
      const descricaoQuantidade =
        agendamentosDoDia.length === 1
          ? "1 agendamento"
          : `${agendamentosDoDia.length} agendamentos`;

      return `
        <section class="grupo-agendamentos">
          <header class="cabecalho-grupo-agendamentos">
            <div>
              <p class="etiqueta-grupo-agendamentos">${escaparHtml(
                formatarDiaSemana(dataAgendamento),
              )}</p>
              <h3>${escaparHtml(formatarData(dataAgendamento))}</h3>
            </div>
            <strong>${escaparHtml(descricaoQuantidade)}</strong>
          </header>

          <div class="lista-cartoes-agendamento">
            ${agendamentosDoDia.map(renderizarCartao).join("")}
          </div>
        </section>
      `;
    })
    .join("");
}

function renderizarInsightsServicos(agendamentos) {
  const servicos = Array.from(
    agendamentos
      .filter((item) => item.status !== "cancelado")
      .reduce((mapa, agendamento) => {
        const itemAtual = mapa.get(agendamento.servico) || {
          nome: agendamento.servico,
          total: 0,
          faturamento: 0,
        };

        itemAtual.total += 1;
        itemAtual.faturamento += extrairValorMonetario(agendamento.preco);
        mapa.set(agendamento.servico, itemAtual);
        return mapa;
      }, new Map())
      .values(),
  ).sort((a, b) => {
    if (b.total === a.total) {
      return b.faturamento - a.faturamento;
    }

    return b.total - a.total;
  });

  if (!servicos.length) {
    listaServicosAdmin.innerHTML = `
      <article class="mensagem-vazia">
        <strong>Nenhum servico analisado ainda.</strong>
        <p>Assim que existirem agendamentos validos, os destaques comerciais aparecem aqui.</p>
      </article>
    `;
    return;
  }

  const maiorVolume = servicos[0].total || 1;

  listaServicosAdmin.innerHTML = servicos
    .slice(0, 5)
    .map(
      (servico) => `
    <article class="item-insight-servico">
      <div class="item-insight-servico-topo">
        <strong>${escaparHtml(servico.nome)}</strong>
        <span>${escaparHtml(`${servico.total} agendamento(s)`)}</span>
      </div>
      <div class="barra-insight-servico">
        <span style="width: ${(servico.total / maiorVolume) * 100}%"></span>
      </div>
      <p>${escaparHtml(formatarMoeda(servico.faturamento))} em valor acumulado</p>
    </article>
  `,
    )
    .join("");
}

function formatarStatusListaEspera(status) {
  if (status === "contatado") {
    return "Contatado";
  }

  if (status === "encerrado") {
    return "Encerrado";
  }

  return "Pendente";
}

function renderizarListaEsperaAdmin(listaEspera) {
  const pendentes = listaEspera.filter(
    (item) => item.status === "pendente",
  ).length;

  if (pendentes > 0 && alertaListaEsperaAdmin && qtdListaEsperaAdmin) {
    qtdListaEsperaAdmin.textContent = pendentes;
    alertaListaEsperaAdmin.classList.remove("oculto");
  } else if (alertaListaEsperaAdmin) {
    alertaListaEsperaAdmin.classList.add("oculto");
  }

  if (!listaEspera.length) {
    listaListaEsperaAdmin.innerHTML = `
      <article class="mensagem-vazia">
        <strong>Nenhum pedido de encaixe.</strong>
        <p>Quando um cliente entrar na lista de espera, ele aparece aqui para acompanhamento.</p>
      </article>
    `;
    return;
  }

  listaListaEsperaAdmin.innerHTML = listaEspera
    .map((item) => {
      const urlWhatsapp = obterUrlWhatsappListaEspera(item);
      const proximoStatus =
        item.status === "pendente" ? "contatado" : "encerrado";
      const textoBotao =
        item.status === "pendente" ? "Marcar contato" : "Encerrar";

      return `
      <article class="item-lista-espera-admin">
        <div class="item-lista-espera-admin-topo">
          <strong>${escaparHtml(item.nomeCliente)}</strong>
          <span class="etiqueta-status etiqueta-lista-espera-${normalizarTexto(item.status)}">${escaparHtml(formatarStatusListaEspera(item.status))}</span>
        </div>
        <p>${escaparHtml(item.servico)} para ${escaparHtml(formatarData(item.dataInteresse))}</p>
        <p>${escaparHtml(item.telefoneCliente)}</p>
        <p>${escaparHtml(item.observacoes || "Sem observacoes adicionais.")}</p>
        <div class="acoes-lista-espera-admin">
          ${
            urlWhatsapp
              ? `<a class="botao-secundario" href="${escaparHtml(urlWhatsapp)}" target="_blank" rel="noreferrer">Chamar no WhatsApp</a>`
              : `<span class="acao-desabilitada">Telefone indisponivel</span>`
          }
          ${
            item.status !== "encerrado"
              ? `<button class="botao-secundario botao-atualizar-lista-espera" type="button" data-id="${Number(item.id)}" data-status="${proximoStatus}">${textoBotao}</button>`
              : `<span class="acao-desabilitada">Fluxo encerrado</span>`
          }
        </div>
      </article>
    `;
    })
    .join("");
}

function renderizarPainelBloqueioAdmin() {
  if (!horariosDataAdmin || !Array.isArray(horariosDataAdmin.horariosPadrao)) {
    gradeBloqueioAdmin.innerHTML = `
      <article class="mensagem-vazia">
        <strong>Selecione uma data para gerenciar bloqueios.</strong>
        <p>Os horarios do dia aparecem aqui para bloqueio rapido.</p>
      </article>
    `;
    return;
  }

  if (horariosDataAdmin.diaFechado) {
    gradeBloqueioAdmin.innerHTML = `
      <article class="mensagem-vazia">
        <strong>Domingo ja e folga.</strong>
        <p>Escolha uma data de segunda a sabado para bloquear ou liberar horarios.</p>
      </article>
    `;
    return;
  }

  const bloqueiosPorHorario = new Map(
    bloqueiosDataAdmin.map((item) => [item.horarioAgendamento, item]),
  );

  gradeBloqueioAdmin.innerHTML = horariosDataAdmin.horariosPadrao
    .map((horario) => {
      const bloqueio = bloqueiosPorHorario.get(horario);
      const horarioOcupado = (
        horariosDataAdmin.horariosOcupados || []
      ).includes(horario);
      const horarioPassado = (
        horariosDataAdmin.horariosPassados || []
      ).includes(horario);
      const horarioBloqueado = Boolean(bloqueio);
      const acao = horarioBloqueado ? "liberar" : "bloquear";
      const textoAcao = horarioBloqueado ? "Liberar" : "Bloquear";
      const classeEstado =
        horarioOcupado || horarioPassado
          ? "botao-bloqueio-admin-ocupado"
          : horarioBloqueado
            ? "botao-bloqueio-admin-bloqueado"
            : "botao-bloqueio-admin-livre";
      const descricao = horarioPassado
        ? "Horario ja passou"
        : horarioOcupado
          ? "Ja ocupado"
          : horarioBloqueado
            ? bloqueio.motivo || "Bloqueado manualmente"
            : "Disponivel";

      return `
      <button
        type="button"
        class="botao-bloqueio-admin ${classeEstado}"
        data-horario="${horario}"
        data-acao="${acao}"
        ${horarioOcupado || horarioPassado ? "disabled" : ""}
        title="${escaparHtml(descricao)}"
      >
        <strong>${escaparHtml(horario)}</strong>
        <small>${escaparHtml(horarioPassado ? "Passou" : horarioOcupado ? "Ocupado" : textoAcao)}</small>
      </button>
    `;
    })
    .join("");
}

function atualizarMensagemFiltros() {
  const total = agendamentosCarregados.length;
  const ativos = agendamentosAtivosFiltrados.length;
  const concluidos = concluidosHojeFiltrados.length;
  const existeFiltroAtivo =
    filtroDataAdmin?.value || "" || (filtroBuscaAdmin?.value || "").trim();

  if (!total) {
    mensagemAdmin.textContent = "Nenhum agendamento salvo ate o momento.";
    mensagemAdmin.className = "mensagem-status informacao";
    return;
  }

  if (existeFiltroAtivo) {
    mensagemAdmin.textContent = `Exibindo ${ativos} ativo(s) e ${concluidos} concluido(s) do dia com os filtros aplicados.`;
    mensagemAdmin.className = "mensagem-status informacao";
    return;
  }

  mensagemAdmin.textContent = `${ativos} agendamento(s) ativo(s) na lista principal.`;
  mensagemAdmin.className = "mensagem-status sucesso";
}

function correspondeBusca(agendamento, buscaFiltro) {
  if (!buscaFiltro) {
    return true;
  }

  const conteudoBusca = normalizarTexto(
    [
      agendamento.nomeCliente,
      agendamento.telefoneCliente,
      agendamento.servico,
      agendamento.duracao,
      agendamento.preco,
      formatarData(agendamento.dataAgendamento),
      agendamento.horarioAgendamento,
      agendamento.status,
    ].join(" "),
  );

  return conteudoBusca.includes(buscaFiltro);
}

function aplicarFiltros() {
  const hoje = obterDataHoje();
  const dataFiltro = filtroDataAdmin?.value || "";
  const buscaFiltro = normalizarTexto(filtroBuscaAdmin?.value || "");

  agendamentosAtivosFiltrados = ordenarAgendamentos(
    agendamentosCarregados.filter((agendamento) => {
      const correspondeData =
        !dataFiltro || agendamento.dataAgendamento === dataFiltro;
      return (
        agendamento.status === "ativo" &&
        correspondeData &&
        correspondeBusca(agendamento, buscaFiltro)
      );
    }),
  );

  concluidosHojeFiltrados = ordenarAgendamentos(
    agendamentosCarregados.filter((agendamento) => {
      const correspondeData =
        !dataFiltro || agendamento.dataAgendamento === dataFiltro;

      return (
        agendamento.status === "concluido" &&
        agendamento.dataAgendamento === hoje &&
        correspondeData &&
        correspondeBusca(agendamento, buscaFiltro)
      );
    }),
  );

  renderizarListaAgrupada(
    listaAgendamentosAdmin,
    agendamentosAtivosFiltrados,
    {
      titulo: "Nenhum agendamento ativo encontrado.",
      texto:
        "Quando surgir um novo horario confirmado, ele aparece aqui pronto para o atendimento.",
    },
    renderizarCartaoAgendamentoAtivo,
  );

  renderizarListaAgrupada(listaConcluidosAdmin, concluidosHojeFiltrados, {
    titulo: "Nenhum atendimento concluido hoje.",
    texto:
      "Assim que o barbeiro marcar um atendimento como concluido, ele aparece aqui.",
  });

  atualizarMensagemFiltros();
}

function limparFiltros() {
  if (filtroDataAdmin) {
    filtroDataAdmin.value = "";
  }

  if (filtroBuscaAdmin) {
    filtroBuscaAdmin.value = "";
  }

  aplicarFiltros();
}

function converterParaCsv(agendamentos) {
  const cabecalho = [
    "Cliente",
    "Telefone",
    "Servico",
    "Duracao",
    "Preco",
    "Data",
    "Horario",
    "Status",
  ];

  const linhas = agendamentos.map((agendamento) => [
    agendamento.nomeCliente,
    agendamento.telefoneCliente,
    agendamento.servico,
    agendamento.duracao,
    agendamento.preco,
    formatarData(agendamento.dataAgendamento),
    agendamento.horarioAgendamento,
    agendamento.status,
  ]);

  return [cabecalho, ...linhas]
    .map((colunas) =>
      colunas
        .map((coluna) => `"${String(coluna).replaceAll('"', '""')}"`)
        .join(";"),
    )
    .join("\n");
}

function exportarCsv() {
  const listaParaExportar = [
    ...agendamentosAtivosFiltrados,
    ...concluidosHojeFiltrados,
  ];

  if (!listaParaExportar.length) {
    window.alert("Nao ha agendamentos para exportar.");
    return;
  }

  const csv = converterParaCsv(listaParaExportar);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dataArquivo = filtroDataAdmin.value || obterDataHoje();

  link.href = url;
  link.download = `agendamentos-${dataArquivo}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function carregarPainelBloqueioAdmin() {
  const dataSelecionada = dataBloqueioAdmin.value;

  if (!dataSelecionada) {
    horariosDataAdmin = null;
    bloqueiosDataAdmin = [];
    renderizarPainelBloqueioAdmin();
    return;
  }

  try {
    const [respostaHorarios, respostaBloqueios] = await Promise.all([
      fetch(
        obterUrlApi(
          `/api/horarios?data=${encodeURIComponent(dataSelecionada)}`,
        ),
      ),
      fetch(
        obterUrlApi(
          `/api/bloqueios?data=${encodeURIComponent(dataSelecionada)}`,
        ),
      ),
    ]);
    const tipoConteudoHorarios =
      respostaHorarios.headers.get("content-type") || "";
    const tipoConteudoBloqueios =
      respostaBloqueios.headers.get("content-type") || "";

    if (
      !tipoConteudoHorarios.includes("application/json") ||
      !tipoConteudoBloqueios.includes("application/json")
    ) {
      throw new Error(
        "A API nao respondeu JSON ao carregar o painel de bloqueio.",
      );
    }

    const dadosHorarios = await respostaHorarios.json();
    const dadosBloqueios = await respostaBloqueios.json();

    if (!respostaHorarios.ok) {
      throw new Error(
        dadosHorarios.erro || "Nao foi possivel carregar os horarios do dia.",
      );
    }

    if (!respostaBloqueios.ok) {
      throw new Error(
        dadosBloqueios.erro || "Nao foi possivel carregar os bloqueios do dia.",
      );
    }

    horariosDataAdmin = dadosHorarios;
    bloqueiosDataAdmin = dadosBloqueios.bloqueios || [];
    renderizarPainelBloqueioAdmin();
  } catch (erro) {
    mostrarMensagemBloqueioAdmin(erro.message, "erro");
  }
}

async function atualizarBloqueioHorarioAdmin(acao, horarioAgendamento) {
  const dataAgendamento = dataBloqueioAdmin.value;

  if (!dataAgendamento) {
    mostrarMensagemBloqueioAdmin(
      "Escolha uma data antes de bloquear horarios.",
      "erro",
    );
    return;
  }

  const rota = acao === "bloquear" ? "/api/bloqueios" : "/api/bloqueios";
  const metodo = acao === "bloquear" ? "POST" : "PATCH";

  try {
    const resposta = await fetch(obterUrlApi(rota), {
      method: metodo,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dataAgendamento,
        horarioAgendamento,
        motivo: motivoBloqueioAdmin.value.trim(),
      }),
    });
    const tipoConteudo = resposta.headers.get("content-type") || "";

    if (!tipoConteudo.includes("application/json")) {
      throw new Error("A API nao respondeu JSON ao atualizar o bloqueio.");
    }

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.erro || "Nao foi possivel atualizar o bloqueio.");
    }

    mostrarMensagemBloqueioAdmin(dados.mensagem, "sucesso");
    await carregarAgendamentos();
    await carregarPainelBloqueioAdmin();
  } catch (erro) {
    mostrarMensagemBloqueioAdmin(erro.message, "erro");
  }
}

async function bloquearDiaInteiroAdmin() {
  const dataAgendamento = dataBloqueioAdmin.value;

  if (!dataAgendamento) {
    mostrarMensagemBloqueioAdmin(
      "Escolha uma data antes de bloquear o dia.",
      "erro",
    );
    return;
  }

  try {
    const resposta = await fetch(obterUrlApi("/api/bloqueios-dia"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dataAgendamento,
        motivo: motivoBloqueioAdmin.value.trim(),
      }),
    });
    const tipoConteudo = resposta.headers.get("content-type") || "";

    if (!tipoConteudo.includes("application/json")) {
      throw new Error("A API nao respondeu JSON ao bloquear o dia.");
    }

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.erro || "Nao foi possivel bloquear o dia.");
    }

    mostrarMensagemBloqueioAdmin(dados.mensagem, "sucesso");
    await carregarAgendamentos();
    await carregarPainelBloqueioAdmin();
  } catch (erro) {
    mostrarMensagemBloqueioAdmin(erro.message, "erro");
  }
}

async function liberarBloqueiosDiaAdmin() {
  const dataAgendamento = dataBloqueioAdmin.value;

  if (!dataAgendamento) {
    mostrarMensagemBloqueioAdmin(
      "Escolha uma data antes de liberar bloqueios.",
      "erro",
    );
    return;
  }

  try {
    const resposta = await fetch(obterUrlApi("/api/bloqueios-dia"), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dataAgendamento }),
    });
    const tipoConteudo = resposta.headers.get("content-type") || "";

    if (!tipoConteudo.includes("application/json")) {
      throw new Error("A API nao respondeu JSON ao liberar o dia.");
    }

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        dados.erro || "Nao foi possivel liberar os bloqueios do dia.",
      );
    }

    mostrarMensagemBloqueioAdmin(dados.mensagem, "sucesso");
    await carregarAgendamentos();
    await carregarPainelBloqueioAdmin();
  } catch (erro) {
    mostrarMensagemBloqueioAdmin(erro.message, "erro");
  }
}

async function resetarAgendamentosDiaAdmin() {
  const dataAgendamento = dataBloqueioAdmin.value;

  if (!dataAgendamento) {
    mostrarMensagemBloqueioAdmin(
      "Escolha uma data antes de resetar o dia.",
      "erro",
    );
    return;
  }

  if (
    !window.confirm(
      `Tem certeza que deseja cancelar TODOS os agendamentos ativos do dia ${formatarData(dataAgendamento)}?`,
    )
  ) {
    return;
  }

  try {
    const resposta = await fetch(obterUrlApi("/api/resetar-dia"), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dataAgendamento }),
    });
    const tipoConteudo = resposta.headers.get("content-type") || "";

    if (!tipoConteudo.includes("application/json")) {
      throw new Error("A API nao respondeu JSON ao resetar o dia.");
    }

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        dados.erro || "Nao foi possivel resetar os agendamentos do dia.",
      );
    }

    mostrarMensagemBloqueioAdmin(dados.mensagem, "sucesso");
    await carregarAgendamentos();
    await carregarPainelBloqueioAdmin();
  } catch (erro) {
    mostrarMensagemBloqueioAdmin(erro.message, "erro");
  }
}

async function atualizarStatusListaEsperaAdmin(idListaEspera, status) {
  try {
    const resposta = await fetch(
      obterUrlApi(`/api/lista-espera/${idListaEspera}`),
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      },
    );
    const tipoConteudo = resposta.headers.get("content-type") || "";

    if (!tipoConteudo.includes("application/json")) {
      throw new Error(
        "A API nao respondeu JSON ao atualizar a lista de espera.",
      );
    }

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        dados.erro || "Nao foi possivel atualizar a lista de espera.",
      );
    }

    mensagemAdmin.textContent = dados.mensagem;
    mensagemAdmin.className = "mensagem-status sucesso";
    await carregarAgendamentos();
  } catch (erro) {
    mensagemAdmin.textContent = erro.message;
    mensagemAdmin.className = "mensagem-status erro";
  }
}

async function marcarAgendamentoConcluido(idAgendamento) {
  try {
    const resposta = await fetch(
      obterUrlApi(`/api/agendamentos/${idAgendamento}/concluir`),
      { method: "PATCH" },
    );
    const tipoConteudo = resposta.headers.get("content-type") || "";

    if (!tipoConteudo.includes("application/json")) {
      throw new Error("A API nao respondeu JSON ao concluir o agendamento.");
    }

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.erro || "Nao foi possivel concluir o agendamento.");
    }

    mensagemAdmin.textContent = dados.mensagem;
    mensagemAdmin.className = "mensagem-status sucesso";
    await carregarAgendamentos();
  } catch (erro) {
    mensagemAdmin.textContent = erro.message;
    mensagemAdmin.className = "mensagem-status erro";
  }
}

async function carregarAgendamentos() {
  mensagemAdmin.textContent = "Carregando dados do servidor...";
  mensagemAdmin.className = "mensagem-status informacao";

  try {
    const [respostaAgendamentos, respostaListaEspera] = await Promise.all([
      fetch(obterUrlApi("/api/agendamentos")),
      fetch(obterUrlApi("/api/lista-espera")),
    ]);
    const tipoConteudoAgendamentos =
      respostaAgendamentos.headers.get("content-type") || "";
    const tipoConteudoListaEspera =
      respostaListaEspera.headers.get("content-type") || "";

    if (
      !tipoConteudoAgendamentos.includes("application/json") ||
      !tipoConteudoListaEspera.includes("application/json")
    ) {
      throw new Error(
        "A API nao respondeu JSON. Verifique se o servidor Node esta rodando.",
      );
    }

    const dadosAgendamentos = await respostaAgendamentos.json();
    const dadosListaEspera = await respostaListaEspera.json();

    if (!respostaAgendamentos.ok) {
      throw new Error(
        dadosAgendamentos.erro || "Nao foi possivel carregar os agendamentos.",
      );
    }

    if (!respostaListaEspera.ok) {
      throw new Error(
        dadosListaEspera.erro || "Nao foi possivel carregar a lista de espera.",
      );
    }

    const lista = Array.isArray(dadosAgendamentos)
      ? dadosAgendamentos
      : dadosAgendamentos.agendamentos;

    agendamentosCarregados = ordenarAgendamentos(lista);
    listaEsperaCarregada = dadosListaEspera.listaEspera || [];
    atualizarResumo(agendamentosCarregados);
    renderizarDashboardMensal(agendamentosCarregados);
    aplicarFiltros();
    renderizarInsightsServicos(agendamentosCarregados);
    renderizarListaEsperaAdmin(listaEsperaCarregada);
    await carregarPainelBloqueioAdmin();
  } catch (erro) {
    mensagemAdmin.textContent = erro.message;
    mensagemAdmin.className = "mensagem-status erro";
    listaAgendamentosAdmin.innerHTML = "";
    listaConcluidosAdmin.innerHTML = "";
    listaServicosAdmin.innerHTML = "";
    listaListaEsperaAdmin.innerHTML = "";
    listaServicosMes.innerHTML = "";
    listaIndicadoresMes.innerHTML = "";
  }
}

botaoAtualizarAdmin.addEventListener("click", carregarAgendamentos);

if (filtroDataAdmin) {
  filtroDataAdmin.addEventListener("input", aplicarFiltros);
}

if (filtroBuscaAdmin) {
  filtroBuscaAdmin.addEventListener("input", aplicarFiltros);
}

if (botaoLimparFiltros) {
  botaoLimparFiltros.addEventListener("click", limparFiltros);
}

filtroMesAdmin.addEventListener("change", () => {
  renderizarDashboardMensal(agendamentosCarregados);
});

if (botaoResumoMensal) {
  botaoResumoMensal.addEventListener("click", () => {
    abrirSecaoAdmin(painelMensalColapsavel);
    painelMensalColapsavel.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}

if (alertaListaEsperaAdmin) {
  alertaListaEsperaAdmin.addEventListener("click", () => {
    abrirSecaoAdmin(secaoListaEsperaAdmin);
    secaoListaEsperaAdmin.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}
dataBloqueioAdmin.addEventListener("change", async () => {
  limparMensagemBloqueioAdmin();
  await carregarPainelBloqueioAdmin();
});
botaoBloquearDiaAdmin.addEventListener("click", bloquearDiaInteiroAdmin);
botaoLiberarDiaAdmin.addEventListener("click", liberarBloqueiosDiaAdmin);
botaoResetarDiaAdmin.addEventListener("click", resetarAgendamentosDiaAdmin);

listaAgendamentosAdmin.addEventListener("click", async (evento) => {
  const botaoConcluir = evento.target.closest(".botao-concluir");

  if (!botaoConcluir) {
    return;
  }

  botaoConcluir.disabled = true;
  botaoConcluir.textContent = "Concluindo...";

  await marcarAgendamentoConcluido(Number(botaoConcluir.dataset.id));
});

listaListaEsperaAdmin.addEventListener("click", async (evento) => {
  const botaoAtualizar = evento.target.closest(".botao-atualizar-lista-espera");

  if (!botaoAtualizar) {
    return;
  }

  botaoAtualizar.disabled = true;
  botaoAtualizar.textContent = "Atualizando...";

  await atualizarStatusListaEsperaAdmin(
    Number(botaoAtualizar.dataset.id),
    botaoAtualizar.dataset.status,
  );
});

gradeBloqueioAdmin.addEventListener("click", async (evento) => {
  const botaoBloqueio = evento.target.closest(".botao-bloqueio-admin");

  if (!botaoBloqueio || botaoBloqueio.disabled) {
    return;
  }

  botaoBloqueio.disabled = true;
  botaoBloqueio.textContent = "Atualizando...";

  await atualizarBloqueioHorarioAdmin(
    botaoBloqueio.dataset.acao,
    botaoBloqueio.dataset.horario,
  );
});

dataBloqueioAdmin.min = obterDataHoje();
dataBloqueioAdmin.value = obterDataHoje();
filtroMesAdmin.value = obterMesAtual();

secoesColapsaveisAdmin.forEach((secao) => {
  secao.addEventListener("toggle", () => {
    if (!secao.open || !adminEmModoCompacto()) {
      return;
    }

    secoesColapsaveisAdmin.forEach((outraSecao) => {
      if (outraSecao !== secao) {
        outraSecao.open = false;
      }
    });
  });
});

if (garantirAcessoAdmin()) {
  carregarAgendamentos();
}
