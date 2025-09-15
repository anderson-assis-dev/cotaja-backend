<?php

namespace App\Console\Commands;

use App\Mail\WelcomeEmail;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class TestEmailCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'test:email {email}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Test email sending functionality';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $email = $this->argument('email');
        
        // Criar um usuário temporário para teste
        $user = new User([
            'name' => 'Usuário Teste',
            'email' => $email,
            'profile_type' => 'client'
        ]);
        
        try {
            Mail::to($email)->send(new WelcomeEmail($user));
            $this->info("E-mail de teste enviado com sucesso para: {$email}");
        } catch (\Exception $e) {
            $this->error("Erro ao enviar e-mail: " . $e->getMessage());
        }
    }
}