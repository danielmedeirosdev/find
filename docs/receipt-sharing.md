# Compartilhamento de comprovante

Após confirmar um agendamento interno pet, a loja escolhe Só mensagem ou Mensagem + imagem. Ambas usam os dados confirmados do mesmo ReceiptView, inclusive valor final, data, profissional, observação e Táxi Pet.

Só mensagem abre wa.me do cliente com texto preenchido. Mensagem + imagem prepara um PNG localmente e chama Web Share com arquivo e texto; a pessoa escolhe WhatsApp e destinatário. O protocolo wa.me não permite anexar arquivos nem o Web Share permite escolher automaticamente um contato. Quando o navegador não suporta arquivos ou a chamada falha, a tela oferece baixar o PNG e anexá-lo manualmente à mensagem. Cancelar o compartilhamento é tratado como cancelamento normal.

Imagem e URL blob são geradas no próprio aparelho, sem upload para serviço externo; o URL temporário é revogado ao desmontar. Nenhuma mensagem é enviada automaticamente.

Validação: build/TypeScript, lint e testes para conteúdo/valor confirmado, normalização de telefone (inclusive DDD 55), quebra de texto e informações de transporte. Compartilhamento real com WhatsApp instalado e anexação manual ainda não executados; dependem do navegador/aparelho. Não declarar entrega a destinatário como testada.

A publicação inclui o onboarding autorizado pelo usuário sem aguardar teste real do Google. As limitações remanescentes estão registradas em initial-setup-review.md.
