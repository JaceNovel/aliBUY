<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Charte partenaire AfriPay</title>
    <style>
        @page { margin: 28px 32px; }

        body {
            font-family: DejaVu Sans, sans-serif;
            color: #172033;
            font-size: 11.2px;
            line-height: 1.58;
            margin: 0;
            background: #ffffff;
        }

        h1, h2, h3, p { margin: 0; }
        h1 { font-size: 26px; line-height: 1.14; letter-spacing: -0.4px; }
        h2 { font-size: 15.5px; margin-bottom: 8px; color: #172033; }
        h3 { font-size: 12px; margin-bottom: 5px; }
        p { margin-bottom: 8px; }
        ol, ul { margin: 8px 0 0 18px; padding: 0; }
        li { margin-bottom: 5px; }

        .cover {
            padding: 28px 32px;
            border-radius: 18px;
            color: #ffffff;
            background: #111827;
            margin-bottom: 16px;
        }

        .eyebrow {
            color: #fbbf24;
            font-size: 10px;
            font-weight: bold;
            letter-spacing: 2.4px;
            text-transform: uppercase;
            margin-bottom: 18px;
        }

        .summary {
            margin-top: 14px;
            width: 92%;
            color: #e5e7eb;
            font-size: 12.5px;
            line-height: 1.7;
        }

        .meta-table, .grid {
            width: 100%;
            border-collapse: collapse;
        }

        .meta-table {
            margin-top: 24px;
        }

        .meta-table td {
            width: 33.33%;
            border: 1px solid rgba(255,255,255,0.18);
            background: rgba(255,255,255,0.06);
            padding: 11px 12px;
            vertical-align: top;
        }

        .label {
            display: block;
            color: #9ca3af;
            font-size: 9.3px;
            font-weight: bold;
            letter-spacing: 1.3px;
            text-transform: uppercase;
            margin-bottom: 5px;
        }

        .meta-value {
            color: #ffffff;
            font-weight: bold;
            word-break: break-word;
        }

        .section {
            border: 1px solid #dfe6f0;
            border-radius: 14px;
            padding: 15px 17px;
            margin-bottom: 12px;
            background: #ffffff;
        }

        .section.warning {
            border-color: #fde68a;
            background: #fffbeb;
        }

        .section.safe {
            border-color: #bbf7d0;
            background: #f0fdf4;
        }

        .grid {
            margin-top: 8px;
        }

        .grid td {
            width: 50%;
            border: 1px solid #e2e8f0;
            padding: 9px 11px;
            vertical-align: top;
            background: #fbfdff;
        }

        .article-title {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 999px;
            background: #eef2ff;
            color: #3730a3;
            font-size: 9.5px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 7px;
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

        .signature-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
        }

        .signature-table td {
            width: 50%;
            border: 1px solid #e2e8f0;
            padding: 18px 14px;
            vertical-align: top;
            height: 76px;
        }

        .line {
            margin-top: 30px;
            border-top: 1px solid #94a3b8;
            padding-top: 6px;
            color: #64748b;
            font-size: 10px;
        }

        .page-break { page-break-before: always; }

        .footer {
            margin-top: 14px;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 10px;
        }
    </style>
</head>
<body>
    <div class="cover">
        <div class="eyebrow">AfriPay Partner Charter</div>
        <h1>Charte officielle d'engagement partenaire</h1>
        <p class="summary">Cette charte formalise l'admission de <strong>{{ $companyName }}</strong> au programme partenaire AfriPay et fixe les regles de securite, qualite, conformite, support et maintien du statut partenaire.</p>
        <table class="meta-table">
            <tr>
                <td><span class="label">Entreprise</span><span class="meta-value">{{ $companyName }}</span></td>
                <td><span class="label">Compte</span><span class="meta-value">{{ $contactEmail }}</span></td>
                <td><span class="label">Date</span><span class="meta-value">{{ $date }}</span></td>
            </tr>
        </table>
    </div>

    <div class="section">
        <span class="article-title">Identification</span>
        <h2>Partenaire et perimetre valide</h2>
        <table class="grid">
            <tr>
                <td><span class="label">Societe</span>{{ $companyName }}</td>
                <td><span class="label">Email</span>{{ $contactEmail }}</td>
            </tr>
            <tr>
                <td><span class="label">Site declare</span>{{ $website ?: 'Non renseigne' }}</td>
                <td><span class="label">APP KEY</span>{{ $appKey }}</td>
            </tr>
            <tr>
                <td><span class="label">Webhook</span>{{ $webhookUrl ?: 'A configurer' }}</td>
                <td><span class="label">Support</span>{{ $supportEmail }}</td>
            </tr>
        </table>
    </div>

    <div class="section safe">
        <span class="article-title">Article 1</span>
        <h2>Reconnaissance du statut partenaire</h2>
        <p>AfriPay felicite officiellement <strong>{{ $companyName }}</strong> pour la validation de son dossier. Cette approbation autorise l'utilisation du dashboard partenaire, des cles API, des flux de commande et des ressources d'integration AfriPay dans le perimetre declare.</p>
        <p><strong>Usage declare :</strong> {{ $description ?: 'Usage non detaille dans la candidature.' }}</p>
    </div>

    <div class="section">
        <span class="article-title">Article 2</span>
        <h2>Obligations de securite</h2>
        <ol>
            <li>APP_SECRET doit rester strictement cote serveur et ne jamais etre expose dans le navigateur, une application mobile publique ou un depot public.</li>
            <li>Les appels API doivent transiter par une infrastructure maitrisee avec HTTPS, gestion des erreurs et journalisation securisee.</li>
            <li>Le partenaire doit regenerer le secret en cas de fuite supposee, rotation d'equipe, audit ou exposition accidentelle.</li>
            <li>Les logs ne doivent pas contenir de secrets, tokens, donnees bancaires ou informations personnelles inutiles.</li>
            <li>Tout incident de securite doit etre signale rapidement a AfriPay via {{ $supportEmail }}.</li>
        </ol>
    </div>

    <div class="section">
        <span class="article-title">Article 3</span>
        <h2>Qualite catalogue et information client</h2>
        <ul>
            <li>Les titres, images, videos, variantes, prix, MOQ, poids, dimensions, volumes et delais doivent etre exacts ou clairement signales comme en verification.</li>
            <li>Le partenaire s'engage a ne pas publier de produits trompeurs, interdits, dangereux ou non conformes aux lois applicables.</li>
            <li>Les prix et marges doivent etre controles avant publication et avant toute campagne commerciale.</li>
            <li>Les informations de livraison doivent rester coherentes avec le mode de transport annonce au client.</li>
        </ul>
    </div>

    <div class="page-break"></div>

    <table class="two-col">
        <tr>
            <td>
                <div class="section">
                    <span class="article-title">Article 4</span>
                    <h2>Commandes et paiements</h2>
                    <ul>
                        <li>Verifier chaque commande avant execution.</li>
                        <li>Surveiller les echecs de paiement.</li>
                        <li>Conserver les traces de paiement et commande.</li>
                        <li>Informer le client en cas d'incident.</li>
                    </ul>
                </div>
            </td>
            <td>
                <div class="section">
                    <span class="article-title">Article 5</span>
                    <h2>Webhooks et suivi</h2>
                    <ul>
                        <li>Configurer une URL webhook stable.</li>
                        <li>Traiter les evenements sans doublon.</li>
                        <li>Archiver les statuts importants.</li>
                        <li>Prevoir une reprise en cas d'echec.</li>
                    </ul>
                </div>
            </td>
        </tr>
    </table>

    <div class="section">
        <span class="article-title">Article 6</span>
        <h2>Support, litiges et responsabilite operationnelle</h2>
        <p>Le partenaire s'engage a maintenir un support actif pour ses clients et a traiter avec diligence les demandes relatives aux commandes, paiements, remboursements, retards, erreurs de variante, colis endommages ou colis perdus.</p>
        <ul>
            <li>Les incidents critiques doivent etre remontes a AfriPay avec reference commande, date, preuve et statut attendu.</li>
            <li>Les demandes client doivent etre suivies jusqu'a resolution ou escalade documentee.</li>
            <li>Les communications doivent rester professionnelles, exactes et non trompeuses.</li>
        </ul>
    </div>

    <div class="section warning">
        <span class="article-title">Article 7</span>
        <h2>Suspension, correction et retrait d'acces</h2>
        <p>AfriPay peut suspendre temporairement ou definitivement l'acces partenaire en cas de risque de securite, fraude, usage non conforme, plaintes repetees, donnees produit trompeuses, integration instable ou absence de correction apres notification.</p>
        <p>AfriPay peut demander une mise en conformite avant reactivation. Le statut partenaire est maintenu sous reserve du respect continu de cette charte.</p>
    </div>

    <div class="section">
        <span class="article-title">Article 8</span>
        <h2>Validation et conservation</h2>
        <p>Ce document fait office de charte d'engagement operationnel. Il doit etre conserve avec les documents internes d'integration, de securite et de conformite de {{ $companyName }}.</p>
        <table class="signature-table">
            <tr>
                <td>
                    <strong>Pour AfriPay</strong>
                    <div class="line">Equipe AfriPay - {{ $date }}</div>
                </td>
                <td>
                    <strong>Pour {{ $companyName }}</strong>
                    <div class="line">Lu et conserve par le partenaire</div>
                </td>
            </tr>
        </table>
    </div>

    <div class="footer">
        Charte partenaire AfriPay generee pour {{ $companyName }} le {{ $date }}. Contact: {{ $supportEmail }}.
    </div>
</body>
</html>
