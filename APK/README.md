# PagAline APK

## Visão geral

O `APK/` contém a versão Android offline do PagAline, construída com React 19 + Vite 7 + Capacitor 6. Nesta arquitetura, toda a persistência e processamento são locais no dispositivo: o PostgreSQL/AWS do projeto web foi substituído por um banco local em IndexedDB, e o OCR em nuvem foi substituído por captura local com `@capacitor/camera` e uma ponte opcional para OCR nativo.

## Objetivos atendidos

- Replicar as 5 telas principais do PagAline web.
- Executar 100% offline.
- Eliminar backend Express, REST e integrações AWS.
- Persistir dados, categorias e configurações em banco local no dispositivo.
- Fazer OCR local e preencher sugestões sem upload.
- Preparar o app para empacotamento Android com Capacitor.

## Pré-requisitos

| Requisito | Versão recomendada |
| --- | --- |
| Node.js | 20+ |
| npm | 10+ |
| Android Studio | Hedgehog ou superior |
| JDK | 17 |
| Android SDK | API 34 |
| Gradle | Gerenciado pelo Android Studio |

## Instalação

```bash
cd APK
npm install
```

## Desenvolvimento web local

```bash
npm run dev
```

## Build web

```bash
npm run build
```

O build gera a pasta `dist/`, usada pelo Capacitor como `webDir`.

> Se aparecer erro de resolução de `@capacitor/*`, confirme que você executou `npm install` dentro de `APK/` antes do build.

## Sincronizar com Android

```bash
npx cap sync android
```

O projeto Android referencia o runtime `@capacitor/android` e os plugins nativos diretamente de `APK/node_modules`, então rode `npm install` antes de abrir o projeto no Android Studio e execute `npx cap sync android` sempre que atualizar dependências do Capacitor.

## Abrir no Android Studio

```bash
npx cap open android
```

## Gerar APK debug

### Pela interface do Android Studio
1. Abra o projeto Android com `npx cap open android`.
2. Vá em **Build → Build Bundle(s)/APK(s) → Build APK(s)**.
3. Aguarde a conclusão e clique em **locate** para abrir o diretório de saída.

### Pela linha de comando
```bash
cd android
./gradlew assembleDebug
```

Saída esperada:
- `android/app/build/outputs/apk/debug/app-debug.apk`

## Gerar APK release assinado

1. No Android Studio, use **Build → Generate Signed Bundle / APK**.
2. Escolha **APK**.
3. Informe o keystore, alias e senha.
4. Selecione a variante `release`.
5. Gere o artefato assinado.

Ou, pela CLI após configurar assinatura no Gradle:

```bash
cd android
./gradlew assembleRelease
```

Saída esperada:
- `android/app/build/outputs/apk/release/app-release.apk`

## Variáveis e configurações

Esta versão não depende de variáveis AWS nem de backend remoto.

> Observação: os ícones PNG não são versionados aqui para evitar problemas com ferramentas de PR que não suportam arquivos binários. Depois, você pode adicionar manualmente `favicon.png`, `icon-192.png` e `icon-512.png` em `APK/public/`.

Configurações centrais:

- `capacitor.config.ts`
  - `appId`: `com.pagaline.app`
  - `appName`: `PagAline`
  - `webDir`: `dist`
- `src/lib/db.ts`
  - Banco local: `pagaline.db`
  - Stores locais: `bills`, `categories`, `settings`
- `src/lib/ocr.ts`
  - OCR local via ponte opcional para o plugin nativo `ImageToText`

## Estrutura de pastas

```text
APK/
├── android/
│   ├── app/
│   │   ├── build.gradle.kts
│   │   ├── capacitor.build.gradle
│   │   └── src/main/
│   │       ├── AndroidManifest.xml
│   │       ├── java/com/pagaline/app/MainActivity.kt
│   │       └── res/
│   │           ├── values/
│   │           └── xml/config.xml
│   ├── build.gradle.kts
│   ├── capacitor.settings.gradle
│   ├── gradle.properties
│   └── settings.gradle.kts
├── public/
│   └── .gitkeep
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   └── MobileLayout.tsx
│   │   └── ui/
│   ├── hooks/
│   │   ├── use-mobile.tsx
│   │   └── use-toast.ts
│   ├── lib/
│   │   ├── db.ts
│   │   ├── ocr.ts
│   │   ├── queryClient.ts
│   │   ├── store.ts
│   │   └── utils.ts
│   ├── pages/
│   │   ├── Bills.tsx
│   │   ├── Home.tsx
│   │   ├── Reports.tsx
│   │   ├── Scan.tsx
│   │   ├── Settings.tsx
│   │   └── not-found.tsx
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── capacitor.config.ts
├── components.json
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

## Funcionalidades implementadas

| Módulo | Status | Observações |
| --- | --- | --- |
| Home | Implementado | Swipe, seleção múltipla, drawers, edição inline |
| Bills | Implementado | Navegação mensal, tabs, busca por texto, recibo mockado |
| Scan | Implementado | OCR local por câmera/galeria, formulário manual |
| Reports | Implementado | Meta mensal, pizza por categoria, barra pago x pendente |
| Settings | Implementado | Nome, foto, meta, dark mode, categorias, reset |
| Banco local IndexedDB | Implementado | Fonte de verdade local |
| OCR local | Implementado | Sem upload ou serviços externos |
| Haptics | Implementado | Feedback ao abrir drawers de opções |
| Push | UI mantida | Sem implementação, conforme requisito |
| Comprovante real | Não implementado | UI mockada mantida |

## Substituições AWS → local

| Web / AWS | APK offline |
| --- | --- |
| Express REST API | Chamadas diretas do Zustand para `db.ts` |
| PostgreSQL + Drizzle | Banco local IndexedDB no app |
| S3 presigned upload | Imagem local em base64 |
| AWS Textract | Ponte opcional para OCR nativo local |
| AWS App Runner | WebView Android empacotada com Capacitor |
| Secrets Manager | Não aplicável |

## Regras de negócio preservadas

- `overdue` é derivado visualmente quando `status === 'pending'` e `dueDate < startOfDay(hoje)`.
- A meta mensal soma contas pagas e pendentes do mês.
- Categorias padrão são recriadas apenas quando a tabela está vazia.
- `settings` é singleton com `id = 'default'`.
- IDs são gerados no cliente com UUID v4.
- Foto de perfil é comprimida para até 512 px antes de salvar.

## Diferenças para a versão web

- Não existe backend Node/Express.
- Não há `fetch`, rotas REST ou autenticação.
- Não há dependência de internet.
- O OCR é executado localmente no aparelho.
- Os dados ficam armazenados no banco local do dispositivo.

## Permissões Android importantes

O `AndroidManifest.xml` inclui:

- `android.permission.CAMERA`
- `android.permission.READ_EXTERNAL_STORAGE`
- `android.permission.WRITE_EXTERNAL_STORAGE`
- `uses-feature` de câmera como opcional
- `meta-data` do ML Kit para OCR offline

## Troubleshooting

### Build Android pede `google-services.json`
O plugin `@capacitor-community/image-to-text` pode exigir configuração Android do Google/Firebase para o OCR nativo. Se isso acontecer no seu ambiente, adicione o `google-services.json` em `android/app/` antes de compilar a versão Android.

### `npx cap sync android` não encontra a pasta `dist`
Execute antes:

```bash
npm run build
```

### Banco local no web preview
No navegador, os dados continuam persistidos em IndexedDB para facilitar o preview e os testes de interface.

### A câmera não abre no emulador
Verifique se o emulador possui câmera configurada ou teste em um dispositivo físico.

### OCR não reconhece texto corretamente
Use imagens nítidas, bem iluminadas e com o documento centralizado.

### OCR indisponível neste build
O app web/preview continua funcionando, mas a leitura automática depende de um plugin nativo `ImageToText` já exposto no runtime do Capacitor. Se o seu ambiente bloquear a dependência npm do plugin, você ainda pode gerar o build e usar preenchimento manual até configurar a integração nativa separadamente.

### APK release não gera
Confira:
- JDK 17 ativo
- Android SDK 34 instalado
- assinatura configurada no Gradle

### Android Studio falha com `Could not find com.capacitorjs:capacitor-android`
Esse projeto usa referências locais do Gradle para `@capacitor/android` e plugins nativos em `APK/node_modules`, em vez de baixar `com.capacitorjs:capacitor-android` do Maven. Se esse erro aparecer, confirme:

1. `npm install` executado dentro de `APK/`
2. `npx cap sync android` executado depois da instalação
3. A pasta `APK/node_modules/@capacitor/android/capacitor` existe
4. O Android Studio abriu `APK/android/`, não a raiz do monorepo

## O que não fazer

- Não adicionar chamadas HTTP.
- Não reintroduzir serviços AWS.
- Não mover arquivos para fora de `APK/`.
- Não implementar autenticação nesta fase.
- Não implementar push real nesta fase.

## Fluxo sugerido de entrega

```bash
cd APK
npm install
npm run build
npx cap sync android
npx cap open android
```

Depois, gere o APK debug ou release no Android Studio.
