<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ProposalController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\NotificationController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Rotas públicas de autenticação
Route::post("/register", [AuthController::class, "register"]);
Route::post("/login", [AuthController::class, "login"]);

// Rotas protegidas (requerem autenticação)
Route::middleware("auth:sanctum")->group(function () {
    Route::post("/logout", [AuthController::class, "logout"]);
    Route::get("/me", [AuthController::class, "me"]);
    Route::put("/profile", [AuthController::class, "updateProfile"]);
    Route::put("/profile-type", [AuthController::class, "updateProfileType"]);
    Route::post("/fcm-token", [AuthController::class, "saveFcmToken"]);

    // Rotas de Pedidos
    Route::prefix('orders')->group(function () {
        Route::get('/', [OrderController::class, 'index']);
        Route::post('/', [OrderController::class, 'store']);
        Route::get('/available', [OrderController::class, 'available']);
        Route::get('/recent', [OrderController::class, 'recent']);
        Route::get('/stats', [OrderController::class, 'stats']);
        Route::get('/{id}', [OrderController::class, 'show']);
        Route::put('/{id}', [OrderController::class, 'update']);
        Route::delete('/{id}', [OrderController::class, 'destroy']);
        Route::post('/{id}/start-auction', [OrderController::class, 'startAuction']);
    });

    // Rotas de Propostas
    Route::prefix('proposals')->group(function () {
        Route::get('/', [ProposalController::class, 'index']);
        Route::post('/', [ProposalController::class, 'store']);
        Route::get('/{id}', [ProposalController::class, 'show']);
        Route::put('/{id}', [ProposalController::class, 'update']);
        Route::post('/{id}/accept', [ProposalController::class, 'accept']);
        Route::post('/{id}/reject', [ProposalController::class, 'reject']);
        Route::post('/{id}/withdraw', [ProposalController::class, 'withdraw']);
    });

    // Rotas de Serviços
    Route::prefix('services')->group(function () {
        Route::get('/', [ServiceController::class, 'index']);
        Route::post('/', [ServiceController::class, 'store']);
        Route::get('/available', [ServiceController::class, 'available']);
        Route::get('/search-providers', [ServiceController::class, 'searchProviders']);
        Route::get('/{id}', [ServiceController::class, 'show']);
        Route::put('/{id}', [ServiceController::class, 'update']);
        Route::delete('/{id}', [ServiceController::class, 'destroy']);
    });

    // Rotas de Notificações
    Route::prefix('notifications')->group(function () {
        Route::get('/', [NotificationController::class, 'index']);
        Route::get('/unread-count', [NotificationController::class, 'unreadCount']);
        Route::put('/{id}/read', [NotificationController::class, 'markAsRead']);
        Route::put('/mark-all-read', [NotificationController::class, 'markAllAsRead']);
    });
});

Route::middleware("auth:sanctum")->get("/user", function (Request $request) {
    return $request->user();
});
