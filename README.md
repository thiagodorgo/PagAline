# PagAline - Gerenciador de Contas a Pagar

## Resumo Executivo
O **PagAline** é um protótipo de aplicativo web progressivo (PWA) com arquitetura *Mobile-First*, desenvolvido em React (via Vite) e TypeScript, focado exclusivamente no ambiente cliente (Front-end). O projeto tem como objetivo demonstrar a viabilidade técnica e a fluidez de interface (UI/UX) de um sistema de gestão financeira pessoal e familiar focado em "Contas a Pagar". O aplicativo utiliza padrões de design de ponta e micro-interações para emular a experiência nativa de sistemas operacionais móveis (como Android/iOS).

## Arquitetura e Tecnologias Utilizadas
A arquitetura do projeto foi estruturada para suportar iterações rápidas e escalabilidade futura para um ambiente Full-Stack, embora a versão atual opere localmente utilizando os recursos de persistência do navegador (Local Storage).

- **Core Framework:** React 18 + Vite
- **Linguagem:** TypeScript (Garantindo tipagem estática e prevenção de erros em tempo de compilação)
- **Gerenciamento de Estado:** Zustand + Middleware de Persistência (Zustand Persist)
- **Estilização e UI Components:**
  - TailwindCSS (Utility-first CSS)
  - Shadcn/UI (Componentes radiais acessíveis)
  - Framer Motion (Motor avançado de animações e detecção de gestos complexos - ex: *Swipes*)
  - Lucide React (Biblioteca de ícones vetoriais em SVG)
- **Roteamento:** Wouter (Roteador minimalista e performático para aplicações Single Page)
- **Visualização de Dados:** Recharts (Geração de gráficos D3 para exibição de balanços)

## Estrutura de Estado (Zustand Store)
A estrutura de gerenciamento de dados do aplicativo (`store.ts`) atua como o único "Cérebro" da aplicação e está dividida em entidades focais:

### Entidade: `Bill` (Conta)
Representa a transação principal do sistema.
- `id`: Identificador único universal (UUID v4).
- `description`: String descritiva (ex: "Conta de Luz").
- `amount`: Float representando o valor financeiro.
- `dueDate`: Data de vencimento.
- `category`: String para agrupamento (ex: "Casa", "Educação").
- `status`: Enum de transição (`'pending'` | `'paid'` | `'overdue'`).
- `paidDate`: Data opcional preenchida no ato da transação.

### Entidade: `UserProfile` (Perfil do Usuário)
Representa os metadados do utilizador atual.
- `name`: Nome de exibição.
- `customPhotoUrl`: String em Base64 armazenando localmente a foto do avatar, providenciando suporte offline e sem dependência de S3/Cloud Storage na etapa de testes.

## Funcionalidades Principais Implementadas

1. **Persistência de Dados Offline-First:** 
   O sistema utiliza o `localStorage` aliado ao Zustand. O Middleware intercepta a hidratação (hydration) para serializar e desserializar objetos complexos (como propriedades de Data do JavaScript), impedindo perdas de dados entre sessões.

2. **Gestos e Interações Nativas (Swipe-to-Action):**
   Implementado através do `Framer Motion`. O usuário pode arrastar Cards de contas lateralmente. Existe detecção algorítmica baseada em *threshold* (distância percorrida) e *velocity* (velocidade do arraste), acionando funções como "Marcar como Pago" ou "Agendar".

3. **Painel de Dashboard de Progresso (Reports):**
   Composto por cálculos em tempo real. O sistema injeta o somatório do status pendente e pago do mês vigente contra o parâmetro `monthlyGoal`. A paleta de cores responde dinamicamente à pressão financeira (tornando a barra de progresso alaranjada/vermelha acima de percentuais críticos).

4. **Simulador de OCR (Optical Character Recognition):**
   Módulo de captura que emula o processamento fotográfico de boletos via delay assíncrono controlado (`setTimeout`), povoando automaticamente e reativamente os campos de *Input* na tela de revisão de documento.

5. **Modo Noturno Global Dinâmico:**
   Controle através do componente `ThemeProvider` injetando classes CSS no DOM raiz e sincronizando com variáveis CSS em escala global, cobrindo todas as áreas modais e sobreposições (Drawers).

## Observações de Segurança e Continuidade
Nesta versão de validação local (Mockup/Protótipo Validativo), a integração bancária real (Open Finance) e conectores de API REST encontram-se temporariamente desabilitados (Stubbed). A arquitetura foi preparada para, na próxima fase do clico de vida de software, ser transicionada para uma estrutura com Node.js/Express ou servidor similar contendo rotas protegidas e banco de dados relacional.

---
*Documentação gerada como parte do ciclo de desenvolvimento do protótipo PagAline (Build Local)*