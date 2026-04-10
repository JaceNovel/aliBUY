<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Charte partenaire AfriPay</title>
    <style>
        body {
            font-family: DejaVu Sans, sans-serif;
            color: #12263f;
            font-size: 11.5px;
            line-height: 1.65;
            margin: 0;
        }

        .page {
            padding: 34px 38px;
        }

        .hero {
            background: #12263f;
            color: #ffffff;
            border-radius: 18px;
            padding: 24px 28px;
            margin-bottom: 22px;
        }

        .eyebrow {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1.6px;
            opacity: 0.78;
            margin-bottom: 10px;
        }

        h1 {
            margin: 0 0 10px;
            font-size: 22px;
        }

        h2 {
            margin: 0 0 10px;
            font-size: 15px;
            color: #12263f;
        }

        p {
            margin: 0 0 10px;
        }

        .card {
            border: 1px solid #d8e2ef;
            border-radius: 14px;
            padding: 16px 18px;
            margin-bottom: 16px;
        }

        .meta {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #5a6f87;
            margin-bottom: 10px;
        }

        ol, ul {
            margin: 8px 0 0 18px;
            padding: 0;
        }

        li {
            margin-bottom: 6px;
        }

        .grid {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
        }

        .grid td {
            border: 1px solid #d8e2ef;
            padding: 10px 12px;
            vertical-align: top;
        }

        .footer {
            margin-top: 22px;
            font-size: 10.5px;
            color: #5a6f87;
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="hero">
            <div class="eyebrow">AfriPay Partner Charter</div>
            <h1>Charte et engagement partenaire AfriPay</h1>
            <p>Ce document formalise l'admission de <strong>{{ $companyName }}</strong> au programme partenaire AfriPay et rappelle les obligations opérationnelles, de sécurité et de qualité attendues pour conserver l'accès actif au service.</p>
        </div>

        <div class="card">
            <div class="meta">Identification</div>
            <table class="grid">
                <tr>
                    <td><strong>Entreprise</strong><br>{{ $companyName }}</td>
                    <td><strong>Compte partenaire</strong><br>{{ $contactEmail }}</td>
                </tr>
                <tr>
                    <td><strong>Site déclaré</strong><br>{{ $website ?: 'Non renseigne' }}</td>
                    <td><strong>Date d'edition</strong><br>{{ $date }}</td>
                </tr>
                <tr>
                    <td><strong>APP KEY</strong><br>{{ $appKey }}</td>
                    <td><strong>Webhook partenaire</strong><br>{{ $webhookUrl ?: 'A configurer' }}</td>
                </tr>
            </table>
        </div>

        <div class="card">
            <h2>1. Reconnaissance de partenariat</h2>
            <p>AfriPay felicite officiellement {{ $companyName }} pour la validation de son dossier. Cette approbation ouvre l'acces au dashboard partenaire, aux flux de commandes dedies et a l'usage des API AfriPay dans le cadre de l'activite declaree ci-dessous.</p>
            <p><strong>Usage declare :</strong> {{ $description }}</p>
        </div>

        <div class="card">
            <h2>2. Engagements obligatoires</h2>
            <ol>
                <li>Le partenaire utilise les API AfriPay exclusivement depuis une infrastructure serveur securisee.</li>
                <li>Le partenaire ne divulgue jamais APP_SECRET a un client final, un navigateur ou une application publique.</li>
                <li>Le partenaire maintient des informations produit, prix, stocks et delais coherents avec la realite commerciale.</li>
                <li>Le partenaire traite les commandes, incidents clients et retours de webhook avec diligence et tracabilite.</li>
                <li>Le partenaire respecte les lois applicables, les exigences KYC internes et les politiques commerciales AfriPay.</li>
            </ol>
        </div>

        <div class="card">
            <h2>3. Regles de conformite et de securite</h2>
            <ul>
                <li>HTTPS est obligatoire sur toutes les integrations exposees.</li>
                <li>Les journaux applicatifs doivent permettre d'auditer les echecs d'authentification, de paiement et de webhook.</li>
                <li>Les webhooks entrants doivent etre verifies et archives pour preuve de traitement.</li>
                <li>Toute suspicion de fuite, d'abus ou de compromission doit etre signalee immediatement a AfriPay.</li>
            </ul>
        </div>

        <div class="card">
            <h2>4. Conditions de maintien du statut partenaire</h2>
            <ul>
                <li>AfriPay peut suspendre temporairement l'acces en cas d'integration instable, d'usage non conforme ou de risque de securite.</li>
                <li>AfriPay peut exiger une mise en conformite avant reactivation de l'acces.</li>
                <li>Le statut partenaire est maintenu sous reserve du respect continu des obligations definies dans cette charte.</li>
            </ul>
        </div>

        <div class="card">
            <h2>5. Contact et assistance</h2>
            <p>Pour toute question contractuelle, technique ou operationnelle, le partenaire peut contacter AfriPay via <strong>{{ $supportEmail }}</strong>.</p>
            <p>Ce document fait office de charte d'engagement operationnel et doit etre conserve avec vos documents d'integration internes.</p>
        </div>

        <div class="footer">
            Charte partenaire AfriPay generee pour {{ $companyName }} le {{ $date }}.
        </div>
    </div>
</body>
</html>