/* Conexão com o Supabase e utilidades usadas pela loja e pelo painel.
   A chave "publishable" pode ficar pública: quem protege os dados são as
   regras de segurança (supabase/schema.sql). Nunca coloque aqui a chave "secret". */
const SUPABASE_URL = "https://eqwxjhxckxkbyvwocjcm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_sdtgIo9897VPBh-xaDwSlA_7_zlSkrU";

const WS = {
  // null se a CDN não carregar: a loja segue com js/produtos.js
  sb: window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null,

  $: (s, raiz = document) => raiz.querySelector(s),
  $$: (s, raiz = document) => [...raiz.querySelectorAll(s)],
  esc: (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  // Valores em centavos para evitar erro de arredondamento
  centavos: (v) => Math.round(v * 100),
  brl: (c) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
  data: (iso) => new Date(iso).toLocaleDateString("pt-BR"),
  rotuloStatus: { pendente: "Pendente", confirmado: "Confirmado", cancelado: "Cancelado" },

  comLimite: (promessa, ms) => Promise.race([
    promessa,
    new Promise((_, falhar) => setTimeout(() => falhar(new Error("Tempo esgotado")), ms)),
  ]),

  // jsonb não preserva a ordem das chaves
  ordenarTamanhos(obj = {}) {
    const ordem = ["PP", "P", "M", "G", "GG", "XG", "ÚNICO"];
    return Object.fromEntries(Object.entries(obj || {}).sort(([a], [b]) => ordem.indexOf(a) - ordem.indexOf(b)));
  },

  // Linha da tabela produtos -> formato usado pela vitrine
  doBanco: (p) => ({
    id: p.id,
    nome: p.nome,
    categoria: p.categoria,
    preco: Number(p.preco),
    precoOriginal: p.preco_original ? Number(p.preco_original) : undefined,
    tag: p.tag || "",
    descricao: p.descricao || "",
    imagens: p.imagens?.length ? p.imagens : ["assets/hero.svg"],
    estoque: WS.ordenarTamanhos(p.estoque),
    medidas: WS.ordenarTamanhos(p.medidas),
  }),
};
