/* Área do cliente (opcional: a compra funciona sem login) */
(() => {
  "use strict";
  const { $, $$, esc, brl, centavos, sb, data, rotuloStatus } = WS;
  if (!sb) return;

  const acesso = $("#formAcesso");
  const perfilForm = $("#formPerfil");
  const checkout = $("#checkout");
  let modo = "entrar";
  let usuario = null;
  let preenchidos = {};

  $("#abrirConta").hidden = false;

  const traduzir = (msg) =>
    /Invalid login/i.test(msg) ? "E-mail ou senha incorretos."
    : /not confirmed/i.test(msg) ? "Confirme seu e-mail antes de entrar."
    : /already registered/i.test(msg) ? "Esse e-mail já tem conta."
    : /rate limit/i.test(msg) ? "Muitas tentativas. Tente de novo mais tarde."
    : /Password should/i.test(msg) ? "Senha fraca. Use pelo menos 6 caracteres."
    : "Não foi possível concluir. Tente novamente.";

  $$("[data-modo]").forEach((aba) => aba.addEventListener("click", () => {
    modo = aba.dataset.modo;
    $$("[data-modo]").forEach((b) => b.setAttribute("aria-selected", b === aba));
    const cadastro = modo === "cadastrar";
    $("#campoNomeCadastro").hidden = !cadastro;
    acesso.elements.nome.required = cadastro;
    acesso.elements.senha.autocomplete = cadastro ? "new-password" : "current-password";
    $("#btnAcesso").textContent = cadastro ? "Criar conta" : "Entrar";
    $("#msgAcesso").textContent = "";
  }));

  acesso.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { nome, email, senha } = acesso.elements;
    const botao = $("#btnAcesso");
    botao.disabled = true;
    $("#msgAcesso").textContent = "Aguarde...";
    try {
      const credenciais = { email: email.value.trim(), password: senha.value };
      const { data: resposta, error } = modo === "cadastrar"
        ? await sb.auth.signUp({
            ...credenciais,
            options: { data: { nome: nome.value.trim() }, emailRedirectTo: location.origin + location.pathname },
          })
        : await sb.auth.signInWithPassword(credenciais);
      if (error) throw error;
      $("#msgAcesso").textContent = resposta.session ? "" : "Conta criada. Confirme pelo link enviado ao seu e-mail.";
      senha.value = "";
    } catch (erro) {
      $("#msgAcesso").textContent = traduzir(erro.message);
    } finally {
      botao.disabled = false;
    }
  });

  // Preenche o carrinho sem sobrescrever o que o cliente digitou
  function preencherCarrinho(perfil) {
    for (const [campo, valor] of [["nome", perfil.nome], ["endereco", perfil.bairro]]) {
      const input = checkout.elements[campo];
      if (valor && (!input.value || input.value === preenchidos[campo])) input.value = preenchidos[campo] = valor;
    }
  }

  async function carregarPerfil() {
    const { data: perfil, error } = await sb.from("perfis").select("nome, telefone, bairro, is_admin").eq("id", usuario.id).maybeSingle();
    if (error || !perfil) {
      $("#msgPerfil").textContent = "Não foi possível carregar seus dados.";
      return;
    }
    for (const campo of ["nome", "telefone", "bairro"]) perfilForm.elements[campo].value = perfil[campo] || "";
    preencherCarrinho(perfil);
    $("#linkAdm").hidden = $("#linkAdmConta").hidden = perfil.is_admin !== true;
  }

  async function carregarPedidos() {
    if (!usuario) return;
    // Filtro explícito: o ADM enxerga todos os pedidos pelas regras do banco
    const { data: pedidos, error } = await sb.from("pedidos").select("*").eq("user_id", usuario.id).order("created_at", { ascending: false });
    if (error) {
      $("#meusPedidos").innerHTML = `<p class="aviso">Não foi possível carregar os pedidos.</p>`;
      return;
    }
    $("#pecas").textContent = pedidos.filter((p) => p.status === "confirmado").reduce((s, p) => s + p.total_pecas, 0);
    $("#meusPedidos").innerHTML = pedidos.map((p) => `
      <div class="pedido">
        <div class="pedido-topo"><strong>${data(p.created_at)}</strong><span class="selo ${esc(p.status)}">${esc(rotuloStatus[p.status] || p.status)}</span></div>
        ${(p.itens || []).map((i) => `<p>${esc(i.qtd)}x ${esc(i.nome || i.id)} (${esc(i.tam)})</p>`).join("")}
        <p>${esc(p.total_pecas)} peça(s) • ${brl(centavos(p.valor_total))}</p>
      </div>`).join("") || `<p class="aviso">Nenhum pedido ainda.</p>`;
  }

  function mostrar(sessao) {
    const anterior = usuario?.id;
    usuario = sessao?.user || null;
    acesso.hidden = !!usuario;
    $("#areaCliente").hidden = !usuario;
    if (!usuario) {
      $("#linkAdm").hidden = $("#linkAdmConta").hidden = true;
      // Não deixa dados da conta no aparelho depois de sair
      for (const [campo, valor] of Object.entries(preenchidos)) {
        if (checkout.elements[campo].value === valor) checkout.elements[campo].value = "";
      }
      preenchidos = {};
      perfilForm.reset();
      $("#meusPedidos").innerHTML = "";
      $("#pecas").textContent = "0";
    } else if (usuario.id !== anterior) {
      carregarPerfil();
      carregarPedidos();
    }
  }

  // setTimeout: o Supabase não permite novas consultas dentro deste callback
  sb.auth.onAuthStateChange((_evento, sessao) => setTimeout(() => mostrar(sessao)));

  perfilForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { nome, telefone, bairro } = perfilForm.elements;
    const novos = { nome: nome.value.trim(), telefone: telefone.value.trim(), bairro: bairro.value.trim() };
    const { error } = await sb.from("perfis").update(novos).eq("id", usuario.id);
    $("#msgPerfil").textContent = error ? "Não foi possível salvar." : "Dados salvos.";
    if (!error) preencherCarrinho(novos);
  });

  $("#sair").addEventListener("click", () => sb.auth.signOut());
  $("#abrirConta").addEventListener("click", carregarPedidos);
  window.addEventListener("pedido-criado", carregarPedidos);
  window.addEventListener("pageshow", (e) => e.persisted && carregarPedidos());
})();
