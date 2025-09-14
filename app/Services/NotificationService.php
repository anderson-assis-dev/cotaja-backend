<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;
use App\Models\Order;
use App\Models\Proposal;
use Kreait\Firebase\Factory;
use Kreait\Firebase\Messaging\CloudMessage;
use Kreait\Firebase\Messaging\Notification as FirebaseNotification;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    private $messaging;

    public function __construct()
    {
        try {
            // Configurar Firebase (você precisará adicionar as credenciais)
            $factory = (new Factory)
                ->withServiceAccount(config('firebase.credentials'))
                ->withProjectId(config('firebase.project_id'));
            
            $this->messaging = $factory->createMessaging();
        } catch (\Exception $e) {
            Log::error('Erro ao inicializar Firebase:', ['error' => $e->getMessage()]);
            $this->messaging = null;
        }
    }
    /**
     * Notifica providers sobre nova demanda
     */
    public function notifyProvidersAboutNewOrder(Order $order): void
    {
        // Busca providers que atendem a categoria da demanda
        $providers = User::providers()
            ->whereJsonContains('service_categories', $order->category)
            ->get();

        foreach ($providers as $provider) {
            $notification = Notification::create([
                'user_id' => $provider->id,
                'type' => Notification::TYPE_NEW_ORDER,
                'title' => 'Nova Demanda Disponível',
                'message' => "Nova demanda na categoria '{$order->category}': {$order->title}",
                'data' => [
                    'order_id' => $order->id,
                    'order_title' => $order->title,
                    'category' => $order->category,
                    'budget' => $order->budget,
                    'client_name' => $order->client->name,
                ]
            ]);

            // Enviar push notification
            $this->sendPushNotification(
                $provider,
                'Nova Demanda Disponível',
                "Nova demanda na categoria '{$order->category}': {$order->title}",
                [
                    'type' => 'new_order',
                    'order_id' => $order->id,
                    'category' => $order->category,
                ]
            );
        }
    }

    /**
     * Notifica cliente sobre nova proposta
     */
    public function notifyClientAboutNewProposal(Proposal $proposal): void
    {
        $order = $proposal->order;
        $provider = $proposal->provider;

        $notification = Notification::create([
            'user_id' => $order->client_id,
            'type' => Notification::TYPE_NEW_PROPOSAL,
            'title' => 'Nova Proposta Recebida',
            'message' => "Você recebeu uma nova proposta de {$provider->name} para '{$order->title}'",
            'data' => [
                'proposal_id' => $proposal->id,
                'order_id' => $order->id,
                'order_title' => $order->title,
                'provider_name' => $provider->name,
                'proposal_price' => $proposal->price,
                'proposal_deadline' => $proposal->deadline,
            ]
        ]);

        // Enviar push notification
        $this->sendPushNotification(
            $order->client,
            'Nova Proposta Recebida',
            "Você recebeu uma nova proposta de {$provider->name}",
            [
                'type' => 'new_proposal',
                'proposal_id' => $proposal->id,
                'order_id' => $order->id,
            ]
        );
    }

    /**
     * Notifica provider sobre proposta aceita
     */
    public function notifyProviderAboutAcceptedProposal(Proposal $proposal): void
    {
        $order = $proposal->order;

        Notification::create([
            'user_id' => $proposal->provider_id,
            'type' => Notification::TYPE_PROPOSAL_ACCEPTED,
            'title' => 'Proposta Aceita!',
            'message' => "Sua proposta para '{$order->title}' foi aceita!",
            'data' => [
                'proposal_id' => $proposal->id,
                'order_id' => $order->id,
                'order_title' => $order->title,
                'client_name' => $order->client->name,
                'accepted_price' => $proposal->price,
            ]
        ]);
    }

    /**
     * Notifica provider sobre proposta rejeitada
     */
    public function notifyProviderAboutRejectedProposal(Proposal $proposal): void
    {
        $order = $proposal->order;

        Notification::create([
            'user_id' => $proposal->provider_id,
            'type' => Notification::TYPE_PROPOSAL_REJECTED,
            'title' => 'Proposta Rejeitada',
            'message' => "Sua proposta para '{$order->title}' foi rejeitada.",
            'data' => [
                'proposal_id' => $proposal->id,
                'order_id' => $order->id,
                'order_title' => $order->title,
            ]
        ]);
    }

    /**
     * Busca notificações do usuário
     */
    public function getUserNotifications(int $userId, bool $unreadOnly = false)
    {
        $query = Notification::where('user_id', $userId)
            ->orderBy('created_at', 'desc');

        if ($unreadOnly) {
            $query->unread();
        }

        return $query->get();
    }

    /**
     * Marca notificação como lida
     */
    public function markAsRead(int $notificationId, int $userId): bool
    {
        $notification = Notification::where('id', $notificationId)
            ->where('user_id', $userId)
            ->first();

        if (!$notification) {
            return false;
        }

        $notification->markAsRead();
        return true;
    }

    /**
     * Marca todas as notificações do usuário como lidas
     */
    public function markAllAsRead(int $userId): void
    {
        Notification::where('user_id', $userId)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);
    }

    /**
     * Conta notificações não lidas do usuário
     */
    public function getUnreadCount(int $userId): int
    {
        return Notification::where('user_id', $userId)
            ->unread()
            ->count();
    }

    /**
     * Envia notificação push via Firebase
     */
    private function sendPushNotification(User $user, string $title, string $body, array $data = []): void
    {
        try {
            // Verificar se o usuário tem token FCM
            if (!$user->fcm_token || !$this->messaging) {
                Log::info("Usuário {$user->id} não tem token FCM ou Firebase não configurado");
                return;
            }

            // Criar notificação Firebase
            $notification = FirebaseNotification::create($title, $body);
            
            // Criar mensagem
            $message = CloudMessage::withTarget('token', $user->fcm_token)
                ->withNotification($notification)
                ->withData($data);

            // Enviar notificação
            $this->messaging->send($message);
            
            Log::info("Push notification enviada para usuário {$user->id}", [
                'title' => $title,
                'body' => $body,
                'data' => $data
            ]);

        } catch (\Exception $e) {
            Log::error("Erro ao enviar push notification para usuário {$user->id}", [
                'error' => $e->getMessage(),
                'title' => $title,
                'body' => $body
            ]);
        }
    }
}
