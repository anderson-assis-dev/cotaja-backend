<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WelcomeEmail extends Mailable
{
    use Queueable, SerializesModels;

    public User $user;

    /**
     * Create a new message instance.
     */
    public function __construct(User $user)
    {
        $this->user = $user;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Bem-vindo ao Cotaja! 🎉',
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.welcome',
            with: [
                'user' => $this->user,
                'instructions' => $this->getInstructionsForProfile($this->user->profile_type),
            ],
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        return [];
    }

    /**
     * Get instructions based on user profile type
     */
    private function getInstructionsForProfile(?string $profileType): array
    {
        if ($profileType === 'provider') {
            return [
                'title' => 'Como Prestador de Serviços',
                'steps' => [
                    'Complete seu perfil com suas especialidades e categorias de serviços',
                    'Configure sua localização para receber pedidos da sua região',
                    'Acompanhe os pedidos disponíveis na aba "Oportunidades"',
                    'Envie propostas competitivas com preços e prazos realistas',
                    'Mantenha sua reputação com avaliações positivas dos clientes',
                    'Use o chat para se comunicar diretamente com os clientes'
                ],
                'tips' => [
                    'Seja específico nas suas propostas - detalhe o que será feito',
                    'Responda rapidamente às mensagens para aumentar suas chances',
                    'Mantenha preços competitivos mas justos para o seu trabalho',
                    'Tire fotos do antes e depois dos seus trabalhos para o portfólio'
                ]
            ];
        } else {
            return [
                'title' => 'Como Cliente',
                'steps' => [
                    'Crie pedidos detalhados descrevendo exatamente o que você precisa',
                    'Defina um orçamento realista para o seu projeto',
                    'Acompanhe as propostas recebidas na aba "Meus Pedidos"',
                    'Compare preços, prazos e avaliações dos prestadores',
                    'Escolha o prestador que melhor atende às suas necessidades',
                    'Use o chat para esclarecer dúvidas antes de fechar o negócio'
                ],
                'tips' => [
                    'Seja claro e detalhado na descrição do seu pedido',
                    'Defina um prazo realista para a conclusão do serviço',
                    'Verifique as avaliações e portfólio dos prestadores',
                    'Mantenha a comunicação ativa durante todo o processo'
                ]
            ];
        }
    }
}