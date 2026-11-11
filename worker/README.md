# VIDA Push no Cloudflare Workers (sem Firebase Blaze)

O Worker roda a cada 5 minutos, lê os dados no Firestore e envia Web Push.
O Firebase continua no plano gratuito; não são usadas Cloud Functions.

## 1. Criar as chaves VAPID

Na raiz do projeto:

```powershell
npx web-push generate-vapid-keys
```

Guarde as duas chaves. A pública vai também para o app:

```env
# .env da raiz e variáveis do seu host
VITE_VAPID_PUBLIC_KEY=...
```

A privada só será enviada como segredo ao Cloudflare.

## 2. Criar uma conta de serviço do Firebase

No Console Firebase:

1. Configurações do projeto → Contas de serviço.
2. `Gerar nova chave privada`.
3. Guarde o JSON fora do repositório.

Do JSON serão usados:

- `project_id`
- `client_email`
- `private_key`

Essa conta só é usada pelo Worker para ler os módulos e atualizar o controle
anti-repetição. Nunca coloque o JSON ou a chave privada em `.env` público.

## 3. Entrar no Cloudflare

```powershell
cd worker
npx wrangler login
```

O plano Workers Free aceita Cron Triggers. Para um app pessoal, o Worker faz
poucas chamadas; o gatilho é `*/5 * * * *`.

## 4. Configurar os segredos

Execute cada comando e cole o valor pedido:

```powershell
npx wrangler secret put FIREBASE_PROJECT_ID
npx wrangler secret put FIREBASE_WEB_API_KEY
npx wrangler secret put FIREBASE_CLIENT_EMAIL
npx wrangler secret put FIREBASE_PRIVATE_KEY
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
```

`FIREBASE_WEB_API_KEY` é o mesmo `VITE_FIREBASE_API_KEY` do `.env` da raiz.
Ao colar `FIREBASE_PRIVATE_KEY`, use o conteúdo completo, incluindo
`-----BEGIN PRIVATE KEY-----` e `-----END PRIVATE KEY-----`.

Em `wrangler.jsonc`, troque `VAPID_SUBJECT` pelo seu e-mail:

```json
"VAPID_SUBJECT": "mailto:seu-email@exemplo.com"
```

## 5. Publicar o Worker

```powershell
npm install
npm run typecheck
npm run deploy
```

O comando mostra uma URL parecida com:

```text
https://vida-push.seu-subdominio.workers.dev
```

Teste:

```text
https://vida-push.seu-subdominio.workers.dev/health
```

Deve responder `{"ok":true,"service":"vida-push"}`.

## 6. Ligar o app ao Worker

No `.env` da raiz e nas variáveis do serviço onde o PWA é publicado:

```env
VITE_VAPID_PUBLIC_KEY=SUA_CHAVE_PUBLICA
VITE_PUSH_API_URL=https://vida-push.seu-subdominio.workers.dev
```

Publique também as regras do Firestore (isso não exige Blaze):

```powershell
npx firebase-tools deploy --only firestore:rules
```

Depois faça novo deploy do PWA. Em **Config → Notificações**:

1. Ative os lembretes.
2. Aguarde aparecer “Ativas pelo servidor”.
3. Toque em “Testar pelo servidor”.
4. Feche o app; a notificação deve chegar.

## Desenvolvimento local

Copie `.dev.vars.example` para `.dev.vars`, preencha os segredos e rode:

```powershell
npm run dev
```

O arquivo `.dev.vars` é ignorado pelo Git.

## Segurança e limites

- A chave privada Firebase e a chave VAPID privada ficam em Workers Secrets.
- O endpoint de teste valida o token Firebase do utilizador.
- Push só é enviado para endpoints conhecidos de Google, Apple, Mozilla e
  Windows.
- O Worker limita a leitura a 100 utilizadores por ciclo; é mais que suficiente
  para uso pessoal.
- No iPhone/iPad, o PWA precisa estar instalado na Tela de Início (iOS 16.4+).
