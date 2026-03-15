# Deploy AWS: App Runner + RDS

## Arquitetura

O repositório atual do PagAline é uma aplicação Node.js full-stack:

- `client/`: frontend React + Vite
- `server/`: backend Express que expõe rotas `/api/*`
- `db/` + `shared/`: acesso PostgreSQL com Drizzle

Para publicar o projeto como ele está hoje:

- `AWS App Runner`: hospeda a aplicação web
- `Amazon RDS for PostgreSQL`: banco de dados gerenciado

## Arquivos de deploy no repositório

- `apprunner.yaml`: build e start do serviço no App Runner
- `.env.example`: referência local das variáveis mínimas
- `scripts/aws/cloudshell-provision-pagaline.sh`: provisionamento assistido via AWS CloudShell
- `scripts/aws/cloudshell-enable-ocr.sh`: habilita bucket OCR, permissões IAM e variáveis do App Runner

## Variáveis e segredos

Defina no App Runner em runtime:

- `NODE_ENV=production`
- `DATABASE_URL` via AWS Secrets Manager ou SSM Parameter Store
- `AWS_REGION=<região do serviço>`
- `AWS_DEFAULT_REGION=<região do serviço>`
- `OCR_BUCKET_NAME=<bucket privado para upload OCR>`

Formato esperado de `DATABASE_URL`:

```text
postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

## Ordem recomendada de ativação na AWS

1. Criar o banco PostgreSQL no Amazon RDS.
2. Liberar a porta `5432` do security group do RDS para o security group do App Runner.
3. Criar um segredo `DATABASE_URL` no AWS Secrets Manager ou SSM.
4. Criar o serviço no AWS App Runner a partir do GitHub usando `apprunner.yaml`.
5. Configurar `Outgoing network traffic` do App Runner para `Custom VPC` usando a mesma VPC do RDS.
6. Rodar `npm run db:push` uma vez contra o banco novo para criar o schema.

## Observações operacionais

- O App Runner injeta a variável reservada `PORT`; o serviço já lê `process.env.PORT`.
- Se o RDS estiver em sub-redes privadas, o App Runner precisa de um `VPC Connector`.
- Ao associar o App Runner a um `Custom VPC`, pode haver uma latência inicial de alguns minutos na primeira subida do serviço.
- O serviço atual usa `dist/index.cjs` para servir a API e o frontend compilado em `dist/public`.

## Caminho mais simples para o primeiro schema

Se você quiser executar `npm run db:push` a partir da sua máquina na primeira ativação, o caminho mais simples é:

1. Criar o RDS com `Public access = Yes`.
2. No security group do RDS, liberar `5432` apenas para o seu IP público atual.
3. Rodar `npm ci` e `npm run db:push` localmente com `DATABASE_URL` apontando para o RDS.
4. Manter o App Runner acessando o banco pela VPC privada, usando `VPC Connector` e uma regra adicional no security group do RDS permitindo a porta `5432` a partir do security group do App Runner.

Depois que o schema estiver criado, você pode manter o acesso público restrito ao seu IP ou endurecer isso depois com um fluxo de migração executado de dentro da AWS.

## OCR com AWS

O fluxo implementado no repositório usa:

- `Amazon S3` para receber a foto ou PDF via URL assinada
- `Amazon Textract AnalyzeExpense` para extrair descrição, valor e vencimento
- `App Runner instance role` para acessar `S3` e `Textract`

Para habilitar no ambiente já criado, execute no CloudShell:

```bash
bash scripts/aws/cloudshell-enable-ocr.sh
```

O script:

1. Cria ou reaproveita um bucket privado para OCR.
2. Aplica `S3 CORS` para o domínio do App Runner e localhost.
3. Adiciona permissões `s3:*Object`, `s3:ListBucket` e `textract:AnalyzeExpense` no role do App Runner.
4. Atualiza o serviço com `OCR_BUCKET_NAME`, `AWS_REGION` e `AWS_DEFAULT_REGION`.
