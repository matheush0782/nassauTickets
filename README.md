# nassauTickets

## Descrição
O **nassauTickets** é um sistema web para gestão, emissão e controle de ingressos e eventos da UNINASSAU. O sistema oferece uma solução centralizada para que organizadores possam cadastrar eventos, gerenciar lotes e validar a entrada de participantes, enquanto os usuários conseguem navegar pelo catálogo, reservar ou adquirir ingressos e acessar seus bilhetes digitais de forma rápida e intuitiva.

## Objetivo
* **Facilitar o acesso a eventos:** Simplificar o processo de compra/reserva e acesso a ingressos digitais pelos alunos e participantes.
* **Automação para organizadores:** Prover ferramentas administrativas para criação de eventos, controle de capacidade de público, emissão de lotes e acompanhamento de vendas.
* **Validação eficiente:** Oferecer um mecanismo prático de verificação e *check-in* de ingressos na portaria/entrada do evento.
* **Prática Acadêmica:** Aplicar conceitos e práticas ágeis de engenharia de software (como o Scrum) no desenvolvimento de uma aplicação real.

## Tecnologias Utilizadas
* **Linguagem / Backend:** Node.js / Python (Flask/Django)
* **Frontend:** HTML5, CSS3, JavaScript (Bootstrap / React)
* **Banco de Dados:** PostgreSQL / MySQL / SQLite
* **Controle de Versão:** Git & GitHub

## Visão geral do Sistema
O sistema é dividido em dois módulos principais:

1. **Módulo do Usuário / Participante:**
   * Cadastro e autenticação de usuários.
   * Consulta ao catálogo de eventos disponíveis.
   * Seleção e aquisição/reserva de ingressos.
   * Painel "Meus Ingressos" para visualização dos bilhetes gerados.

2. **Módulo Administrativo / Organizador:**
   * Gerenciamento e cadastro de novos eventos (data, local, descrição, imagem).
   * Configuração de lotes e quantidade de ingressos.
   * Módulo de validação/check-in de bilhetes.
   * Relatórios e indicadores de público por evento.

## Instalação

### Pré-requisitos
* **Git** instalado na máquina.
* **Node.js** (versão 18+) ou **Python** (versão 3.10+), dependendo do ambiente configurado.

### Passos para Instalação

1. **Clonar o repositório:**
   ```bash
   git clone [https://github.com/matheush0782/nassauTickets.git](https://github.com/matheush0782/nassauTickets.git)
