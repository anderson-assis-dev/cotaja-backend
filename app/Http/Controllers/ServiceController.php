<?php

namespace App\Http\Controllers;

use App\Models\Service;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class ServiceController extends Controller
{
    /**
     * Listar serviços do usuário autenticado
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Service::with(['provider']);

        if ($user->isProvider()) {
            $query->byProvider($user->id);
        }

        // Filtros
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('category')) {
            $query->byCategory($request->category);
        }

        $services = $query->orderBy('created_at', 'desc')->paginate(10);

        return response()->json([
            'success' => true,
            'data' => $services
        ]);
    }

    /**
     * Criar novo serviço
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'price' => 'required|numeric|min:0',
            'category' => 'required|string|max:100',
            'status' => 'sometimes|in:active,inactive,paused',
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
                'message' => 'Apenas prestadores podem criar serviços'
            ], 403);
        }

        $service = Service::create([
            'title' => $request->title,
            'description' => $request->description,
            'price' => $request->price,
            'category' => $request->category,
            'status' => $request->status ?? Service::STATUS_ACTIVE,
            'provider_id' => $user->id,
        ]);

        $service->load(['provider']);

        return response()->json([
            'success' => true,
            'message' => 'Serviço criado com sucesso!',
            'data' => $service
        ], 201);
    }

    /**
     * Exibir serviço específico
     */
    public function show(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $service = Service::with(['provider'])->findOrFail($id);

        // Verificar se o usuário tem permissão para ver o serviço
        if ($user->isProvider() && $service->provider_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado'
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => $service
        ]);
    }

    /**
     * Atualizar serviço
     */
    public function update(Request $request, $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'price' => 'sometimes|numeric|min:0',
            'category' => 'sometimes|string|max:100',
            'status' => 'sometimes|in:active,inactive,paused',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Dados inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = $request->user();
        $service = Service::findOrFail($id);

        // Verificar se o usuário tem permissão para atualizar o serviço
        if ($user->isProvider() && $service->provider_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado'
            ], 403);
        }

        $service->update($request->only([
            'title', 'description', 'price', 'category', 'status'
        ]));

        $service->load(['provider']);

        return response()->json([
            'success' => true,
            'message' => 'Serviço atualizado com sucesso!',
            'data' => $service
        ]);
    }

    /**
     * Excluir serviço
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $service = Service::findOrFail($id);

        // Verificar se o usuário tem permissão para excluir o serviço
        if ($user->isProvider() && $service->provider_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado'
            ], 403);
        }

        $service->delete();

        return response()->json([
            'success' => true,
            'message' => 'Serviço excluído com sucesso!'
        ]);
    }

    /**
     * Listar serviços disponíveis para clientes
     */
    public function available(Request $request): JsonResponse
    {
        $query = Service::with(['provider'])
            ->active();

        // Filtros
        if ($request->has('category')) {
            $query->byCategory($request->category);
        }

        if ($request->has('provider_id')) {
            $query->byProvider($request->provider_id);
        }

        $services = $query->orderBy('created_at', 'desc')->paginate(10);

        return response()->json([
            'success' => true,
            'data' => $services
        ]);
    }

    /**
     * Buscar prestadores por categoria
     */
    public function searchProviders(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'category' => 'required|string',
            'search' => 'sometimes|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Dados inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        $query = \App\Models\User::with(['services'])
            ->providers()
            ->whereHas('services', function ($q) use ($request) {
                $q->active()->byCategory($request->category);
            });

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $providers = $query->paginate(10);

        return response()->json([
            'success' => true,
            'data' => $providers
        ]);
    }
} 