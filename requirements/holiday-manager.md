# Gestor de feriados

Aplicar `supabase/migrations/20261018100000_employee_holiday_ledger.sql` antes de disponibilizar esta versão. A migração transforma cada dia dos saldos atuais de `employee_ff_balances` num registo individual de origem desconhecida, sem atribuir datas inventadas. Não fixa o saldo de nenhum enfermeiro.

O separador **Feriados** permite consultar o calendário anual, filtrar por enfermeiro e estado, consultar todos os anos e criar/editar/apagar associações manualmente. Os registos sem data aparecem em qualquer ano. Os totais incluem todos os anos, incluindo enfermeiros inativos. Cada registo representa um dia de compensação. Um dia já usado pode ser identificado ou corrigido, mas só é libertado corrigindo e revalidando o horário em que foi descontado.

A ação **Validar horário** contabiliza os turnos de `schedule_entries` desse mês. Guardar células, gerar ou importar horários não movimenta saldos. Mantém-se a regra anterior: um dia por feriado trabalhado, dois quando coincide com sábado ou domingo. F, FF, Fe, B e FA não são trabalho. Os FF consomem primeiro os créditos de origem desconhecida e depois os mais antigos; um feriado com data posterior ao desconto não pode ser usado. Um feriado identificado manualmente para a mesma data conta para os dias a creditar.

Revalidar reconcilia créditos e descontos numa transação, com bloqueio por organização. Saldo insuficiente ou remoção de um crédito já usado noutro horário abortam toda a contabilização. Os avisos de distribuição continuam a ser apresentados separadamente. A grelha mostra o saldo confirmado e liga ao gestor para ajustes manuais.

A edição e contabilização são exclusivas de administradores, verificadas também na base de dados. Os restantes membros podem consultar os registos da sua organização. O saldo agregado antigo mantém-se atualizado para compatibilidade com a grelha e impressão.

Executar `npm run test:holidays` com Node compatível com o projeto (>=20.9). Os testes usam PostgreSQL em memória (PGlite), aplicam a migração real sobre um esquema isolado e verificam migração, créditos, revalidações, descontos, correções, rollback, operações manuais, permissões e isolamento entre organizações. Não usam dados nem credenciais reais.
