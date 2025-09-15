<?php

namespace App\Mail;

use App\Models\Order;
use App\Models\Proposal;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class NewProposalNotification extends Mailable
{
    use Queueable, SerializesModels;

    public Proposal $proposal;
    public Order $order;
    public User $client;

    /**
     * Create a new message instance.
     */
    public function __construct(Proposal $proposal, Order $order, User $client)
    {
        $this->proposal = $proposal;
        $this->order = $order;
        $this->client = $client;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Nova proposta recebida no Cotaja! 💼',
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.new-proposal',
            with: [
                'proposal' => $this->proposal,
                'order' => $this->order,
                'client' => $this->client,
                'provider' => $this->proposal->provider,
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
}