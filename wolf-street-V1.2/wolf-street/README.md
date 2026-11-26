# WØLF STREET — loja (V1.2)

## Primeiro passo (obrigatório)
1. No Supabase, abra o SQL Editor e rode `supabase/schema.sql` inteiro. Ele roda por cima do script original e corrige falhas de segurança. Sem ele, pedidos não são gravados.
2. Rode e confira que só você é ADM:
   `select u.email from public.perfis p join auth.users u using (id) where p.is_admin;`
3. Em Storage > Policies, apague regras antigas do bucket `produtos` que liberem envio para qualquer pessoa.
4. Em Authentication: configure um SMTP próprio, ou desative "Confirm email". O envio padrão do Supabase só entrega para membros do seu projeto.
5. Em Authentication > URL Configuration, coloque o endereço publicado em "Site URL".
6. Abra o site, entre com sua conta ADM, vá em Painel ADM e use "Importar produtos iniciais".

## Como funciona
- Produtos, estoque e pedidos vêm do Supabase. Se a tabela estiver vazia ou sem conexão, a loja usa `js/produtos.js` (nesse modo o pedido não é gravado).
- Taxa de entrega, frete grátis e desconto Pix: tabela `loja` (Table Editor). Número do WhatsApp e Instagram: `js/produtos.js`.
- Estoque só baixa quando você clica em "Confirmar Venda". Cancelar uma venda confirmada devolve as peças.

## Rodar localmente
Para testar o login, rode `python -m http.server 8000` e acesse http://localhost:8000.

## Antes de publicar
1. Em `js/produtos.js`, troque `LOJA.whatsapp` pelo número real (ex.: `5561999998888`). Com o número de exemplo o pedido não é enviado.
2. Ajuste preços, estoque e medidas no Painel ADM (os dados iniciais são fictícios).
3. Coloque o logo em `assets/logo.png` (fundo transparente). Sem ele, aparece o nome em texto.
4. Fotos das peças: envie pelo Painel ADM (são reduzidas automaticamente).
5. Foto do banner: troque `assets/hero.svg` em `.hero`, no `css/style.css`.
6. No `index.html`, troque `SEU-DOMINIO.vercel.app` (2 lugares) pelo endereço publicado e substitua `assets/og-cover.jpg` se quiser outra capa (1200x630).
7. Revise a Política de trocas no rodapé do `index.html`.

## Link direto para uma peça
`https://seu-site/?produto=wolf-alpha` (o final é o `id` do produto). Dentro da peça há o botão "Copiar link da peça".
A prévia do link é a mesma capa para todas as peças.

## Publicar
- Netlify: arraste a pasta em https://app.netlify.com/drop
- Vercel: suba para um repositório no GitHub e importe (framework "Other", sem build).
- Antes de usar um plano gratuito para vender, confira os termos de uso comercial do provedor.

