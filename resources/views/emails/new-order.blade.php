<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nova Demanda - Cotaja</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .container {
            background-color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 300;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .content {
            padding: 30px;
        }
        .order-details {
            background-color: #f0f9ff;
            border-left: 4px solid #0ea5e9;
            padding: 20px;
            margin: 25px 0;
            border-radius: 0 5px 5px 0;
        }
        .order-details h2 {
            color: #0ea5e9;
            margin-top: 0;
            font-size: 20px;
        }
        .detail-row {
            display: flex;
            margin-bottom: 10px;
            align-items: flex-start;
        }
        .detail-label {
            font-weight: bold;
            color: #374151;
            min-width: 120px;
            margin-right: 10px;
        }
        .detail-value {
            color: #6b7280;
            flex: 1;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 25px;
            font-weight: bold;
            margin: 20px 0;
            transition: transform 0.2s;
        }
        .cta-button:hover {
            transform: translateY(-2px);
        }
        .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }
        .footer a {
            color: #10b981;
            text-decoration: none;
        }
        .logo-container {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 15px;
        }
        .logo-image {
            width: 50px;
            height: 50px;
            margin-right: 10px;
            border-radius: 8px;
        }
        .logo-text {
            font-size: 24px;
            font-weight: bold;
            color: white;
        }
        .urgency-badge {
            background-color: #fef3c7;
            color: #92400e;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: bold;
            display: inline-block;
            margin-left: 10px;
        }
        @media (max-width: 600px) {
            body {
                padding: 10px;
            }
            .header, .content, .footer {
                padding: 20px;
            }
            .header h1 {
                font-size: 24px;
            }
            .detail-row {
                flex-direction: column;
            }
            .detail-label {
                min-width: auto;
                margin-bottom: 5px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo-container">
                <img src="{{ asset('images/logo.png') }}" alt="Cotaja Logo" class="logo-image">
                <div class="logo-text">Cotaja</div>
            </div>
            <h1>Nova Demanda Disponível! 🎯</h1>
            <p>Uma nova oportunidade de trabalho está esperando por você</p>
        </div>
        
        <div class="content">
            <div class="order-details">
                <h2>📋 Detalhes da Demanda</h2>
                
                <div class="detail-row">
                    <div class="detail-label">Título:</div>
                    <div class="detail-value">{{ $order->title }}</div>
                </div>
                
                <div class="detail-row">
                    <div class="detail-label">Descrição:</div>
                    <div class="detail-value">{{ $order->description }}</div>
                </div>
                
                <div class="detail-row">
                    <div class="detail-label">Categoria:</div>
                    <div class="detail-value">{{ $order->category }}</div>
                </div>
                
                <div class="detail-row">
                    <div class="detail-label">Orçamento:</div>
                    <div class="detail-value">R$ {{ number_format($order->budget, 2, ',', '.') }}</div>
                </div>
                
                <div class="detail-row">
                    <div class="detail-label">Prazo:</div>
                    <div class="detail-value">{{ $order->deadline }} dias</div>
                </div>
                
                <div class="detail-row">
                    <div class="detail-label">Localização:</div>
                    <div class="detail-value">{{ $order->address }}</div>
                </div>
                
                <div class="detail-row">
                    <div class="detail-label">Cliente:</div>
                    <div class="detail-value">{{ $order->client->name }}</div>
                </div>
            </div>
            
            <p><strong>Olá {{ $provider->name }}!</strong></p>
            
            <p>Uma nova demanda foi cadastrada na sua área de atuação e pode ser perfeita para você!</p>
            
            <div style="text-align: center;">
                <a href="https://srv1009490.hstgr.cloud" class="cta-button">
                    🚀 Ver Demanda e Enviar Proposta
                </a>
            </div>
            
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 5px; padding: 15px; margin: 20px 0;">
                <h3 style="color: #92400e; margin-top: 0;">💡 Dicas para sua proposta:</h3>
                <ul style="color: #92400e; margin: 0; padding-left: 20px;">
                    <li>Seja específico sobre o que será feito</li>
                    <li>Defina um prazo realista</li>
                    <li>Mantenha um preço competitivo</li>
                    <li>Responda rapidamente para aumentar suas chances</li>
                </ul>
            </div>
            
            <p>Não perca esta oportunidade! Acesse o Cotaja e envie sua proposta agora mesmo.</p>
        </div>
        
        <div class="footer">
            <p>
                <strong>Cotaja</strong> - Conectando talentos e necessidades<br>
                <a href="https://srv1009490.hstgr.cloud">srv1009490.hstgr.cloud</a>
            </p>
            <p style="margin-top: 15px; font-size: 12px; color: #999;">
                Este e-mail foi enviado automaticamente. Por favor, não responda a esta mensagem.
            </p>
        </div>
    </div>
</body>
</html>
