# WhatsApp do responsável

Novo campo obrigatório no cadastro por e-mail; novos responsáveis Google completam uma etapa no painel antes de entrar. Validação de celular brasileiro (DDD reconhecido e 11 dígitos, incluindo 9), máscara e armazenamento com código 55. Formato não comprova existência de WhatsApp.

Contato pessoal separado do telefone público: tabela privada `responsible_contacts`, vinculada a usuário e loja. RPCs só permitem consultar/salvar o próprio contato pendente; leitura administrativa valida a permissão atual de plataforma em auth.users. Nenhuma chave administrativa no frontend. Não há preenchimento retroativo.

Novas lojas assistidas podem ser criadas sem telefone. O responsável preenche após ativar a conta; contas e convites anteriores à migração continuam entrando sem exigência retroativa. Não se inventam números e o telefone público permanece intacto.

O painel administrativo mostra o contato e abre wa.me sem mensagem automática. Conversões aguardam a conclusão do contato; uma reivindicação atômica por loja impede repetição entre abas/dispositivos para esses novos cadastros. Os eventos continuam sem incluir telefone. A entrega dos eventos continua best effort, como no fluxo existente.

Validações: 171 testes automatizados, build/TypeScript, lint sem erros (21 avisos preexistentes). Testes SQL transacionais com rollback validam número inválido, pendência, persistência, telefone público intacto, conta antiga, criação assistida, isolamento, permissões e reivindicação única de conversão. Não equivalem a login real Google ou consumo de convite; esses fluxos não tiveram autenticação real executada nesta entrega.
