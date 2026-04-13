<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Guide dropshipping AfriPay</title>
    <style>
        @page { margin: 28px 32px; }

        body {
            font-family: DejaVu Sans, sans-serif;
            color: #142133;
            font-size: 11.5px;
            line-height: 1.58;
            margin: 0;
            background: #ffffff;
        }

        h1, h2, h3, p { margin: 0; }
        h1 { font-size: 28px; line-height: 1.12; letter-spacing: -0.5px; }
        h2 { font-size: 17px; color: #142133; margin-bottom: 8px; }
        h3 { font-size: 13px; color: #142133; margin-bottom: 6px; }
        p { margin-bottom: 8px; }
        ul, ol { margin: 8px 0 0 18px; padding: 0; }
        li { margin-bottom: 5px; }

        .cover {
            padding: 30px 34px;
            border-radius: 18px;
            color: #ffffff;
            background: #0b182c;
            margin-bottom: 18px;
        }

        .brand {
            font-size: 12px;
            font-weight: bold;
            letter-spacing: 2.6px;
            text-transform: uppercase;
            color: #82d59c;
            margin-bottom: 22px;
        }

        .cover-subtitle {
            width: 88%;
            margin-top: 16px;
            color: #dbeafe;
            font-size: 13px;
            line-height: 1.7;
        }

        .cover-meta {
            width: 100%;
            border-collapse: collapse;
            margin-top: 26px;
        }

        .cover-meta td {
            width: 33.33%;
            padding: 12px 14px;
            border: 1px solid rgba(255,255,255,0.16);
            background: rgba(255,255,255,0.06);
            vertical-align: top;
        }

        .label {
            display: block;
            color: #9fb3cf;
            font-size: 9.5px;
            font-weight: bold;
            letter-spacing: 1.4px;
            text-transform: uppercase;
            margin-bottom: 5px;
        }

        .value {
            color: #ffffff;
            font-size: 12px;
            font-weight: bold;
            word-break: break-word;
        }

        .section {
            border: 1px solid #dfe6f0;
            border-radius: 14px;
            padding: 16px 18px;
            margin-bottom: 13px;
            background: #ffffff;
        }

        .section.soft {
            background: #f7fbff;
        }

        .section.green {
            border-color: #b9ecc8;
            background: #f2fbf5;
        }

        .two-col {
            width: 100%;
            border-collapse: collapse;
        }

        .two-col td {
            width: 50%;
            vertical-align: top;
            padding: 0 8px 0 0;
        }

        .facts {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
        }

        .facts td {
            width: 50%;
            border: 1px solid #e2e8f0;
            padding: 10px 12px;
            vertical-align: top;
            background: #fbfdff;
        }

        .mono {
            font-family: DejaVu Sans Mono, monospace;
            font-size: 10.5px;
            color: #0f172a;
            word-break: break-all;
        }

        .badge {
            display: inline-block;
            padding: 5px 9px;
            border-radius: 999px;
            background: #dcfce7;
            color: #166534;
            font-size: 9.5px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 9px;
        }

        .step {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
        }

        .step td {
            border-top: 1px solid #e2e8f0;
            padding: 9px 0;
            vertical-align: top;
        }

        .step-number {
            width: 34px;
            font-weight: bold;
            color: #0f9f4b;
        }

        .page-break { page-break-before: always; }

        .footer {
            margin-top: 16px;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 10px;
        }
    </style>
</head>
<body>
    <div class="cover">
        <div class="brand">AfriPay Partner Program</div>
        <h1>Guide complet de lancement dropshipping</h1>
        <div class="cover-subtitle">
            Felicitations <strong>{{ $companyName }}</strong>. Votre compte est approuve et peut utiliser le dashboard partenaire, les cles API et les flux de commande AfriPay dans le cadre de votre activite declaree.
        </div>
        <table class="cover-meta">
            <tr>
                <td><span class="label">Partenaire</span><span class="value">{{ $companyName }}</span></td>
                <td><span class="label">Compte</span><span class="value">{{ $contactEmail }}</span></td>
                <td><span class="label">Edition</span><span class="value">{{ $date }}</span></td>
            </tr>
        </table>
    </div>

    <div class="section green">
        <span class="badge">Compte approuve</span>
        <h2>1. Reconnaissance partenaire</h2>
        <p>AfriPay reconnait officiellement <strong>{{ $companyName }}</strong> comme partenaire vendeur. Cette validation autorise l'utilisation des outils prives AfriPay pour connecter des produits, transmettre des commandes, suivre les paiements et surveiller les revenus API.</p>
        <table class="facts">
            <tr>
                <td><span class="label">Entreprise</span>{{ $companyName }}</td>
                <td><span class="label">Email partenaire</span>{{ $contactEmail }}</td>
            </tr>
            <tr>
                <td><span class="label">Site ou boutique</span>{{ $website ?: 'Non renseigne' }}</td>
                <td><span class="label">Statut</span>Actif apres approbation AfriPay</td>
            </tr>
        </table>
    </div>

    <div class="section">
        <h2>2. Acces techniques</h2>
        <p>Conservez ces informations dans votre documentation interne. Le secret ne doit jamais etre expose dans un navigateur, un depot public, une application mobile publique ou un outil client.</p>
        <table class="facts">
            <tr>
                <td><span class="label">APP KEY</span><span class="mono">{{ $appKey }}</span></td>
                <td><span class="label">APP SECRET</span>Disponible dans le dashboard, a copier cote serveur uniquement.</td>
            </tr>
            <tr>
                <td><span class="label">Webhook</span>{{ $webhookUrl ?: 'A configurer avant la production' }}</td>
                <td><span class="label">Documentation</span>{{ $docsUrl }}</td>
            </tr>
        </table>
    </div>

    <div class="section soft">
        <h2>3. Checklist avant lancement</h2>
        <table class="step">
            <tr><td class="step-number">01</td><td><strong>Connexion.</strong> Ouvrir le dashboard partenaire et verifier que APP_KEY, APP_SECRET et webhook sont accessibles.</td></tr>
            <tr><td class="step-number">02</td><td><strong>Serveur.</strong> Ajouter les headers <span class="mono">X-APP-KEY</span> et <span class="mono">X-APP-SECRET</span> uniquement dans votre backend.</td></tr>
            <tr><td class="step-number">03</td><td><strong>Catalogue.</strong> Controler les produits, prix, variantes, images, videos, poids, dimensions, MOQ et delais de livraison.</td></tr>
            <tr><td class="step-number">04</td><td><strong>Commande test.</strong> Executer un flux complet: creation de commande, paiement, reception webhook, statut et suivi client.</td></tr>
            <tr><td class="step-number">05</td><td><strong>Production.</strong> Activer la surveillance des erreurs API, des echecs de paiement et des webhooks non traites.</td></tr>
        </table>
    </div>

    <div class="section">
        <h2>4. Flux dropshipping recommande</h2>
        <ol>
            <li>Le client choisit un produit sur votre interface ou via votre integration AfriPay.</li>
            <li>Votre backend valide les variantes, quantites, prix, frais et disponibilite.</li>
            <li>Votre backend cree la commande AfriPay avec les donnees client et livraison.</li>
            <li>AfriPay initialise le paiement et renvoie l'etat de transaction.</li>
            <li>Votre webhook recoit les evenements de paiement, traitement, expedition et incident.</li>
            <li>Vous gardez le client informe avec les statuts AfriPay synchronises.</li>
        </ol>
    </div>

    <div class="page-break"></div>

    <div class="section">
        <h2>5. Regles de securite obligatoires</h2>
        <ul>
            <li>Ne jamais envoyer APP_SECRET au frontend, meme masque dans le code source.</li>
            <li>Regenerer immediatement le secret en cas de doute, fuite, collaborateur sortant ou depot expose.</li>
            <li>Utiliser HTTPS pour tout appel API et toute URL webhook.</li>
            <li>Journaliser les erreurs d'authentification, de paiement et de webhook sans stocker de secret en clair dans les logs.</li>
            <li>Limiter les acces internes aux cles a l'equipe technique autorisee.</li>
        </ul>
    </div>

    <table class="two-col">
        <tr>
            <td>
                <div class="section">
                    <h2>6. Qualite catalogue</h2>
                    <ul>
                        <li>Titres comprehensibles et non trompeurs.</li>
                        <li>Photos, videos et variantes verifiees.</li>
                        <li>Prix et MOQ controles avant publication.</li>
                        <li>Poids, dimensions et volume colis coherents.</li>
                        <li>Delais et frais presentes clairement au client.</li>
                    </ul>
                </div>
            </td>
            <td>
                <div class="section">
                    <h2>7. Suivi client</h2>
                    <ul>
                        <li>Informer le client en cas de retard ou incident.</li>
                        <li>Traiter rapidement les preuves de livraison.</li>
                        <li>Conserver les traces commande et paiement.</li>
                        <li>Remonter tout litige critique a AfriPay.</li>
                        <li>Maintenir un canal support actif.</li>
                    </ul>
                </div>
            </td>
        </tr>
    </table>

    <div class="section">
        <h2>8. Projet declare</h2>
        <p>{{ $description ?: 'Aucune description detaillee fournie lors de la candidature.' }}</p>
    </div>

    <div class="section green">
        <h2>9. Message AfriPay</h2>
        <p>Votre validation ouvre un acces professionnel aux outils AfriPay. Nous vous felicitons et vous invitons a lancer l'integration avec une attention particuliere a la securite, la qualite produit, la fiabilite des webhooks et la transparence client.</p>
        <p><strong>Contact support :</strong> {{ $supportEmail }}</p>
    </div>

    <div class="footer">
        Document genere pour {{ $companyName }} le {{ $date }}. Version onboarding dropshipping AfriPay. Support: {{ $supportEmail }}.
    </div>
</body>
</html>
