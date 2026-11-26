/* =====================================================================
   WØLF STREET — ARQUIVO CENTRAL
   É o único arquivo que você precisa editar no dia a dia.
   ===================================================================== */

const LOJA = {
  nome: "WØLF STREET",
  instagram: "wolf.street.br",
  // DDI + DDD + número, somente dígitos. Ex.: "5561999998888"
  whatsapp: "5561996091702",
  taxaEntrega: 10.0,          // taxa fixa de entrega na cidade (R$)
  freteGratisAcimaDe: 250.0,  // 0 desativa o frete grátis
  descontoPix: 5,             // porcentagem; 0 desativa
};

// Filtros exibidos na vitrine ("Todos" é automático)
const CATEGORIAS = ["Oversized", "Street", "Acessórios"];

/*
  COMO CADASTRAR UMA PEÇA
  id           único, sem espaços. Não mude depois de publicar.
  preco        use ponto: 99.9
  precoOriginal opcional (aparece riscado)
  tag          opcional ("DROP 01", "ÚLTIMAS UNIDADES"...)
  imagens      a 1ª é a frente, a 2ª as costas (hover), as demais são detalhes.
               Fotos reais: proporção 4:5, ex. 1080x1350, em .webp ou .jpg
  estoque      quantidade por tamanho. 0 = botão riscado.
               Peça sem tamanho: { "ÚNICO": 5 }
  medidas      altura x largura em cm, por tamanho
  A ordem desta lista é a ordem "Destaques" (lançamentos primeiro).
*/
const img = (id) => ["frente", "costas", "detalhe"].map((v) => `assets/produtos/${id}-${v}.svg`);

const PRODUTOS = [
  {
    id: "wolf-alpha",
    nome: "Camiseta Oversized Wolf Alpha",
    categoria: "Oversized",
    preco: 119.9,
    precoOriginal: 139.9,
    tag: "DROP 01",
    imagens: img("wolf-alpha"),
    descricao: "Modelagem oversized com ombro caído, estampa nas costas e gola canelada reforçada. 100% algodão.",
    estoque: { P: 2, M: 0, G: 3, GG: 1 },
    medidas: { P: { altura: 72, largura: 56 }, M: { altura: 74, largura: 59 }, G: { altura: 76, largura: 62 }, GG: { altura: 78, largura: 65 } },
  },
  {
    id: "heavyweight",
    nome: "Drop 01 Heavyweight Tee",
    categoria: "Oversized",
    preco: 139.9,
    tag: "ÚLTIMAS UNIDADES",
    imagens: img("heavyweight"),
    descricao: "Malha pesada 240 g/m², caimento estruturado e acabamento premium. Não marca o corpo.",
    estoque: { P: 0, M: 1, G: 1, GG: 0 },
    medidas: { P: { altura: 71, largura: 57 }, M: { altura: 73, largura: 60 }, G: { altura: 75, largura: 63 }, GG: { altura: 77, largura: 66 } },
  },
  {
    id: "moletom-noturno",
    nome: "Moletom Canguru Noturno",
    categoria: "Street",
    preco: 229.9,
    precoOriginal: 259.9,
    tag: "DROP 01",
    imagens: img("moletom-noturno"),
    descricao: "Moletom flanelado com capuz duplo, bolso canguru e punhos em ribana.",
    estoque: { P: 1, M: 3, G: 2, GG: 1 },
    medidas: { P: { altura: 68, largura: 58 }, M: { altura: 70, largura: 61 }, G: { altura: 72, largura: 64 }, GG: { altura: 74, largura: 67 } },
  },
  {
    id: "cargo-asfalto",
    nome: "Calça Cargo Asfalto",
    categoria: "Street",
    preco: 189.9,
    imagens: img("cargo-asfalto"),
    descricao: "Sarja resistente, bolsos laterais utilitários e ajuste na barra.",
    estoque: { P: 1, M: 2, G: 0, GG: 2 },
    medidas: { P: { altura: 100, largura: 36 }, M: { altura: 102, largura: 39 }, G: { altura: 104, largura: 42 }, GG: { altura: 106, largura: 45 } },
  },
  {
    id: "bone-matilha",
    nome: "Boné Dad Hat Matilha",
    categoria: "Acessórios",
    preco: 79.9,
    imagens: img("bone-matilha"),
    descricao: "Aba curva, sarja de algodão e regulagem traseira em metal.",
    estoque: { "ÚNICO": 6 },
    medidas: { "ÚNICO": { altura: 12, largura: 18 } },
  },
  {
    id: "bag-ronda",
    nome: "Shoulder Bag Ronda",
    categoria: "Acessórios",
    preco: 69.9,
    tag: "ESGOTADO",
    imagens: img("bag-ronda"),
    descricao: "Nylon resistente à água, dois compartimentos e alça regulável.",
    estoque: { "ÚNICO": 0 },
    medidas: { "ÚNICO": { altura: 18, largura: 24 } },
  },
];
