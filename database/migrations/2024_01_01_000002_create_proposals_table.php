<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('proposals', function (Blueprint $table) {
            $table->id();
            $table->decimal('price', 10, 2);
            $table->string('deadline');
            $table->text('description');
            $table->enum('status', ['pending', 'accepted', 'rejected', 'withdrawn'])->default('pending');
            $table->foreignId('order_id')->constrained('orders')->onDelete('cascade');
            $table->foreignId('provider_id')->constrained('users')->onDelete('cascade');
            $table->timestamps();
        });

        // Adicionar foreign key para accepted_proposal_id na tabela orders
        Schema::table('orders', function (Blueprint $table) {
            $table->foreign('accepted_proposal_id')->references('id')->on('proposals')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['accepted_proposal_id']);
        });
        
        Schema::dropIfExists('proposals');
    }
}; 