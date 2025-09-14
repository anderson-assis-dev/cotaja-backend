<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Proposal;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class ProposalController extends Controller
{
    protected NotificationService $notificationService;

    public function __construct(NotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
    }
    /**
     * Listar propostas do usuário autenticado
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Proposal::with(['order.client', 'provider']);

        if ($user->isProvider()) {
            $query->byProvider($user->id);
        } elseif ($user->isClient()) {
            $query->whereHas('order', function ($q) use ($user) {
                $q->where('client_id', $user->id);
            });
        }

        // Filtros
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('order_id')) {
            $query->byOrder($request->order_id);
        }

        $proposals = $query->orderBy('created_at', 'desc')->paginate(10);

        return response()->json([
            'success' => true,
            'data' => $proposals
        ]);
    }

    /**
     * Criar nova proposta
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'order_id' => 'required|exists:orders,id',
            'price' => 'required|numeric|min:0',
            'deadline' => 'required|string|max:100',
            'description' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Dados inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = $request->user();

        if (!$user->isProvider()) {
            return response()->json([
                'success' => false,
                'message' => 'Apenas prestadores podem criar propostas'
            ], 403);
        }

        $order = Order::findOrFail($request->order_id);

        // Verificar se o pedido está aberto
        if ($order->status !== Order::STATUS_OPEN) {
            return response()->json([
                'success' => false,
                'message' => 'Este pedido não está mais aceitando propostas'
            ], 400);
        }

        // Verificar se o prestador já enviou uma proposta para este pedido
        $existingProposal = Proposal::where('order_id', $request->order_id)
            ->where('provider_id', $user->id)
            ->first();

        if ($existingProposal) {
            return response()->json([
                'success' => false,
                'message' => 'Você já enviou uma proposta para este pedido'
            ], 400);
        }

        $proposal = Proposal::create([
            'order_id' => $request->order_id,
            'provider_id' => $user->id,
            'price' => $request->price,
            'deadline' => $request->deadline,
            'description' => $request->description,
            'status' => Proposal::STATUS_PENDING,
        ]);

        $proposal->load(['order.client', 'provider']);

        // Disparar notificação para o cliente
        $this->notificationService->notifyClientAboutNewProposal($proposal);

        return response()->json([
            'success' => true,
            'message' => 'Proposta enviada com sucesso!',
            'data' => $proposal
        ], 201);
    }

    /**
     * Exibir proposta específica
     */
    public function show(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $proposal = Proposal::with(['order.client', 'provider'])->findOrFail($id);

        // Verificar permissões
        if ($user->isProvider() && $proposal->provider_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado'
            ], 403);
        }

        if ($user->isClient() && $proposal->order->client_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado'
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => $proposal
        ]);
    }

    /**
     * Atualizar proposta
     */
    public function update(Request $request, $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'price' => 'sometimes|numeric|min:0',
            'deadline' => 'sometimes|string|max:100',
            'description' => 'sometimes|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Dados inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = $request->user();
        $proposal = Proposal::findOrFail($id);

        // Verificar se o usuário tem permissão para atualizar a proposta
        if ($user->isProvider() && $proposal->provider_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado'
            ], 403);
        }

        // Verificar se a proposta pode ser atualizada
        if ($proposal->status !== Proposal::STATUS_PENDING) {
            return response()->json([
                'success' => false,
                'message' => 'Não é possível atualizar uma proposta que não está pendente'
            ], 400);
        }

        $proposal->update($request->only(['price', 'deadline', 'description']));
        $proposal->load(['order.client', 'provider']);

        return response()->json([
            'success' => true,
            'message' => 'Proposta atualizada com sucesso!',
            'data' => $proposal
        ]);
    }

    /**
     * Aceitar proposta
     */
    public function accept(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $proposal = Proposal::with(['order'])->findOrFail($id);

        // Verificar se o usuário é o cliente do pedido
        if (!$user->isClient() || $proposal->order->client_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado'
            ], 403);
        }

        // Verificar se a proposta está pendente
        if ($proposal->status !== Proposal::STATUS_PENDING) {
            return response()->json([
                'success' => false,
                'message' => 'Esta proposta não pode ser aceita'
            ], 400);
        }

        // Verificar se o pedido está aberto
        if ($proposal->order->status !== Order::STATUS_OPEN) {
            return response()->json([
                'success' => false,
                'message' => 'Este pedido não está mais aceitando propostas'
            ], 400);
        }

        // Iniciar transação
        \DB::beginTransaction();

        try {
            // Aceitar a proposta
            $proposal->update(['status' => Proposal::STATUS_ACCEPTED]);

            // Rejeitar outras propostas do mesmo pedido
            Proposal::where('order_id', $proposal->order_id)
                ->where('id', '!=', $proposal->id)
                ->update(['status' => Proposal::STATUS_REJECTED]);

            // Atualizar o pedido
            $proposal->order->update([
                'status' => Order::STATUS_IN_PROGRESS,
                'provider_id' => $proposal->provider_id,
                'accepted_proposal_id' => $proposal->id,
            ]);

            \DB::commit();

            $proposal->load(['order.client', 'provider']);

            // Disparar notificação para o provider sobre proposta aceita
            $this->notificationService->notifyProviderAboutAcceptedProposal($proposal);

            // Disparar notificações para providers sobre propostas rejeitadas
            $rejectedProposals = Proposal::where('order_id', $proposal->order_id)
                ->where('id', '!=', $proposal->id)
                ->where('status', Proposal::STATUS_REJECTED)
                ->with('provider')
                ->get();

            foreach ($rejectedProposals as $rejectedProposal) {
                $this->notificationService->notifyProviderAboutRejectedProposal($rejectedProposal);
            }

            return response()->json([
                'success' => true,
                'message' => 'Proposta aceita com sucesso!',
                'data' => $proposal
            ]);
        } catch (\Exception $e) {
            \DB::rollback();
            return response()->json([
                'success' => false,
                'message' => 'Erro ao aceitar proposta'
            ], 500);
        }
    }

    /**
     * Rejeitar proposta
     */
    public function reject(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $proposal = Proposal::findOrFail($id);

        // Verificar se o usuário é o cliente do pedido
        if (!$user->isClient() || $proposal->order->client_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado'
            ], 403);
        }

        // Verificar se a proposta está pendente
        if ($proposal->status !== Proposal::STATUS_PENDING) {
            return response()->json([
                'success' => false,
                'message' => 'Esta proposta não pode ser rejeitada'
            ], 400);
        }

        $proposal->update(['status' => Proposal::STATUS_REJECTED]);

        return response()->json([
            'success' => true,
            'message' => 'Proposta rejeitada com sucesso!'
        ]);
    }

    /**
     * Cancelar proposta (prestador)
     */
    public function withdraw(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $proposal = Proposal::findOrFail($id);

        // Verificar se o usuário é o prestador da proposta
        if (!$user->isProvider() || $proposal->provider_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado'
            ], 403);
        }

        // Verificar se a proposta está pendente
        if ($proposal->status !== Proposal::STATUS_PENDING) {
            return response()->json([
                'success' => false,
                'message' => 'Esta proposta não pode ser cancelada'
            ], 400);
        }

        $proposal->update(['status' => Proposal::STATUS_WITHDRAWN]);

        return response()->json([
            'success' => true,
            'message' => 'Proposta cancelada com sucesso!'
        ]);
    }
} 