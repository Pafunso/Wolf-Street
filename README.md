# WØLF STREET — Loja Virtual (V1.2)

Loja virtual de streetwear com catálogo interativo, área do cliente, painel administrativo e finalização de pedidos direto no WhatsApp.

🔗 **Acesse a loja:** https://wolf-street-iota.vercel.app/

---

## Funcionalidades

- **Catálogo e filtros:** filtragem por categoria, ordenação, guia de medidas e link direto para cada peça.
- **Carrinho e checkout via WhatsApp:** escolha entre entrega na cidade ou retirada em mãos, cálculo de frete/desconto Pix e envio do pedido formatado direto para o WhatsApp.
- **Área do cliente (opcional):** cadastro, login, edição de dados e histórico de pedidos.
- **Painel ADM (`admin.html`):** cadastro de produtos, upload de fotos (redimensionadas automaticamente), controle de preços, medidas e estoque.

## Tecnologias

- **Front-end:** HTML5, CSS3 e JavaScript puro
- **Back-end e Banco de Dados:** Supabase (Auth, PostgreSQL e Storage)
- **Hospedagem:** Vercel

---

## Como funciona

- **Banco de dados e fallback:** produtos, estoque e pedidos vêm do Supabase. Se a tabela estiver vazia ou sem conexão, a loja carrega o catálogo de reserva em `js/produtos.js` (nesse modo o pedido não é gravado no banco).
- **Configurações da loja:** taxa de entrega, frete grátis e desconto Pix ficam na tabela `loja` (Table Editor do Supabase). Número do WhatsApp e link do Instagram ficam em `js/produtos.js`.
- **Controle de estoque:** a baixa acontece somente ao clicar em **Confirmar Venda** no Painel ADM. Cancelar uma venda confirmada devolve as peças ao estoque.

## Link direto para uma peça

Cada produto pode ser compartilhado diretamente pelo seu `id`:

```text
[https://wolf-street-iota.vercel.app/?produto=wolf-alpha](https://wolf-street-iota.vercel.app/?produto=wolf-alpha)
