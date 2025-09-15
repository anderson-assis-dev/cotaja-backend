<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bem-vindo ao Cotaja!</title>
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
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
        .welcome-message {
            font-size: 18px;
            margin-bottom: 25px;
            color: #2c3e50;
        }
        .profile-section {
            background-color: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin: 25px 0;
            border-radius: 0 5px 5px 0;
        }
        .profile-section h2 {
            color: #667eea;
            margin-top: 0;
            font-size: 20px;
        }
        .steps {
            margin: 20px 0;
        }
        .steps h3 {
            color: #2c3e50;
            font-size: 16px;
            margin-bottom: 10px;
        }
        .steps ol {
            padding-left: 20px;
        }
        .steps li {
            margin-bottom: 8px;
            color: #555;
        }
        .tips {
            background-color: #e8f5e8;
            border: 1px solid #4caf50;
            border-radius: 5px;
            padding: 15px;
            margin: 20px 0;
        }
        .tips h3 {
            color: #4caf50;
            margin-top: 0;
            font-size: 16px;
        }
        .tips ul {
            margin: 0;
            padding-left: 20px;
        }
        .tips li {
            margin-bottom: 5px;
            color: #2e7d32;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
            color: #667eea;
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
            <h1>Bem-vindo ao Cotaja!</h1>
            <p>Conectando clientes e prestadores de serviços</p>
        </div>
        
        <div class="content">
            <div class="welcome-message">
                Olá <strong>{{ $user->name }}</strong>! 🎉
            </div>
            
            <p>É um prazer tê-lo conosco! O Cotaja é a plataforma que conecta clientes e prestadores de serviços de forma simples e eficiente.</p>
            
            <div class="profile-section">
                <h2>{{ $instructions['title'] }}</h2>
                
                <div class="steps">
                    <h3>📋 Como começar:</h3>
                    <ol>
                        @foreach($instructions['steps'] as $step)
                            <li>{{ $step }}</li>
                        @endforeach
                    </ol>
                </div>
                
                <div class="tips">
                    <h3>💡 Dicas importantes:</h3>
                    <ul>
                        @foreach($instructions['tips'] as $tip)
                            <li>{{ $tip }}</li>
                        @endforeach
                    </ul>
                </div>
            </div>
            
            <div style="text-align: center;">
                <a href="https://srv1009490.hstgr.cloud" class="cta-button">
                    🚀 Acessar o Cotaja
                </a>
            </div>
            
            <p>Se você tiver alguma dúvida, não hesite em entrar em contato conosco. Estamos aqui para ajudar!</p>
            
            <p>Bem-vindo e boa sorte com seus projetos! 🎯</p>
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
