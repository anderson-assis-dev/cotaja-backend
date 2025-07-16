<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Proposal;
use App\Models\Attachment;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class OrderController extends Controller
{
    /**
     * Listar pedidos do usuário autenticado
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Order::with(['client', 'provider', 'proposals.provider', 'attachments']);

        if ($user->isClient()) {
            $query->byClient($user->id);
        } elseif ($user->isProvider()) {
            $query->byProvider($user->id);
        }

        // Filtros
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('category')) {
            $query->byCategory($request->category);
        }

        $orders = $query->orderBy('created_at', 'desc')->paginate(10);

        return response()->json([
            'success' => true,
            'data' => $orders
        ]);
    }

    /**
     * Criar novo pedido
     */
    public function store(Request $request): JsonResponse
    {
        Log::info('Criando pedido', $request->all());

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'category' => 'required|string|max:100',
            'budget' => 'required|numeric|min:0',
            'deadline' => 'required|integer|min:1|max:365', // Número de dias (1 a 365)
            'address' => 'required|string',
            'attachments.*' => 'nullable|file|max:10240', // 10MB max
        ]);

        if ($validator->fails()) {
            Log::error('Validação falhou', $validator->errors()->toArray());
            return response()->json([
                'success' => false,
                'message' => 'Dados inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = $request->user();

        if (!$user->isClient()) {
            return response()->json([
                'success' => false,
                'message' => 'Apenas clientes podem criar pedidos'
            ], 403);
        }

        try {
            $order = Order::create([
                'title' => $request->title,
                'description' => $request->description,
                'category' => $request->category,
                'budget' => $request->budget,
                'deadline' => $request->deadline,
                'address' => $request->address,
                'client_id' => $user->id,
                'status' => Order::STATUS_OPEN,
            ]);

            Log::info('Pedido criado com sucesso', ['order_id' => $order->id]);

            // Processar anexos
            if ($request->hasFile('attachments')) {
                foreach ($request->file('attachments') as $file) {
                    $filename = time() . '_' . $file->getClientOriginalName();
                    $path = $file->storeAs('attachments/orders/' . $order->id, $filename, 'public');

                    Attachment::create([
                        'filename' => $filename,
                        'original_name' => $file->getClientOriginalName(),
                        'file_path' => $path,
                        'file_size' => $file->getSize(),
                        'mime_type' => $file->getMimeType(),
                        'attachable_type' => Order::class,
                        'attachable_id' => $order->id,
                    ]);
                }
            }

            $order->load(['client', 'attachments']);

            return response()->json([
                'success' => true,
                'message' => 'Pedido criado com sucesso!',
                'data' => $order
            ], 201);
        } catch (\Exception $e) {
            Log::error('Erro ao criar pedido', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro interno do servidor'
            ], 500);
        }
    }

    /**
     * Exibir pedido específico
     */
    public function show(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $order = Order::with(['client', 'provider', 'proposals.provider', 'attachments'])
            ->findOrFail($id);

        // Verificar se o usuário tem permissão para ver o pedido
        if ($user->isClient() && $order->client_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado'
            ], 403);
        }

        if ($user->isProvider() && $order->provider_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado'
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => $order
        ]);
    }

    /**
     * Atualizar pedido
     */
    public function update(Request $request, $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'category' => 'sometimes|string|max:100',
            'budget' => 'sometimes|numeric|min:0',
            'deadline' => 'sometimes|integer|min:1|max:365', // Número de dias (1 a 365)
            'address' => 'sometimes|string',
            'status' => 'sometimes|in:open,in_progress,completed,cancelled',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Dados inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = $request->user();
        $order = Order::findOrFail($id);

        // Verificar se o usuário tem permissão para atualizar o pedido
        if ($user->isClient() && $order->client_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado'
            ], 403);
        }

        $order->update($request->only([
            'title', 'description', 'category', 'budget', 
            'deadline', 'address', 'status'
        ]));

        $order->load(['client', 'provider', 'proposals.provider', 'attachments']);

        return response()->json([
            'success' => true,
            'message' => 'Pedido atualizado com sucesso!',
            'data' => $order
        ]);
    }

    /**
     * Excluir pedido
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $order = Order::findOrFail($id);

        // Verificar se o usuário tem permissão para excluir o pedido
        if ($user->isClient() && $order->client_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado'
            ], 403);
        }

        // Verificar se o pedido pode ser excluído
        if ($order->status !== Order::STATUS_OPEN) {
            return response()->json([
                'success' => false,
                'message' => 'Não é possível excluir um pedido que não está aberto'
            ], 400);
        }

        // Excluir anexos
        foreach ($order->attachments as $attachment) {
            Storage::disk('public')->delete($attachment->file_path);
        }

        $order->delete();

        return response()->json([
            'success' => true,
            'message' => 'Pedido excluído com sucesso!'
        ]);
    }

    /**
     * Listar pedidos disponíveis para prestadores
     */
    public function available(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->isProvider()) {
            return response()->json([
                'success' => false,
                'message' => 'Apenas prestadores podem ver pedidos disponíveis'
            ], 403);
        }

        $query = Order::with(['client', 'proposals.provider', 'attachments'])
            ->open()
            ->whereDoesntHave('proposals', function ($q) use ($user) {
                $q->where('provider_id', $user->id);
            });

        // Filtros
        if ($request->has('category')) {
            $query->byCategory($request->category);
        }

        $orders = $query->orderBy('created_at', 'desc')->paginate(10);

        return response()->json([
            'success' => true,
            'data' => $orders
        ]);
    }

    /**
     * Iniciar leilão do pedido
     */
    public function startAuction(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $order = Order::findOrFail($id);

        // Verificar se o usuário é o cliente do pedido
        if ($order->client_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Apenas o cliente pode iniciar o leilão'
            ], 403);
        }

        // Verificar se o pedido está aberto
        if ($order->status !== Order::STATUS_OPEN) {
            return response()->json([
                'success' => false,
                'message' => 'Apenas pedidos abertos podem iniciar leilão'
            ], 400);
        }

        // Verificar se já existe um leilão ativo
        if ($order->auction_started_at) {
            return response()->json([
                'success' => false,
                'message' => 'Leilão já foi iniciado'
            ], 400);
        }

        try {
            $order->update([
                'auction_started_at' => now(),
                'auction_ends_at' => now()->addDays(7), // Leilão dura 7 dias
            ]);

            $order->load(['client', 'proposals.provider', 'attachments']);

            return response()->json([
                'success' => true,
                'message' => 'Leilão iniciado com sucesso!',
                'data' => $order
            ]);
        } catch (\Exception $e) {
            Log::error('Erro ao iniciar leilão', [
                'order_id' => $order->id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao iniciar leilão'
            ], 500);
        }
    }

    /**
     * Obter pedidos recentes do cliente
     */
    public function recent(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->isClient()) {
            return response()->json([
                'success' => false,
                'message' => 'Apenas clientes podem ver pedidos recentes'
            ], 403);
        }

        $orders = Order::with(['client', 'proposals.provider', 'attachments'])
            ->byClient($user->id)
            ->where('created_at', '>=', now()->subDays(30)) // Últimos 30 dias
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $orders
        ]);
    }

    /**
     * Obter estatísticas do cliente
     */
    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->isClient()) {
            return response()->json([
                'success' => false,
                'message' => 'Apenas clientes podem ver estatísticas'
            ], 403);
        }

        $stats = [
            'total_orders' => Order::byClient($user->id)->count(),
            'open_orders' => Order::byClient($user->id)->open()->count(),
            'completed_orders' => Order::byClient($user->id)->where('status', 'completed')->count(),
            'total_spent' => Order::byClient($user->id)->where('status', 'completed')->sum('budget'),
        ];

        return response()->json([
            'success' => true,
            'data' => $stats
        ]);
    }
} 