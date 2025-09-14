<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Firebase Project Configuration
    |--------------------------------------------------------------------------
    |
    | Configurações do projeto Firebase para notificações push
    |
    */

    'project_id' => env('FIREBASE_PROJECT_ID', 'cotaja-app'),

    /*
    |--------------------------------------------------------------------------
    | Firebase Service Account
    |--------------------------------------------------------------------------
    |
    | Caminho para o arquivo JSON das credenciais do Firebase
    | Você deve baixar este arquivo do console do Firebase
    |
    */

    'credentials' => env('FIREBASE_CREDENTIALS', storage_path('app/firebase/service-account.json')),

    /*
    |--------------------------------------------------------------------------
    | Firebase Database URL
    |--------------------------------------------------------------------------
    |
    | URL do Firebase Realtime Database (se usar)
    |
    */

    'database_url' => env('FIREBASE_DATABASE_URL'),
];
