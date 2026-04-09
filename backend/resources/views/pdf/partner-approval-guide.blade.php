<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Guide partenaire AfriPay</title>
    <style>
        body {
            font-family: DejaVu Sans, sans-serif;
            color: #10233f;
            font-size: 12px;
            line-height: 1.6;
            margin: 0;
        }

        .page {
            padding: 32px 40px;
        }

        .hero {
            background: #0f2f57;
            color: #ffffff;
            border-radius: 16px;
            padding: 24px 28px;
            margin-bottom: 24px;
        }

        h1, h2 {
            margin: 0 0 10px;
        }

        h1 {
            font-size: 24px;
        }

        h2 {
            font-size: 16px;
            color: #0f2f57;
        }

        .card {
            border: 1px solid #d8e2ef;
            border-radius: 14px;
            padding: 16px 18px;
            margin-bottom: 18px;
        }

        .label {
            color: #49617d;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        ul {
            margin: 10px 0 0 18px;
            padding: 0;
        }

        li {
            margin-bottom: 6px;
        }

        .footer {
            margin-top: 24px;
            font-size: 11px;
            color: #49617d;
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="hero">
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:1.5px; opacity:0.8;">AfriPay API onboarding</div>
            <h1>Guide d'activation partenaire</h1>
            <p style="margin:0; max-width:480px;">Ce document recapitule vos acces, les etapes de connexion a l'API et les points de controle a finaliser avant mise en production.</p>
        </div>

        <div class="card">
            <div class="label">Informations compte</div>
            <p><strong>Societe:</strong> {{ $companyName }}</p>
            <p><strong>Email:</strong> {{ $contactEmail }}</p>
            <p><strong>Site:</strong> {{ $website ?: 'Non renseigne' }}</p>
            <p><strong>Webhook:</strong> {{ $webhookUrl ?: 'A configurer' }}</p>
        </div>

        <div class="card">
            <div class="label">Acces API</div>
            <p><strong>APP KEY:</strong> {{ $appKey }}</p>
            <p><strong>APP SECRET:</strong> communique separement via le canal securise d'approbation.</p>
            <p><strong>Documentation:</strong> {{ $docsUrl }}</p>
        </div>

        <div class="card">
            <h2>Etapes recommandees</h2>
            <ul>
                <li>Verifier l'authentification avec vos en-tetes X-APP-KEY et X-APP-SECRET cote serveur.</li>
                <li>Configurer votre webhook partenaire pour recevoir les evenements de commande et paiement.</li>
                <li>Synchroniser les produits, puis tester la creation de commande sur un environnement controle.</li>
                <li>Monitorer les retours API et journaliser les echecs d'integration avant le passage en production.</li>
            </ul>
        </div>

        <div class="card">
            <h2>Usage declare</h2>
            <p style="margin:0;">{{ $description }}</p>
        </div>

        <div class="footer">
            Besoin d'assistance: {{ $supportEmail }}
        </div>
    </div>
</body>
</html>