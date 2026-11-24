# Heat Championship Companion

SPA Angular para ligas de *Heat: Pedal to the Metal* — **BYOS** (Bring Your Own Supabase). Cada liga usa o próprio projeto Supabase; o app só conecta e organiza a temporada.

## Funcionalidades

- Landing + acesso Visitante / Host / Demo / Servidor local
- Associações (ligas sociais), sistemas de pontuação e melhorias de garagem
- Pistas com curvas ordenadas e velocidades máximas (sentido reverso na corrida)
- Fluxo de corrida em 3 etapas: Setup/Grid → Telemetria ao vivo → Pódio
- Badges automáticos a partir da telemetria (vácuo, pé de chumbo, etc.)
- Classificação com diff, luta pelo título e gráfico de pontos por etapa
- CRUD de carros, pilotos (Lendas), pistas e campeonatos (séries / edições)
- Hall da série, finalização de campeonato
- UI pt-BR / EN e temas claro / escuro inspirados nos manuais

## Como configurar

O companion não guarda dados da liga. Você sobe o banco e conecta a URL + chave.

1. **Crie um projeto** em [supabase.com](https://supabase.com).
2. **Rode o schema** no SQL Editor:
   - projeto novo → [`supabase/schema.sql`](supabase/schema.sql)
   - upgrade → scripts em [`supabase/migrations/`](supabase/migrations/) na ordem
3. **Crie o usuário Host** em **Authentication → Users** (e-mail e senha do organizador).
4. **Copie as credenciais** em **Project Settings → API Keys**:
   - Project URL
   - chave **publishable** (`sb_publishable_…`; chave `anon` legada ainda funciona na janela de migração)
5. **Conecte no app** (landing → **Acessar a liga** / `/connect`):
   - **Visitante:** URL + chave publishable (somente leitura)
   - **Host:** URL + chave + e-mail/senha (escrita completa)

Sessões expiram em 24h e ficam em `localStorage`.

### Desenvolvimento local

```bash
npm install
npm start
```

Abra `http://localhost:4200`.

A SPA usa um `DataProvider` (`supabase` | `preview` | `local`):

| Modo | Como entrar | Dados |
| --- | --- | --- |
| `supabase` | **Acessar a liga** (BYOS) | Seu projeto Supabase |
| `preview` | **Experimentar demo** | Seed em memória / `localStorage` |
| `local` | **Servidor local** | API em [`server/`](server/) + Postgres via Docker |

```bash
# terminal 1 — API + Postgres
docker compose up --build

# terminal 2 — SPA
npm install
npm start
```

Na landing → **Servidor local** → Host `host` / `host` (API em `http://localhost:3000`).

O monorepo mantém o Angular na raiz e a API em `server/`. **GitHub Pages publica só o build estático do Angular** — nada de `server/` entra no artefato.

### Build & deploy (GitHub Pages)

```bash
npm run build
```

Publique `dist/heat-championship/browser`. O app usa hash routing (`/#/...`) para evitar 404 no refresh.

Site de projeto (subpath):

```bash
npx ng build --base-href /YOUR_REPO_NAME/
```

Há workflow em [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml). Em **Settings → Pages**, defina a fonte como **GitHub Actions**.

## Como usar

Workflow recomendado depois de conectar como **Host**:

1. **Carros** — cadastre a garagem com cor única por modelo (usada em gráficos e resultados).
2. **Pilotos** — nome, abreviação, número; marque Lendas e, se quiser, carro fixo ou favorito.
3. **Pistas** — circuitos da liga (nome + país).
4. **Campeonatos** — monte o calendário de etapas, sistema de pontos e módulos; pode iniciar uma nova edição na mesma série.
5. **Corridas** — no detalhe do campeonato, registre pilotos (número/abreviação/carro), sorteie a pista se necessário e use **Registrar Corrida** (grid, chegada, pontos automáticos).
6. **Acompanhar** — classificação (tabela ou gráfico), calendário (lista ou matriz de chegadas), hall da série; finalize o campeonato ao encerrar a temporada.

Visitantes conectam com a mesma URL/chave e só consultam painel, classificação e históricos.

## Stack

- Angular 19 + Tailwind CSS
- DataProvider: Supabase BYOS · Preview mock · Local API (Express + PostgreSQL)
- Hash routing (GitHub Pages)
- pt-BR / EN + temas claro / escuro
