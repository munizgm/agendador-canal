# Agenda de Posts — Instagram + YouTube

App para agendar e publicar posts no Instagram (feed, carrossel, Reels, story) e vídeos no YouTube, com métricas. Funciona assim:

- **Next.js** (painel + API), hospedado na **Vercel**
- **Supabase** (banco, login e armazenamento dos arquivos)
- **n8n** (roda a cada poucos minutos e chama o app para publicar, renovar token e puxar métricas)
- **MCP** (opcional): deixa o Claude agendar e consultar tudo por conversa

Tudo aqui é do zero: você usa **as suas contas** e não existe nenhum dado de outra pessoa neste pacote.

---

## O que você precisa criar (contas gratuitas bastam para começar)

| Serviço | Para quê |
|---|---|
| Supabase | banco de dados, login e storage |
| Vercel (+ GitHub) | hospedar o app |
| n8n (cloud ou próprio) | automações agendadas |
| Meta for Developers | publicar no Instagram |
| Google Cloud | publicar no YouTube |

---

## 1. Supabase (5 min)
1. Crie um projeto novo.
2. **SQL Editor** → cole `supabase/schema.sql` inteiro → Run.
3. Se for usar YouTube: cole `supabase/youtube.sql` inteiro → Run.
4. **Authentication → Users → Add user** (seu e-mail e uma senha). Em *Providers → Email*, desligue "Confirm email" e "Allow new users to sign up" (assim só você entra).
5. **Settings → API**: copie *Project URL*, *anon key* e *service_role key*.

## 2. Variáveis de ambiente
Copie `.env.example` para `.env.local` (teste local) e use os mesmos nomes na Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` → do passo 1
- `CRON_SECRET` → invente uma senha longa (o n8n usa para chamar o app)
- `MCP_KEY` → invente outra senha longa, diferente (só se for usar o MCP)
- `GRAPH_VERSION` → pode deixar `v23.0`

A `service_role` e as senhas inventadas **nunca** vão para o GitHub nem com prefixo `NEXT_PUBLIC_`.

## 3. Deploy na Vercel
1. Suba esta pasta para um repositório **privado** no GitHub.
2. Na Vercel: *Add New → Project* → importe o repositório → cole as variáveis → Deploy.
3. Abra o link e entre com o usuário criado no passo 1.4.

## 4. Instagram
Você precisa de uma conta **profissional** (Comercial ou Criador).
1. developers.facebook.com → *Meus Apps → Criar app* → adicione o produto **Instagram** (login com Instagram).
2. Em *API setup with Instagram business login → Generate access tokens*, clique em **Generate token** ao lado da sua conta, autorize e copie o **token** (começa com `IG`) e o **ID da conta**.
   - Enquanto o app estiver em modo de desenvolvimento, adicione sua conta como **Tester** do app (Funções do app → Instagram Testers) e aceite o convite no Instagram.
3. No app, aba **Conta**: cole o nome (@usuario), o ID e o token. O token dura 60 dias; o workflow de token renova toda semana.

Regras: imagens viram JPEG automaticamente; Reel em MP4/H.264 até ~90 s; carrossel de 2 a 10 itens; story não aceita sticker de link pela API; limite de 100 posts/24 h.

## 5. YouTube
1. console.cloud.google.com → crie um projeto → ative a **YouTube Data API v3**.
2. *Tela de consentimento OAuth*: tipo Externo, adicione seu e-mail como usuário de teste.
3. *Credenciais → Criar ID do cliente OAuth* (aplicativo da Web). A URI de redirecionamento é a que o **n8n** mostra ao criar a credencial *YouTube OAuth2* (passo 6).
4. No app, abra `/youtube` → aba **Conta** → nome do canal, link e horários diários de postagem.

> Vídeos enviados por apps ainda não verificados podem ficar privados. Para publicar de verdade, peça a verificação da API no Google ou use o canal como "usuário de teste" e confira o resultado no YouTube Studio.

## 6. n8n
Em *Import from file*, importe os workflows da pasta `n8n/`:

| Arquivo | O que faz |
|---|---|
| `workflow_publicar.json` | a cada 5 min publica os posts do Instagram que estão na hora |
| `workflow_token.json` | renova o token do Instagram toda semana |
| `workflow_metricas.json` | 1x por dia guarda seguidores e desempenho do Instagram |
| `workflow_youtube_subir.json` | sobe os vídeos da fila para o YouTube (privado, com data de publicação) |
| `workflow_youtube_metricas.json` | confirma publicados e puxa métricas do YouTube |

Em **cada** workflow: troque `SEU-APP.vercel.app` pelo seu domínio da Vercel e `COLE_AQUI_O_CRON_SECRET` pelo mesmo `CRON_SECRET`. Nos dois do YouTube, crie e escolha a credencial **YouTube OAuth2** nos nós do YouTube. Depois **ative** os workflows.

## 7. Teste
- Instagram: aba **Novo post** → estático, horário daqui a 6 min → em até ~10 min aparece no Instagram e o status vira "publicado" com o link.
- YouTube: `/youtube` → **Novo vídeo** → ele entra na fila e o n8n sobe e agenda.

## 8. MCP (opcional, para usar com o Claude)
- Instagram: `https://SEU-APP.vercel.app/api/mcp?key=SUA_MCP_KEY`
- YouTube: `https://SEU-APP.vercel.app/api/mcp-youtube?key=SUA_MCP_KEY`

Adicione como conector personalizado no Claude. Ferramentas do Instagram: listar agenda, listar publicados, criar upload, agendar, cancelar, publicar agora, sincronizar e ver métricas. O YouTube tem as equivalentes.
