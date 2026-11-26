/* Painel ADM. A proteção real está nas regras do banco (supabase/schema.sql);
   o redirecionamento abaixo só esconde a tela de quem não é ADM. */
(async () => {
  "use strict";
  const { $, $$, esc, brl, centavos, sb, data, rotuloStatus, comLimite, ordenarTamanhos } = WS;
  const TAMANHOS = ["P", "M", "G", "GG", "ÚNICO"];
  const BUCKET = "produtos";
  const sair = () => location.replace("index.html");

  async function ehAdmin() {
    if (!sb) return false;
    const { data: { user }, error } = await comLimite(sb.auth.getUser(), 8000);
    if (error || !user) return false;
    const perfil = await comLimite(sb.from("perfis").select("is_admin").eq("id", user.id).maybeSingle(), 8000);
    return perfil.data?.is_admin === true;
  }

  try {
    if (!(await ehAdmin())) return sair();
  } catch {
    return sair();
  }
  $("#painel").hidden = false;
  sb.auth.onAuthStateChange((evento) => evento === "SIGNED_OUT" && sair());

  let produtos = [];
  let status = "pendente";
  let editando = null; // linha em edição, ou null para peça nova
  let fotos = [];
  let enviadas = []; // fotos enviadas nesta edição e ainda não salvas

  function avisar(texto) {
    $("#msg").textContent = texto;
    $("#msg").hidden = !texto;
    if (texto) $("#msg").scrollIntoView({ block: "nearest" });
  }

  /* ---------- Produtos ---------- */
  async function carregarProdutos() {
    const { data: linhas, error } = await sb.from("produtos").select("*").order("created_at", { ascending: false });
    if (error) return avisar(`Erro ao listar produtos: ${error.message}`);
    produtos = linhas;
    $("#importar").hidden = produtos.length > 0;
    $("#lista").innerHTML = produtos.map((p) => `
      <article class="linha">
        <img src="${esc(p.imagens?.[0] || "assets/hero.svg")}" alt="">
        <div>
          <h3>${esc(p.nome)}${p.ativo ? "" : " (oculto)"}</h3>
          <p>${brl(centavos(p.preco))} • ${esc(p.categoria)}</p>
          <p>${Object.entries(ordenarTamanhos(p.estoque)).map(([t, q]) => `${esc(t)}: ${esc(q)}`).join(" • ") || "Sem estoque cadastrado"}</p>
          <div class="botoes">
            <button type="button" data-editar="${esc(p.id)}">Editar</button>
            <button type="button" data-excluir="${esc(p.id)}">Excluir</button>
          </div>
        </div>
      </article>`).join("") || `<p class="vazio">Nenhuma peça no banco. A loja está mostrando o js/produtos.js.</p>`;
  }

  $("#importar").addEventListener("click", async (e) => {
    const botao = e.currentTarget;
    botao.disabled = true;
    const { count, error } = await sb.from("produtos").select("id", { count: "exact", head: true });
    if (error || count > 0) {
      avisar(error ? `Erro: ${error.message}` : "A tabela já tem produtos. Nada foi importado.");
    } else {
      // Datas decrescentes preservam a ordem do arquivo
      const agora = Date.now();
      const resposta = await sb.from("produtos").insert(PRODUTOS.map((p, i) => ({
        id: p.id, nome: p.nome, categoria: p.categoria, preco: p.preco,
        preco_original: p.precoOriginal ?? null, tag: p.tag || null, descricao: p.descricao,
        imagens: p.imagens, estoque: p.estoque, medidas: p.medidas, ativo: true,
        created_at: new Date(agora - i * 1000).toISOString(),
      })));
      avisar(resposta.error ? `Erro ao importar: ${resposta.error.message}` : "Produtos importados. Revise preços e estoque: são fictícios.");
    }
    botao.disabled = false;
    carregarProdutos();
  });

  /* ---------- Editor ---------- */
  const editor = $("#editor");
  const form = $("#formProduto");

  function abrirEditor(p) {
    editando = p;
    fotos = [...(p?.imagens || [])];
    enviadas = [];
    form.reset();
    $("#tituloEditor").textContent = p ? "Editar peça" : "Nova peça";
    $("#erroProduto").textContent = "";
    if (p) {
      for (const campo of ["nome", "preco", "preco_original", "categoria", "tag", "descricao"]) form.elements[campo].value = p[campo] ?? "";
      form.elements.ativo.checked = p.ativo;
    }
    $("#categorias").innerHTML = [...new Set([...CATEGORIAS, ...produtos.map((x) => x.categoria)])]
      .map((c) => `<option value="${esc(c)}">`).join("");
    // Mantém tamanhos fora da lista padrão que já existam na peça
    const tamanhos = [...new Set([...TAMANHOS, ...Object.keys(p?.estoque || {})])];
    $("#grade").innerHTML = tamanhos.map((t) => `
      <tr data-t="${esc(t)}">
        <td>${esc(t)}</td>
        <td><input data-c="estoque" type="number" min="0" step="1" inputmode="numeric" aria-label="Estoque ${esc(t)}" value="${esc(p?.estoque?.[t] ?? "")}"></td>
        <td><input data-c="altura" inputmode="decimal" aria-label="Altura ${esc(t)}" value="${esc(p?.medidas?.[t]?.altura ?? "")}"></td>
        <td><input data-c="largura" inputmode="decimal" aria-label="Largura ${esc(t)}" value="${esc(p?.medidas?.[t]?.largura ?? "")}"></td>
      </tr>`).join("");
    desenharFotos();
    editor.showModal();
    $(".drawer-corpo", editor).scrollTop = 0;
  }

  function desenharFotos() {
    $("#fotos").innerHTML = fotos.map((src, i) => `
      <div>
        <img src="${esc(src)}" alt="Foto ${i + 1}">
        <div>
          <button type="button" data-subir="${i}" aria-label="Mover para antes" ${i ? "" : "disabled"}>&larr;</button>
          <button type="button" data-tirar="${i}" aria-label="Remover foto">&times;</button>
        </div>
      </div>`).join("");
  }

  $("#fotos").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.tirar) fotos.splice(Number(b.dataset.tirar), 1);
    else {
      const i = Number(b.dataset.subir);
      [fotos[i - 1], fotos[i]] = [fotos[i], fotos[i - 1]];
    }
    desenharFotos();
  });

  // Reduz fotos do celular antes do envio (economiza o armazenamento gratuito)
  async function reduzir(arquivo) {
    try {
      const imagem = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
      const escala = Math.min(1, 1350 / imagem.height);
      const tela = document.createElement("canvas");
      tela.width = Math.round(imagem.width * escala);
      tela.height = Math.round(imagem.height * escala);
      const ctx = tela.getContext("2d");
      ctx.fillStyle = "#111114";
      ctx.fillRect(0, 0, tela.width, tela.height);
      ctx.drawImage(imagem, 0, 0, tela.width, tela.height);
      const blob = await new Promise((ok) => tela.toBlob(ok, "image/jpeg", 0.85));
      if (!blob) throw new Error();
      return blob;
    } catch {
      throw new Error(`Não foi possível ler ${arquivo.name}. Use JPG, PNG ou WEBP.`);
    }
  }

  $("#arquivos").addEventListener("change", async (e) => {
    const arquivos = [...e.target.files];
    e.target.value = "";
    $("#salvar").disabled = true;
    try {
      for (const [i, arquivo] of arquivos.entries()) {
        $("#erroProduto").textContent = `Enviando ${i + 1} de ${arquivos.length}...`;
        const caminho = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await sb.storage.from(BUCKET).upload(caminho, await reduzir(arquivo), { contentType: "image/jpeg", cacheControl: "31536000" });
        if (error) throw new Error(`Falha no envio: ${error.message}`);
        const url = sb.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
        fotos.push(url);
        enviadas.push(url);
        desenharFotos();
      }
      $("#erroProduto").textContent = "";
    } catch (erro) {
      $("#erroProduto").textContent = erro.message;
    }
    $("#salvar").disabled = false;
  });

  // Apaga do Storage somente arquivos do bucket que nenhuma peça usa
  async function apagarFotos(urls) {
    const emUso = new Set(produtos.flatMap((p) => p.imagens || []));
    const marca = `/object/public/${BUCKET}/`;
    const caminhos = urls.filter((u) => u.includes(marca) && !emUso.has(u)).map((u) => decodeURIComponent(u.split(marca)[1]));
    if (caminhos.length) await sb.storage.from(BUCKET).remove(caminhos);
  }

  const numero = (texto) => {
    const t = String(texto).trim();
    return t === "" ? null : Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  };

  const slug = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ø/gi, "o")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "peca";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const campos = form.elements;
    const erro = (t) => ($("#erroProduto").textContent = t);
    const preco = numero(campos.preco.value);
    const original = numero(campos.preco_original.value);
    if (!(preco > 0) || (original !== null && !(original > 0))) return erro("Confira os preços.");

    const estoque = {};
    const medidas = {};
    for (const linha of $$("#grade tr")) {
      const t = linha.dataset.t;
      const valor = (c) => numero($(`[data-c=${c}]`, linha).value);
      const qtd = valor("estoque");
      if (qtd === null) continue;
      if (!Number.isInteger(qtd) || qtd < 0) return erro(`Estoque inválido em ${t}.`);
      estoque[t] = qtd;
      const altura = valor("altura");
      const largura = valor("largura");
      if (altura > 0 && largura > 0) medidas[t] = { altura, largura };
    }
    if (!Object.keys(estoque).length) return erro("Informe o estoque de pelo menos um tamanho.");

    const dados = {
      nome: campos.nome.value.trim(), categoria: campos.categoria.value.trim(),
      preco, preco_original: original, tag: campos.tag.value.trim() || null,
      descricao: campos.descricao.value.trim(), imagens: fotos, estoque, medidas,
      ativo: campos.ativo.checked,
    };
    if (!dados.nome || !dados.categoria) return erro("Preencha nome e categoria.");

    $("#salvar").disabled = true;
    let id = editando?.id || slug(dados.nome);
    if (!editando && produtos.some((p) => p.id === id)) id += `-${Date.now().toString(36)}`;
    const resposta = editando
      ? await sb.from("produtos").update(dados).eq("id", id).select("id")
      : await sb.from("produtos").insert({ id, ...dados }).select("id");
    $("#salvar").disabled = false;
    if (resposta.error || !resposta.data.length) return erro(`Não salvou: ${resposta.error?.message || "sem permissão"}`);

    const sobras = [...(editando?.imagens || []), ...enviadas].filter((u) => !fotos.includes(u));
    enviadas = [];
    editor.close();
    avisar("Peça salva.");
    await carregarProdutos();
    apagarFotos(sobras);
  });

  // Fechou sem salvar: remove o que foi enviado
  editor.addEventListener("close", () => {
    if (enviadas.length) apagarFotos(enviadas);
    enviadas = [];
  });
  $("#fecharEditor").addEventListener("click", () => editor.close());
  $("#novo").addEventListener("click", () => abrirEditor(null));

  $("#lista").addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const p = produtos.find((x) => x.id === (b.dataset.editar || b.dataset.excluir));
    if (b.dataset.editar) return abrirEditor(p);
    if (!confirm(`Excluir "${p.nome}"? Para só esconder, edite e desmarque "Visível na loja".`)) return;
    const resposta = await sb.from("produtos").delete().eq("id", p.id).select("id");
    if (resposta.error || !resposta.data.length) return avisar(`Não excluiu: ${resposta.error?.message || "sem permissão"}`);
    avisar("Peça excluída.");
    await carregarProdutos();
    apagarFotos(p.imagens || []);
  });

  /* ---------- Pedidos ---------- */
  async function carregarPedidos() {
    const alvo = status;
    const { data: pedidos, error } = await sb.from("pedidos").select("*").eq("status", alvo).order("created_at", { ascending: false }).limit(100);
    if (alvo !== status) return;
    if (error) return avisar(`Erro ao listar pedidos: ${error.message}`);
    $("#pedidos").innerHTML = pedidos.map((p) => `
      <article class="pedido">
        <div class="pedido-topo"><strong>${esc(p.cliente_nome)}</strong><span class="selo ${esc(p.status)}">${esc(rotuloStatus[p.status])}</span></div>
        <p>${data(p.created_at)} • Código ${esc(p.id.slice(0, 8).toUpperCase())}</p>
        ${(p.itens || []).map((i) => `<p>${esc(i.qtd)}x ${esc(i.nome || i.id)} (${esc(i.tam)})</p>`).join("")}
        <p>${p.tipo_entrega === "entrega" ? `Entrega: ${esc(p.cliente_bairro)}` : "Retirada em mãos"} • ${p.pagamento === "pix" ? "Pix" : "Cartão"}</p>
        <p><strong>${esc(p.total_pecas)} peça(s) • ${brl(centavos(p.valor_total))}</strong></p>
        ${p.status === "cancelado" ? "" : `<div class="botoes">
          ${p.status === "pendente" ? `<button type="button" class="principal" data-id="${esc(p.id)}" data-novo="confirmado">Confirmar Venda</button>` : ""}
          <button type="button" data-id="${esc(p.id)}" data-novo="cancelado">${p.status === "confirmado" ? "Cancelar venda" : "Cancelar"}</button>
        </div>`}
      </article>`).join("") || `<p class="vazio">Nenhum pedido aqui.</p>`;
  }

  $("#pedidos").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-novo]");
    if (!b) return;
    const pergunta = b.dataset.novo === "confirmado"
      ? "Confirmar a venda e dar baixa no estoque?"
      : "Cancelar este pedido? Se já estava confirmado, o estoque volta.";
    if (!confirm(pergunta)) return;
    $$("#pedidos button").forEach((x) => (x.disabled = true));
    // Função do banco: muda o status e o estoque juntos (tudo ou nada)
    const { error } = await sb.rpc("mudar_status_pedido", { p_id: b.dataset.id, p_status: b.dataset.novo });
    avisar(!error ? "Pedido atualizado."
      : error.code === "PGRST202" ? "Rode o arquivo supabase/schema.sql no SQL Editor do Supabase."
      : `Não foi possível: ${error.message}`);
    await Promise.all([carregarPedidos(), carregarProdutos()]);
  });

  $("#filtroPedidos").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    status = b.dataset.status;
    $$("#filtroPedidos button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    carregarPedidos();
  });

  $$(".adm-abas button").forEach((aba) => aba.addEventListener("click", () => {
    $$(".adm-abas button").forEach((x) => x.setAttribute("aria-selected", x === aba));
    $$("[data-painel]").forEach((s) => (s.hidden = s.dataset.painel !== aba.dataset.aba));
    avisar("");
    if (aba.dataset.aba === "pedidos") carregarPedidos();
    else carregarProdutos();
  }));

  // Avisa logo se o SQL novo ainda não foi aplicado (a tabela loja vem dele)
  const loja = await sb.from("loja").select("id").limit(1);
  if (loja.error) avisar("Rode o arquivo supabase/schema.sql no SQL Editor do Supabase antes de usar.");
  carregarProdutos();
})();
