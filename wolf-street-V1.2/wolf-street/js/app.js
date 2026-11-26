/* Lógica da loja. Para mudar produtos e preços, edite js/produtos.js */
(() => {
  "use strict";

  const CHAVE = "wolfstreet:carrinho:v1";
  const { $, $$, esc, brl, centavos, sb, comLimite } = WS;

  // "local" = js/produtos.js; "banco" = tabela produtos do Supabase
  let catalogo = PRODUTOS;
  let fonte = "local";

  // Valores calculados em centavos para evitar erro de arredondamento
  const comPix = (c) => c - Math.round((c * LOJA.descontoPix) / 100);

  const produto = (id) => catalogo.find((p) => p.id === id);
  const estoqueDe = (id, tam) => produto(id)?.estoque[tam] || 0;
  const esgotado = (p) => Object.values(p.estoque).every((q) => q <= 0);

  /* ---------- Vitrine ---------- */
  let categoria = "Todos";

  function precoHTML(p) {
    const preco = centavos(p.preco);
    const antigo = p.precoOriginal ? `<s>${brl(centavos(p.precoOriginal))}</s>` : "";
    const pix = LOJA.descontoPix > 0 ? `<span class="preco-pix">${brl(comPix(preco))}<small>NO PIX</small></span>` : "";
    return `<span class="preco">${antigo}<span>${brl(preco)}</span></span>${pix}`;
  }

  function desenharVitrine() {
    const ordem = $("#ordenar").value;
    const lista = catalogo.filter((p) => categoria === "Todos" || p.categoria === categoria);
    if (ordem === "menor") lista.sort((a, b) => a.preco - b.preco);
    if (ordem === "maior") lista.sort((a, b) => b.preco - a.preco);
    if (ordem === "nome") lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    // Esgotados sempre no final
    lista.sort((a, b) => esgotado(a) - esgotado(b));

    $("#grid").innerHTML = lista.map((p) => {
      const tag = esgotado(p) ? "ESGOTADO" : p.tag;
      return `
      <button type="button" class="card ${esgotado(p) ? "esgotado" : ""}" data-id="${esc(p.id)}">
        <span class="foto">
          ${tag ? `<span class="tag">${esc(tag)}</span>` : ""}
          <img src="${esc(p.imagens[0])}" alt="${esc(p.nome)}" loading="lazy">
          ${p.imagens[1] ? `<img src="${esc(p.imagens[1])}" alt="" loading="lazy">` : ""}
        </span>
        <h3>${esc(p.nome)}</h3>
        ${precoHTML(p)}
        <span class="tamanhos-mini">${Object.entries(p.estoque).map(([t, q]) => `<span class="${q > 0 ? "" : "zero"}">${esc(t)}</span>`).join("")}</span>
      </button>`;
    }).join("") || `<p class="vazio">Nenhuma peça nessa categoria por enquanto.</p>`;
  }

  function tabelaMedidas(p) {
    return `<table><thead><tr><th>Tamanho</th><th>Altura (cm)</th><th>Largura (cm)</th></tr></thead><tbody>${
      Object.entries(p.medidas || {}).map(([t, m]) => `<tr><td>${esc(t)}</td><td>${esc(m.altura)}</td><td>${esc(m.largura)}</td></tr>`).join("")
    }</tbody></table>`;
  }

  /* ---------- Modal de produto ---------- */
  const modal = $("#modal");
  let atual = null;
  let tamanho = null;

  const noCarrinho = (id, tam) => carrinho.find((i) => i.id === id && i.tam === tam)?.qtd || 0;

  /* ---------- Histórico: link por produto e botão voltar ---------- */
  // Mantém os outros parâmetros da URL (o Instagram costuma adicionar os seus)
  function urlCom(id) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("produto", id);
    else url.searchParams.delete("produto");
    return url.href;
  }

  // "tela" é "produto" ou "carrinho". substituir evita empilhar entradas
  function registrar(tela, id, substituir = false) {
    history[substituir ? "replaceState" : "pushState"]({ tela, id }, "", urlCom(id));
  }

  // Deixa a tela igual à entrada atual do histórico
  function sincronizar() {
    const { tela, id } = history.state || {};
    if (modal.open && (tela !== "produto" || atual.id !== id)) modal.close();
    if (drawer.open && tela !== "carrinho") drawer.close();
    if (conta.open && tela !== "conta") conta.close();
    if (tela === "conta" && !conta.open) conta.showModal();
    if (tela === "produto" && !modal.open) mostrarProduto(id);
    if (tela === "carrinho" && !drawer.open) drawer.showModal();
  }

  function abrirProduto(id) {
    if (!produto(id)) return;
    registrar("produto", id);
    mostrarProduto(id);
  }

  function abrirCarrinho() {
    registrar("carrinho");
    drawer.showModal();
  }

  function abrirPeloLink() {
    const id = new URL(window.location.href).searchParams.get("produto");
    // Página recarregada com algo aberto: o histórico já está pronto
    if (history.state?.tela) return sincronizar();
    if (!id) return;
    // Cria a entrada da loja por baixo, para o "voltar" fechar o produto
    history.replaceState(null, "", urlCom(null));
    abrirProduto(id);
  }

  function mostrarProduto(id) {
    atual = produto(id);
    if (!atual) return;
    const disponiveis = Object.keys(atual.estoque).filter((t) => atual.estoque[t] > 0);
    // Pré-seleciona somente peça de tamanho único
    tamanho = Object.keys(atual.estoque).length === 1 && disponiveis.length ? disponiveis[0] : null;

    $("#modalCorpo").innerHTML = `
      <div class="galeria">
        <img class="principal" id="mFoto" src="${esc(atual.imagens[0])}" alt="${esc(atual.nome)}">
        <div class="miniaturas">${atual.imagens.map((src, i) => `
          <button type="button" data-foto="${i}" aria-pressed="${i === 0}" aria-label="Foto ${i + 1}"><img src="${esc(src)}" alt=""></button>`).join("")}
        </div>
      </div>
      <div class="info">
        <h2 id="mNome">${esc(atual.nome)}</h2>
        ${precoHTML(atual)}
        <p class="rotulo">Tamanho</p>
        <div class="tamanhos">${Object.entries(atual.estoque).map(([t, q]) => `
          <button type="button" data-tam="${esc(t)}" aria-pressed="${t === tamanho}" ${q > 0 ? "" : `disabled aria-label="${esc(t)} esgotado"`}>${esc(t)}</button>`).join("")}
        </div>
        <p class="status" id="mStatus" aria-live="polite"></p>
        <button type="button" class="btn btn-cheio" id="mAdicionar"></button>
        <div class="abas" role="tablist">
          <button type="button" role="tab" data-aba="desc" aria-selected="true">Descrição</button>
          <button type="button" role="tab" data-aba="med" aria-selected="false">Tabela de medidas</button>
        </div>
        <p class="descricao" data-painel="desc">${esc(atual.descricao)}</p>
        <div data-painel="med" hidden>${tabelaMedidas(atual)}</div>
        <button type="button" class="btn-linha" id="mCopiar">Copiar link da peça</button>
        <p class="status" id="mLink" aria-live="polite"></p>
      </div>`;
    atualizarBotao();
    modal.showModal();
    modal.scrollTop = 0;
  }

  function atualizarBotao() {
    const btn = $("#mAdicionar");
    const status = $("#mStatus");
    const restante = tamanho ? estoqueDe(atual.id, tamanho) - noCarrinho(atual.id, tamanho) : null;
    btn.disabled = esgotado(atual) || restante === 0;
    btn.textContent = esgotado(atual) ? "Esgotado" : "Adicionar ao carrinho";
    status.textContent = !tamanho ? ""
      : restante <= 0 ? "Todas as unidades desse tamanho já estão no seu carrinho."
      : restante <= 2 ? `Restam ${restante} neste tamanho.` : "";
  }

  modal.addEventListener("click", (e) => {
    const alvo = e.target.closest("button");
    if (!alvo) return;
    if (alvo.dataset.foto) {
      $("#mFoto").src = atual.imagens[alvo.dataset.foto];
      $$("[data-foto]", modal).forEach((b) => b.setAttribute("aria-pressed", b === alvo));
    } else if (alvo.dataset.tam) {
      tamanho = alvo.dataset.tam;
      $$("[data-tam]", modal).forEach((b) => b.setAttribute("aria-pressed", b === alvo));
      atualizarBotao();
    } else if (alvo.dataset.aba) {
      $$("[data-aba]", modal).forEach((b) => b.setAttribute("aria-selected", b === alvo));
      $$("[data-painel]", modal).forEach((p) => (p.hidden = p.dataset.painel !== alvo.dataset.aba));
    } else if (alvo.id === "mCopiar") {
      const link = urlCom(atual.id);
      copiar(link).then((ok) => ($("#mLink").textContent = ok ? "Link copiado." : link));
    } else if (alvo.id === "mAdicionar") {
      if (!tamanho) {
        $("#mStatus").textContent = "Escolha um tamanho.";
        $(".tamanhos", modal).scrollIntoView({ block: "center" });
        return;
      }
      alterar(atual.id, tamanho, +1);
      modal.close();
      // Troca o produto pelo carrinho no histórico: um "voltar" fecha tudo
      registrar("carrinho", null, true);
      drawer.showModal();
    }
  });

  // Alguns navegadores internos não liberam a área de transferência
  async function copiar(texto) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      return false;
    }
  }

  /* ---------- Carrinho ---------- */
  const drawer = $("#drawer");
  const conta = $("#conta");
  const form = $("#checkout");

  // Descarta itens removidos da loja e limita à quantidade em estoque
  function carregar() {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE)) || [];
      return salvo
        .map((i) => ({ id: i.id, tam: i.tam, qtd: Math.min(Math.floor(i.qtd) || 0, estoqueDe(i.id, i.tam)) }))
        .filter((i) => i.qtd > 0);
    } catch {
      return [];
    }
  }
  let carrinho = [];
  let pronto = false; // o carrinho só é lido depois que o catálogo chega

  function salvar() {
    if (!pronto) return;
    try { localStorage.setItem(CHAVE, JSON.stringify(carrinho)); } catch { /* navegação privada */ }
  }

  function alterar(id, tam, delta) {
    let item = carrinho.find((i) => i.id === id && i.tam === tam);
    if (!item) carrinho.push((item = { id, tam, qtd: 0 }));
    item.qtd = Math.max(0, Math.min(item.qtd + delta, estoqueDe(id, tam)));
    carrinho = carrinho.filter((i) => i.qtd > 0);
    salvar();
    desenharCarrinho();
  }

  function calcular() {
    const entrega = form.elements.entrega.value;
    const pagamento = form.elements.pagamento.value;
    const subtotal = carrinho.reduce((s, i) => s + centavos(produto(i.id).preco) * i.qtd, 0);
    const desconto = pagamento === "pix" ? subtotal - comPix(subtotal) : 0;
    const minimo = centavos(LOJA.freteGratisAcimaDe);
    const freteGratis = minimo > 0 && subtotal >= minimo;
    const taxa = entrega === "entrega" && !freteGratis ? centavos(LOJA.taxaEntrega) : 0;
    return { entrega, pagamento, subtotal, desconto, minimo, freteGratis, taxa, total: subtotal - desconto + taxa };
  }

  function desenharCarrinho() {
    $("#alternativa").hidden = true;
    $("#contador").textContent = carrinho.reduce((s, i) => s + i.qtd, 0);
    form.hidden = !carrinho.length;

    $("#itens").innerHTML = carrinho.map((i) => {
      const p = produto(i.id);
      const dados = `data-id="${esc(i.id)}" data-tam-item="${esc(i.tam)}"`;
      return `
      <div class="item">
        <img src="${esc(p.imagens[0])}" alt="">
        <div>
          <h3>${esc(p.nome)}</h3>
          <p>Tamanho ${esc(i.tam)} • ${brl(centavos(p.preco) * i.qtd)}</p>
          <div class="qtd">
            <button type="button" ${dados} data-delta="-1" aria-label="Diminuir quantidade">−</button>
            <span>${i.qtd}</span>
            <button type="button" ${dados} data-delta="1" aria-label="Aumentar quantidade" ${i.qtd >= estoqueDe(i.id, i.tam) ? "disabled" : ""}>+</button>
            <button type="button" class="remover" ${dados} data-delta="-999">Remover</button>
          </div>
        </div>
      </div>`;
    }).join("") || `<div class="carrinho-vazio"><p>Seu carrinho está vazio.</p><button type="button" class="btn" data-ver-drop>Ver o drop</button></div>`;

    atualizarTotais();
  }

  function atualizarTotais() {
    const c = calcular();
    const precisaEndereco = c.entrega === "entrega";
    $("#campoEndereco").hidden = !precisaEndereco;

    $("#avisoFrete").textContent = !c.minimo || !precisaEndereco ? ""
      : c.freteGratis ? "Você ganhou entrega grátis."
      : `Faltam ${brl(c.minimo - c.subtotal)} para entrega grátis.`;

    $("#totais").innerHTML = `
      <dt>Subtotal</dt><dd>${brl(c.subtotal)}</dd>
      ${c.desconto ? `<dt>Desconto Pix (${LOJA.descontoPix}%)</dt><dd>− ${brl(c.desconto)}</dd>` : ""}
      <dt>Entrega</dt><dd>${c.taxa ? brl(c.taxa) : "Grátis"}</dd>
      <dt class="total">Total</dt><dd class="total">${brl(c.total)}</dd>`;
  }

  // Grava o pedido no banco. O mesmo carrinho não é gravado duas vezes seguidas
  let ultimo = null;
  async function registrarPedido(nome, endereco) {
    if (!sb || fonte !== "banco") return null;
    const { entrega, pagamento } = calcular();
    const dados = {
      p_nome: nome, p_bairro: endereco, p_entrega: entrega, p_pagamento: pagamento,
      p_itens: carrinho.map(({ id, tam, qtd }) => ({ id, tam, qtd })),
    };
    const assinatura = JSON.stringify(dados);
    if (ultimo?.assinatura === assinatura) return ultimo.id;
    try {
      // Limite curto: o banco nunca deve segurar a venda
      const { data, error } = await comLimite(sb.rpc("criar_pedido", dados), 5000);
      if (error) {
        if (/Estoque insuficiente|Produto indisponível/.test(error.message)) throw new RangeError(error.message);
        console.warn("Pedido não registrado:", error.message);
        return null;
      }
      ultimo = { assinatura, id: data.id };
      return data.id;
    } catch (erro) {
      if (erro instanceof RangeError) throw erro;
      console.warn("Pedido não registrado:", erro);
      return null;
    }
  }

  function montarMensagem(nome, endereco, codigo) {
    const c = calcular();
    const itens = carrinho.map((i) => {
      const p = produto(i.id);
      return `• ${i.qtd}x ${p.nome} (Tam. ${i.tam}) - ${brl(centavos(p.preco) * i.qtd)}`;
    });
    return [
      `*NOVO PEDIDO - ${LOJA.nome}*`,
      codigo ? `*Código:* ${codigo.slice(0, 8).toUpperCase()}` : null,
      "",
      `*Cliente:* ${nome}`,
      "",
      "*Itens:*",
      ...itens,
      "",
      `*Subtotal:* ${brl(c.subtotal)}`,
      c.desconto ? `*Desconto Pix:* -${brl(c.desconto)}` : null,
      `*Entrega:* ${c.entrega === "entrega" ? `Na cidade (${c.taxa ? brl(c.taxa) : "grátis"})` : "Retirada em mãos"}`,
      c.entrega === "entrega" ? `*Endereço:* ${endereco}` : null,
      `*Pagamento:* ${c.pagamento === "pix" ? "Pix" : "Cartão"}`,
      "",
      `*TOTAL: ${brl(c.total)}*`,
    ].filter((linha) => linha !== null).join("\n");
  }

  drawer.addEventListener("click", (e) => {
    const alvo = e.target.closest("button");
    if (!alvo) return;
    if (alvo.dataset.delta) {
      const { id, tamItem, delta } = alvo.dataset;
      alterar(id, tamItem, Number(delta));
      // A lista é redesenhada: devolve o foco para o mesmo controle
      const mesmo = $$("[data-delta]", drawer).find((b) => b.dataset.id === id && b.dataset.tamItem === tamItem && b.dataset.delta === delta);
      (mesmo && !mesmo.disabled ? mesmo : $(".fechar", drawer)).focus();
    } else if ("verDrop" in alvo.dataset) {
      // Rola só depois do "voltar", que restaura a posição anterior
      window.addEventListener("popstate", () => setTimeout(() => $("#drop").scrollIntoView()), { once: true });
      drawer.close();
    }
  });

  form.addEventListener("change", () => {
    $("#alternativa").hidden = true;
    atualizarTotais();
  });
  form.addEventListener("input", (e) => {
    e.target.removeAttribute("aria-invalid");
    $("#alternativa").hidden = true;
    $("#erro").textContent = "";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!carrinho.length) return;
    const { nome, endereco } = form.elements;
    const obrigatorios = form.elements.entrega.value === "entrega" ? [nome, endereco] : [nome];
    const faltando = obrigatorios.filter((campo) => !campo.value.trim());
    if (faltando.length) {
      faltando.forEach((campo) => campo.setAttribute("aria-invalid", "true"));
      $("#erro").textContent = "Preencha os campos destacados para continuar.";
      faltando[0].focus();
      return;
    }
    if (/^550+$/.test(LOJA.whatsapp)) {
      $("#erro").textContent = "Configure o número do WhatsApp em js/produtos.js.";
      console.info(montarMensagem(nome.value.trim(), endereco.value.trim()));
      return;
    }
    const botao = $("button[type=submit]", form);
    botao.disabled = true;
    botao.textContent = "Enviando...";
    let codigo = null;
    try {
      codigo = await registrarPedido(nome.value.trim(), endereco.value.trim());
    } catch (erro) {
      // Estoque mudou: atualiza o carrinho antes de seguir
      await carregarCatalogo();
      carrinho = carregar();
      salvar();
      desenharCatalogo();
      desenharCarrinho();
      $("#erro").textContent = `${erro.message}. Revise o carrinho.`;
      return;
    } finally {
      botao.disabled = false;
      botao.textContent = "Finalizar pedido no WhatsApp";
    }
    const mensagem = montarMensagem(nome.value.trim(), endereco.value.trim(), codigo);
    const url = `https://wa.me/${LOJA.whatsapp}?text=${encodeURIComponent(mensagem)}`;

    // Plano B visível caso o navegador interno segure o redirecionamento
    $("#linkPedido").href = url;
    $("#textoPedido").value = mensagem;
    $("#textoPedido").hidden = true;
    $("#alternativa").hidden = false;

    // Mesma aba: navegação comum, não é tratada como pop-up
    window.dispatchEvent(new Event("pedido-criado"));
    window.location.assign(url);
  });

  $("#copiarPedido").addEventListener("click", async (e) => {
    const botao = e.currentTarget;
    const texto = $("#textoPedido");
    if (await copiar(texto.value)) {
      botao.textContent = "Pedido copiado";
    } else {
      texto.hidden = false;
      texto.select();
      botao.textContent = "Selecione e copie o texto";
    }
  });

  /* ---------- Inicialização ---------- */
  function desenharCatalogo() {
    const categorias = ["Todos", ...new Set([...CATEGORIAS, ...catalogo.map((p) => p.categoria)])];
    if (!categorias.includes(categoria)) categoria = "Todos";
    $("#filtros").innerHTML = categorias
      .map((c) => `<button type="button" aria-pressed="${c === categoria}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
    $("#guiaMedidas").innerHTML = catalogo
      .map((p) => `<details><summary>${esc(p.nome)}</summary>${tabelaMedidas(p)}</details>`).join("");
    desenharVitrine();
  }

  // Busca produtos e configurações. Qualquer falha mantém os dados locais
  async function carregarCatalogo() {
    if (!sb) return;
    try {
      const [produtos, loja] = await comLimite(Promise.all([
        sb.from("produtos").select("*").eq("ativo", true).order("created_at", { ascending: false }),
        sb.from("loja").select("*").maybeSingle(),
      ]), 6000);
      if (produtos.error || !produtos.data.length) return;
      catalogo = produtos.data.map(WS.doBanco);
      fonte = "banco";
      if (loja.data) {
        LOJA.taxaEntrega = Number(loja.data.taxa_entrega);
        LOJA.freteGratisAcimaDe = Number(loja.data.frete_gratis_acima);
        LOJA.descontoPix = Number(loja.data.desconto_pix);
      }
    } catch (erro) {
      console.warn("Supabase indisponível, usando js/produtos.js", erro);
    }
  }

  $("#filtros").addEventListener("click", (e) => {
    const alvo = e.target.closest("button");
    if (!alvo) return;
    categoria = alvo.dataset.cat;
    $$("#filtros button").forEach((b) => b.setAttribute("aria-pressed", b === alvo));
    desenharVitrine();
  });
  $("#ordenar").addEventListener("change", desenharVitrine);
  $("#grid").addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (card) abrirProduto(card.dataset.id);
  });


  $("#abrirCarrinho").addEventListener("click", abrirCarrinho);
  $("#abrirConta").addEventListener("click", () => {
    registrar("conta");
    conta.showModal();
  });
  [modal, drawer, conta].forEach((d) => d.addEventListener("click", (e) => {
    // Fecha pelo X ou tocando fora
    if (e.target === d || e.target.closest("[data-fechar]")) d.close();
  }));

  // Fechou pelo X, tocando fora ou com Esc: remove a entrada do histórico
  [[modal, "produto"], [drawer, "carrinho"], [conta, "conta"]].forEach(([d, tela]) => d.addEventListener("close", () => {
    if (!d.open && history.state?.tela === tela) history.back();
  }));
  window.addEventListener("popstate", sincronizar);

  // Mantém o carrinho igual entre abas
  window.addEventListener("storage", (e) => {
    if (e.key === CHAVE && pronto) { carrinho = carregar(); desenharCarrinho(); }
  });

  $("#linkInstagram").href = `https://instagram.com/${LOJA.instagram}`;
  $("#linkInstagram").textContent = `@${LOJA.instagram}`;
  $("#linkWhatsapp").href = `https://wa.me/${LOJA.whatsapp}`;
  $("#ano").textContent = new Date().getFullYear();

  carregarCatalogo().then(() => {
    pronto = true;
    carrinho = carregar();
    $("#rotuloEntrega").textContent = `Entrega na cidade (${brl(centavos(LOJA.taxaEntrega))})`;
    $("#rotuloPix").textContent = LOJA.descontoPix > 0 ? `Pix (${LOJA.descontoPix}% de desconto)` : "Pix";
    desenharCatalogo();
    desenharCarrinho();
    abrirPeloLink();
  });
})();
