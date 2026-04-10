<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Guide dropshipping AfriPay</title>
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
            background: linear-gradient(135deg, #0f2f57 0%, #1769aa 100%);
            color: #ffffff;
            border-radius: 16px;
            padding: 24px 28px;
            margin-bottom: 24px;
        }

        .hero p {
            margin: 0;
            max-width: 500px;
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

        .badge {
            display: inline-block;
            margin-bottom: 10px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            opacity: 0.82;
        }

        .signature {
            margin-top: 20px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="hero">
            <div class="badge">AfriPay dropshipping program</div>
            <h1>Felicitations, votre compte partenaire est approuve</h1>
            <p>AfriPay reconnait officiellement <strong>{{ $companyName }}</strong> comme partenaire vendeur. Ce document confirme votre validation, vous felicite pour votre admission et rappelle les conditions a respecter pour rester actif sur le programme.</p>
        </div>

        <div class="card">
            <div class="label">Reconnaissance partenaire</div>
            <p><strong>Societe approuvee :</strong> {{ $companyName }}</p>
            <p><strong>Compte rattache :</strong> {{ $contactEmail }}</p>
            <p><strong>Site ou boutique :</strong> {{ $website ?: 'Non renseigne' }}</p>
            <p><strong>Statut :</strong> Partenaire actif autorise a utiliser le dashboard prive, les cles API et le flux dropshipping AfriPay.</p>
        </div>

        <div class="card">
            <div class="label">Acces operationnels</div>
            <p><strong>APP KEY:</strong> {{ $appKey }}</p>
            <p><strong>APP SECRET:</strong> communique separement et a conserver uniquement cote serveur.</p>
            <p><strong>Webhook:</strong> {{ $webhookUrl ?: 'A configurer avant les premiers flux automatises' }}</p>
            <p><strong>Documentation technique:</strong> {{ $docsUrl }}</p>
        </div>

        <div class="card">
            <h2>Conditions a respecter</h2>
            <ul>
                <li>Ne jamais exposer APP_SECRET dans une application publique ou dans le navigateur.</li>
                <li>Envoyer toutes les requetes AfriPay depuis votre backend ou une infrastructure securisee.</li>
                <li>Maintenir a jour vos prix, stocks, fiches produit et informations de livraison cote partenaire.</li>
                <li>Configurer un webhook fiable pour recevoir les statuts de commande, paiement et expedition.</li>
                <li>Respecter les delais de traitement, les regles de qualite et les engagements commerciaux communiques au client final.</li>
                <li>Conserver un service client joignable et traiter rapidement les incidents, litiges et echecs de paiement.</li>
            </ul>
        </div>

        <div class="card">
            <h2>Etapes recommandees pour votre lancement</h2>
            <ul>
                <li>Ouvrir votre dashboard vendeur AfriPay et verifier vos cles API dediees.</li>
                <li>Lire la documentation d'integration et tester l'authentification avec X-APP-KEY et X-APP-SECRET.</li>
                <li>Importer les produits utiles a votre catalogue, definir vos marges et controler votre parcours de commande.</li>
                <li>Realiser un premier test complet jusqu'au webhook avant votre mise en production.</li>
            </ul>
        </div>

        <div class="card">
            <h2>Projet declare lors de la candidature</h2>
            <p style="margin:0;">{{ $description }}</p>
        </div>

        <div class="card">
            <h2>Message AfriPay</h2>
            <p style="margin:0;">Nous vous felicitons pour cette validation. Votre entreprise rejoint le programme dropshipping AfriPay avec un acces dedie au dashboard, aux commandes partenaires et au suivi de votre marge. Nous comptons sur vous pour maintenir une integration fiable, conforme et orientee qualite.</p>
            <div class="signature">
                <strong>Equipe AfriPay</strong><br>
                Support: {{ $supportEmail }}
            </div>
        </div>

        <div class="footer">
            Document genere pour {{ $companyName }}. Besoin d'assistance: {{ $supportEmail }}
        </div>
    </div>
</body>
</html>