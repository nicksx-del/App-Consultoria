# Aplicativo Consultoria

Aplicativo mobile e web para consultorias fitness, com foco em fluxo de treinador e aluno, acompanhamento de treinos, dieta, check-ins, chat e organização da operação no Supabase.

## Visão Geral

O projeto foi pensado para centralizar a rotina de uma consultoria em um só lugar:

- **Treinador** gerencia alunos, monta treinos e dietas, acompanha check-ins e visualiza evolução.
- **Aluno** acessa seu painel com treino, dieta, rotina, anamnese, chat e histórico de progresso.
- **Supabase** atua como backend principal para autenticação, banco de dados, storage e funções.

O app também oferece:

- uma **home institucional** para entrada por perfil;
- uma **página de download** para o APK no web;
- um **modo demo** para visualizar o dashboard de treinador sem precisar configurar dados reais.

## Principais Funcionalidades

- Autenticação com Supabase.
- Fluxo separado para **treinador** e **aluno**.
- Cadastro e gestão de consultorias.
- Montagem e acompanhamento de treino.
- Prescrição e acompanhamento de dieta.
- Check-ins com histórico de evolução.
- Chat entre treinador e aluno.
- Anamnese do aluno.
- Tela de download do APK para Android.
- Suporte a preview web e navegação por rotas especiais.

## Stack

- **Expo**
- **React Native**
- **TypeScript**
- **Supabase**
- **Sora** como família tipográfica principal

## Estrutura do Projeto

```txt
App-Consultoria/
├── App.tsx
├── index.ts
├── README.md
├── app.json
├── vercel.json
├── assets/
├── src/
│   ├── components/
│   ├── lib/
│   ├── screens/
│   └── types/
└── supabase/
    ├── *.sql
    └── functions/
```

## Requisitos

- Node.js compatível com Expo.
- npm instalado.
- Conta no Supabase.
- Banco e storage configurados com os schemas do projeto.

## Instalação

```bash
npm install
```

## Execução

### Desenvolvimento

```bash
npm run start
```

### Android

```bash
npm run android
```

### iOS

```bash
npm run ios
```

### Web

```bash
npm run web
```

### Build para Web

```bash
npm run build:web
```

### Preview do Build Web

```bash
npm run preview:web
```

## Variáveis de Ambiente

O app lê variáveis tanto do `app.json` quanto do ambiente de execução.

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Sim | URL do projeto Supabase |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sim | Chave pública usada pelo cliente |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Opcional | Fallback para autenticação, se necessário |
| `EXPO_PUBLIC_APK_DOWNLOAD_URL` | Opcional | Link do APK exibido na tela de download |

### Observação importante

Se o Supabase não estiver configurado, o app ainda abre em modo visual/local em partes da experiência, mas as ações reais de login, cadastro e persistência vão depender da configuração correta.

## Supabase

Os arquivos SQL e a function estão em:

- `supabase/auth-schema.sql`
- `supabase/consultancy-schema.sql`
- `supabase/students-schema.sql`
- `supabase/training-schema.sql`
- `supabase/nutrition-schema.sql`
- `supabase/chat-schema.sql`
- `supabase/checkins-schema.sql`
- `supabase/anamnesis-schema.sql`
- `supabase/student-profile-schema.sql`
- `supabase/student-execution-schema.sql`
- `supabase/chat-enhancements-schema.sql`
- `supabase/checkins-video-schema.sql`
- `supabase/cardio-execution-schema.sql`
- `supabase/functions/create-student/index.ts`

### O que você precisa aplicar

1. Criar o projeto no Supabase.
2. Aplicar os SQLs na ordem necessária para liberar auth, consultoria, alunos, treinos, dieta, chat, check-ins e anamnese.
3. Publicar a Edge Function `create-student`.
4. Garantir os buckets e policies usados pelo app.

## Fluxos Especiais

### Modo Demo

Na web, você pode abrir o dashboard demo de treinador com:

```txt
/?demo=trainer
```

Esse modo mostra uma visão ilustrativa do painel sem depender de dados reais.

### Página de Download

Na web, você pode abrir a tela de download com:

```txt
/?page=download
```

Essa página foi pensada para apontar para o APK quando a variável `EXPO_PUBLIC_APK_DOWNLOAD_URL` estiver definida.

## Scripts Disponíveis

| Script | Comando |
| --- | --- |
| Iniciar o app | `npm run start` |
| Abrir no Android | `npm run android` |
| Abrir no iOS | `npm run ios` |
| Abrir no navegador | `npm run web` |
| Gerar build web | `npm run build:web` |
| Servir build web | `npm run preview:web` |

## Observações de Uso

- O app usa uma navegação baseada em estado dentro de `App.tsx`.
- O fluxo de login diferencia **treinador** e **aluno**.
- Alunos normalmente são criados dentro da rotina do treinador.
- Algumas áreas do dashboard dependem diretamente do schema do Supabase e podem exigir migrações e policies corretas.
- A experiência visual usa a fonte **Sora** e foi desenhada para funcionar em mobile e web.

## Licença

Consulte o arquivo `LICENSE` para os termos de uso do projeto.
