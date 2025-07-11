<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;

Route::get("/", function () {
    return view("welcome");
});

// Rotas públicas de autenticação
Route::post("/register", [AuthController::class, "register"]);
Route::post("/login", [AuthController::class, "login"]);

// Rotas protegidas (requerem autenticação)
Route::middleware("auth:sanctum")->group(function () {
    Route::post("/logout", [AuthController::class, "logout"]);
    Route::get("/me", [AuthController::class, "me"]);
    Route::put("/profile", [AuthController::class, "updateProfile"]);
    Route::put("/profile-type", [AuthController::class, "updateProfileType"]);
});

Route::middleware("auth:sanctum")->get("/user", function (Request $request) {
    return $request->user();
});
