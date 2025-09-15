<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nova Proposta - Cotaja</title>
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
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
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
        .proposal-details {
            background-color: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 20px;
            margin: 25px 0;
            border-radius: 0 5px 5px 0;
        }
        .proposal-details h2 {
            color: #3b82f6;
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
        .provider-info {
            background-color: #f0f9ff;
            border: 1px solid #0ea5e9;
            border-radius: 5px;
            padding: 15px;
            margin: 20px 0;
        }
        .provider-info h3 {
            color: #0ea5e9;
            margin-top: 0;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
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
            color: #3b82f6;
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
        .price-highlight {
            background-color: #dcfce7;
            color: #166534;
            padding: 10px;
            border-radius: 5px;
            font-size: 18px;
            font-weight: bold;
            text-align: center;
            margin: 15px 0;
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
            <h1>Nova Proposta Recebida! 💼</h1>
            <p>Alguém está interessado no seu projeto</p>
        </div>
        
        <div class="content">
            <p><strong>Olá {{ $client->name }}!</strong></p>
            
            <p>Ótimas notícias! Você recebeu uma nova proposta para sua demanda <strong>"{{ $order->title }}"</strong>.</p>
            
            <div class="proposal-details">
                <h2>📋 Detalhes da Proposta</h2>
                
                <div class="detail-row">
                    <div class="detail-label">Proposta de:</div>
                    <div class="detail-value">{{ $proposal->provider->name }}</div>
                </div>
                
                <div class="detail-row">
                    <div class="detail-label">Valor:</div>
                    <div class="detail-value">
                        <div class="price-highlight">
                            R$ {{ number_format($proposal->price, 2, ',', '.') }}
                        </div>
                    </div>
                </div>
                
                <div class="detail-row">
                    <div class="detail-label">Prazo:</div>
                    <div class="detail-value">{{ $proposal->deadline }} dias</div>
                </div>
                
                <div class="detail-row">
                    <div class="detail-label">Descrição:</div>
                    <div class="detail-value">{{ $proposal->description }}</div>
                </div>
            </div>
            
            <div class="provider-info">
                <h3>👤 Sobre o Prestador</h3>
                <div class="detail-row">
                    <div class="detail-label">Nome:</div>
                    <div class="detail-value">{{ $proposal->provider->name }}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Telefone:</div>
                    <div class="detail-value">{{ $proposal->provider->phone }}</div>
                </div>
                @if($proposal->provider->service_categories)
                <div class="detail-row">
                    <div class="detail-label">Especialidades:</div>
                    <div class="detail-value">{{ implode(', ', $proposal->provider->service_categories) }}</div>
                </div>
                @endif
            </div>
            
            <div style="text-align: center;">
                <a href="https://srv1009490.hstgr.cloud" class="cta-button">
                    🚀 Ver Proposta Completa
                </a>
            </div>
            
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 5px; padding: 15px; margin: 20px 0;">
                <h3 style="color: #92400e; margin-top: 0;">💡 Próximos passos:</h3>
                <ul style="color: #92400e; margin: 0; padding-left: 20px;">
                    <li>Analise a proposta com cuidado</li>
                    <li>Verifique o perfil e especialidades do prestador</li>
                    <li>Compare com outras propostas recebidas</li>
                    <li>Entre em contato para esclarecer dúvidas</li>
                    <li>Escolha a melhor proposta para seu projeto</li>
                </ul>
            </div>
            
            <p>Acesse o Cotaja para ver todos os detalhes da proposta e tomar sua decisão!</p>
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
