-- WØLF STREET - esquema do banco (V1.1)
-- Rode no SQL Editor do Supabase. Pode ser executado mais de uma vez,
-- inclusive por cima do script original.

-- ============ TABELAS ============
create table if not exists public.perfis (
  id uuid primary key references auth.users on delete cascade,
  nome text,
  telefone text,
  bairro text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.produtos (
  id text primary key,
  nome text not null,
  categoria text not null,
  preco numeric(10,2) not null check (preco >= 0),
  preco_original numeric(10,2),
  tag text,
  descricao text,
  imagens jsonb default '[]'::jsonb,
  estoque jsonb default '{}'::jsonb,
  medidas jsonb default '{}'::jsonb,
  ativo boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  cliente_nome text not null,
  cliente_bairro text,
  tipo_entrega text not null,
  pagamento text not null,
  itens jsonb not null,
  total_pecas int not null,
  valor_total numeric(10,2) not null,
  status text default 'pendente' check (status in ('pendente','confirmado','cancelado')),
  created_at timestamptz default now()
);

-- Configuração da loja (uma linha só). O total do pedido é calculado com ela.
create table if not exists public.loja (
  id int primary key default 1 check (id = 1),
  taxa_entrega numeric(10,2) not null default 10,
  frete_gratis_acima numeric(10,2) not null default 250,  -- 0 desativa
  desconto_pix numeric(5,2) not null default 5 check (desconto_pix between 0 and 100)
);
insert into public.loja (id) values (1) on conflict do nothing;

-- ============ FUNÇÕES AUXILIARES ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, new.raw_user_meta_data->>'nome')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Perfil para quem se cadastrou antes do gatilho existir
insert into public.perfis (id, nome)
select id, raw_user_meta_data->>'nome' from auth.users
on conflict (id) do nothing;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfis where id = auth.uid() and is_admin);
$$;

-- ============ SEGURANÇA ============
alter table public.perfis   enable row level security;
alter table public.produtos enable row level security;
alter table public.pedidos  enable row level security;
alter table public.loja     enable row level security;

-- Remove as regras do script original e as desta versão
drop policy if exists "Usuário vê e edita o próprio perfil" on public.perfis;
drop policy if exists "ADM vê todos os perfis" on public.perfis;
drop policy if exists "Produtos públicos para leitura" on public.produtos;
drop policy if exists "Apenas ADM gerencia produtos" on public.produtos;
drop policy if exists "Qualquer visitante pode criar pedido" on public.pedidos;
drop policy if exists "Cliente vê seus pedidos" on public.pedidos;
drop policy if exists "Apenas ADM atualiza pedidos" on public.pedidos;
drop policy if exists "perfil_ler" on public.perfis;
drop policy if exists "perfil_editar" on public.perfis;
drop policy if exists "produtos_ler" on public.produtos;
drop policy if exists "produtos_admin" on public.produtos;
drop policy if exists "pedidos_ler" on public.pedidos;
drop policy if exists "loja_ler" on public.loja;
drop policy if exists "loja_admin" on public.loja;

create policy "perfil_ler" on public.perfis
  for select using (auth.uid() = id or public.is_admin());
create policy "perfil_editar" on public.perfis
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "produtos_ler" on public.produtos
  for select using (ativo or public.is_admin());
create policy "produtos_admin" on public.produtos
  for all using (public.is_admin()) with check (public.is_admin());

-- Sem regra de insert/update: pedidos só mudam pelas funções abaixo
create policy "pedidos_ler" on public.pedidos
  for select using (auth.uid() = user_id or public.is_admin());

create policy "loja_ler" on public.loja for select using (true);
create policy "loja_admin" on public.loja
  for update using (public.is_admin()) with check (public.is_admin());

-- Permissões da Data API (explícitas)
revoke all on public.perfis, public.produtos, public.pedidos, public.loja from anon, authenticated;
grant select on public.produtos, public.loja to anon, authenticated;
grant insert, update, delete on public.produtos to authenticated;
grant update on public.loja to authenticated;
grant select on public.perfis, public.pedidos to authenticated;
-- O usuário NÃO pode alterar is_admin: só estas colunas
grant update (nome, telefone, bairro) on public.perfis to authenticated;

-- ============ PEDIDOS ============
-- O navegador envia apenas id, tamanho e quantidade. Preço e total saem do banco.
-- p_itens: [{"id":"wolf-alpha","tam":"G","qtd":1}]
create or replace function public.criar_pedido(
  p_nome text, p_bairro text, p_entrega text, p_pagamento text, p_itens jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  cfg public.loja;
  prod public.produtos;
  item record;
  lista jsonb := '[]'::jsonb;
  subtotal numeric(10,2) := 0;
  desconto numeric(10,2) := 0;
  taxa numeric(10,2) := 0;
  pecas int := 0;
  novo uuid;
begin
  if coalesce(length(trim(p_nome)), 0) not between 1 and 60 then raise exception 'Nome inválido'; end if;
  if p_entrega is null or p_entrega not in ('entrega','retirada') then raise exception 'Entrega inválida'; end if;
  if p_pagamento is null or p_pagamento not in ('pix','cartao') then raise exception 'Pagamento inválido'; end if;
  if p_entrega = 'entrega' and coalesce(length(trim(p_bairro)), 0) not between 1 and 160 then
    raise exception 'Endereço inválido';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then raise exception 'Itens inválidos'; end if;
  if jsonb_array_length(p_itens) not between 1 and 30 then raise exception 'Itens inválidos'; end if;

  for item in
    select e->>'id' as id, e->>'tam' as tam, sum((e->>'qtd')::int) as qtd, min((e->>'qtd')::int) as menor
    from jsonb_array_elements(p_itens) e group by 1, 2
  loop
    select * into prod from public.produtos where id = item.id and ativo;
    if not found then raise exception 'Produto indisponível'; end if;
    if item.qtd is null or item.menor < 1 or item.qtd > coalesce((prod.estoque->>item.tam)::int, 0) then
      raise exception 'Estoque insuficiente: % (%)', prod.nome, item.tam;
    end if;
    subtotal := subtotal + prod.preco * item.qtd;
    pecas := pecas + item.qtd;
    lista := lista || jsonb_build_object('id', prod.id, 'nome', prod.nome, 'tam', item.tam,
                                         'qtd', item.qtd, 'preco', prod.preco);
  end loop;

  select * into cfg from public.loja where id = 1;
  if p_pagamento = 'pix' then desconto := round(subtotal * cfg.desconto_pix / 100, 2); end if;
  if p_entrega = 'entrega' and not (cfg.frete_gratis_acima > 0 and subtotal >= cfg.frete_gratis_acima) then
    taxa := cfg.taxa_entrega;
  end if;

  insert into public.pedidos (user_id, cliente_nome, cliente_bairro, tipo_entrega, pagamento, itens, total_pecas, valor_total)
  values (auth.uid(), trim(p_nome), case when p_entrega = 'entrega' then trim(p_bairro) end,
          p_entrega, p_pagamento, lista, pecas, subtotal - desconto + taxa)
  returning id into novo;

  return jsonb_build_object('id', novo, 'total', subtotal - desconto + taxa);
end;
$$;

-- ADM confirma (baixa o estoque) ou cancela (devolve, se já estava confirmado)
create or replace function public.mudar_status_pedido(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  ped public.pedidos;
  item record;
  sinal int;
  atual int;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select * into ped from public.pedidos where id = p_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;

  if ped.status = 'pendente' and p_status = 'confirmado' then sinal := -1;
  elsif ped.status = 'confirmado' and p_status = 'cancelado' then sinal := 1;
  elsif ped.status = 'pendente' and p_status = 'cancelado' then sinal := 0;
  else raise exception 'Mudança de % para % não permitida', ped.status, p_status;
  end if;

  if sinal <> 0 then
    for item in
      select e->>'id' as id, e->>'tam' as tam, (e->>'qtd')::int as qtd
      from jsonb_array_elements(ped.itens) e order by 1, 2
    loop
      select coalesce((estoque->>item.tam)::int, 0) into atual
      from public.produtos where id = item.id for update;
      if not found then
        if sinal = 1 then continue; end if;
        raise exception 'Produto % não existe mais', item.id;
      end if;
      if atual + sinal * item.qtd < 0 then
        raise exception 'Estoque insuficiente: % (%)', item.id, item.tam;
      end if;
      update public.produtos
      set estoque = jsonb_set(estoque, array[item.tam], to_jsonb(atual + sinal * item.qtd))
      where id = item.id;
    end loop;
  end if;

  update public.pedidos set status = p_status where id = p_id;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.mudar_status_pedido(uuid, text) from public, anon;
grant execute on function public.mudar_status_pedido(uuid, text) to authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.criar_pedido(text, text, text, text, jsonb) to anon, authenticated;

-- ============ STORAGE (bucket "produtos") ============
-- Leitura das fotos é pública pelo próprio bucket. Enviar e apagar: só ADM.
drop policy if exists "wolf_img_ler" on storage.objects;
drop policy if exists "wolf_img_enviar" on storage.objects;
drop policy if exists "wolf_img_editar" on storage.objects;
drop policy if exists "wolf_img_apagar" on storage.objects;
create policy "wolf_img_ler" on storage.objects for select to authenticated
  using (bucket_id = 'produtos' and public.is_admin());
create policy "wolf_img_enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'produtos' and public.is_admin());
create policy "wolf_img_editar" on storage.objects for update to authenticated
  using (bucket_id = 'produtos' and public.is_admin());
create policy "wolf_img_apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'produtos' and public.is_admin());

-- ============ SEU ACESSO DE ADM ============
-- Cadastre-se primeiro, depois rode (com o seu e-mail):
-- update public.perfis set is_admin = true
-- where id = (select id from auth.users where email = 'seu@email.com');
--
-- Confira se só você é ADM:
-- select u.email from public.perfis p join auth.users u using (id) where p.is_admin;
