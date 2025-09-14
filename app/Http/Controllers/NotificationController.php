<?php

namespace App\Http\Controllers;

use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class NotificationController extends Controller
{
    protected NotificationService $notificationService;

    public function __construct(NotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
    }

    /**
     * Lista todas as notificações do usuário
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $unreadOnly = $request->boolean('unread_only', false);
        
        $notifications = $this->notificationService->getUserNotifications(
            $user->id, 
            $unreadOnly
        );

        return response()->json([
            'success' => true,
            'notifications' => $notifications,
            'unread_count' => $this->notificationService->getUnreadCount($user->id)
        ]);
    }

    /**
     * Conta notificações não lidas
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $user = $request->user();
        $count = $this->notificationService->getUnreadCount($user->id);

        return response()->json([
            'success' => true,
            'unread_count' => $count
        ]);
    }

    /**
     * Marca uma notificação como lida
     */
    public function markAsRead(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        
        $success = $this->notificationService->markAsRead($id, $user->id);

        if (!$success) {
            return response()->json([
                'success' => false,
                'message' => 'Notificação não encontrada'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Notificação marcada como lida'
        ]);
    }

    /**
     * Marca todas as notificações como lidas
     */
    public function markAllAsRead(Request $request): JsonResponse
    {
        $user = $request->user();
        
        $this->notificationService->markAllAsRead($user->id);

        return response()->json([
            'success' => true,
            'message' => 'Todas as notificações foram marcadas como lidas'
        ]);
    }
}
