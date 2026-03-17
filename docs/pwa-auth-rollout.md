# PWA Auth Rollout

## Objetivo

Reabilitar o PWA sem reintroduzir bugs de autenticacao, QR Code ou OCR.

## Mudanca aplicada

Arquivo alterado:
- `vite.config.ts`

Resumo:
- o PWA continua controlado por `DISABLE_PWA`
- quando habilitado, o service worker passa a tratar `/api/*` como `NetworkOnly`
- caches antigos do service worker passam a ser limpos automaticamente
- o manifesto continua sendo gerado pelo `vite-plugin-pwa`

## Simulacao

### Cenário 1: PWA desabilitado

Entrada:
- `DISABLE_PWA=true`

Comportamento esperado:
- `vite-plugin-pwa` nao gera service worker
- `manifest.webmanifest` nao entra no build
- a aplicacao funciona como web app comum
- auth, QR Code e OCR dependem apenas da rede e do cookie `pagaline.auth`

Risco residual:
- um navegador que ja tinha service worker antigo pode continuar com cache local ate o usuario limpar dados do site

### Cenário 2: PWA habilitado com a nova config

Entrada:
- `DISABLE_PWA=false`

Comportamento esperado:
- `vite-plugin-pwa` gera `manifest.webmanifest` e service worker
- assets estaticos podem ser reutilizados offline
- requests para `/api/*` nao sao cacheadas
- login, `/api/me`, QR Code, OCR, upload presign e extract sempre vao para a rede

Resultado esperado:
- sem replay de respostas antigas de auth
- sem cache perigoso de `/api/me`
- sem cache perigoso de `/api/device-login-token`
- sem cache perigoso de `/api/ocr/presign`
- sem cache perigoso de `/api/ocr/extract`

## Checklist de ativacao

1. Ajustar secret/env de producao:
   - `DISABLE_PWA=false`
2. Fazer deploy
3. Abrir a app em aba anonima
4. Validar:
   - login
   - recarregar pagina
   - QR Code
   - OCR com PDF
5. Se algum navegador tinha SW antigo:
   - limpar dados do site
   - desregistrar service worker antigo

## Observacao importante

O PWA pode ser tecnicamente reabilitado agora, mas a experiencia de instalacao fica melhor quando o app sair do IP com certificado self-signed e passar para um dominio com HTTPS confiavel.
