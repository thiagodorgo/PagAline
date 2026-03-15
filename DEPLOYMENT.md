# PagAline Deployment

O destino suportado neste repositório é `AWS App Runner + Amazon RDS for PostgreSQL`.

Arquivos principais:

- `apprunner.yaml`
- `.env.example`
- `docs/aws-apprunner-rds.md`

Resumo:

1. Crie o banco no RDS.
2. Salve a connection string em segredo (`DATABASE_URL`).
3. Crie o serviço no App Runner conectado ao GitHub.
4. Aplique o `VPC Connector` para acessar o banco privado.
5. Execute `npm run db:push` uma vez contra o banco de produção.
