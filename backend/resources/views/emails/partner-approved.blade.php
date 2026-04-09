<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Acces partenaire approuve</title>
</head>
<body style="margin:0; padding:0; background:#f4f7fb; font-family:Arial, Helvetica, sans-serif; color:#10233f;">
    <div style="max-width:680px; margin:0 auto; padding:32px 20px;">
        <div style="background:linear-gradient(135deg, #0f2f57 0%, #1e6aa8 100%); border-radius:20px 20px 0 0; padding:28px 32px; color:#ffffff;">
            <p style="margin:0 0 8px; font-size:12px; letter-spacing:1.6px; text-transform:uppercase; opacity:0.8;">AfriPay API</p>
            <h1 style="margin:0; font-size:28px; line-height:1.2;">Votre acces partenaire est approuve</h1>
            <p style="margin:14px 0 0; font-size:15px; line-height:1.7; max-width:520px;">Bonjour {{ $companyName }}, votre demande partenaire a ete validee. Vous pouvez maintenant connecter votre plateforme a l'API AfriPay.</p>
        </div>

        <div style="background:#ffffff; border-radius:0 0 20px 20px; padding:32px; box-shadow:0 18px 48px rgba(16, 35, 63, 0.08);">
            <div style="border:1px solid #d8e2ef; border-radius:16px; padding:20px; background:#f9fbfd; margin-bottom:24px;">
                <p style="margin:0 0 10px; font-size:13px; text-transform:uppercase; letter-spacing:1px; color:#49617d;">Identifiants</p>
                <p style="margin:0 0 10px; font-size:15px;"><strong>Compte:</strong> {{ $contactEmail }}</p>
                <p style="margin:0 0 10px; font-size:15px;"><strong>APP KEY:</strong> {{ $appKey }}</p>
                <p style="margin:0; font-size:15px;"><strong>APP SECRET:</strong> transmis separement via le canal securise d'approbation.</p>
            </div>

            <div style="margin-bottom:24px;">
                <h2 style="margin:0 0 12px; font-size:20px; color:#0f2f57;">Ce que vous recevez</h2>
                <p style="margin:0 0 10px; font-size:15px; line-height:1.7;">Un guide PDF d'onboarding est joint a cet email avec les informations de demarrage, les etapes d'integration et les rappels de securite.</p>
                <p style="margin:0; font-size:15px; line-height:1.7;">Documentation API: <a href="{{ $docsUrl }}" style="color:#1e6aa8;">{{ $docsUrl }}</a></p>
            </div>

            <div style="margin-bottom:24px;">
                <h2 style="margin:0 0 12px; font-size:20px; color:#0f2f57;">Configuration initiale</h2>
                <p style="margin:0 0 10px; font-size:15px; line-height:1.7;"><strong>Site declare:</strong> {{ $website ?: 'Non renseigne' }}</p>
                <p style="margin:0 0 10px; font-size:15px; line-height:1.7;"><strong>Webhook:</strong> {{ $webhookUrl ?: 'A configurer apres vos premiers tests' }}</p>
                <p style="margin:0; font-size:15px; line-height:1.7;"><strong>Usage declare:</strong> {{ $description }}</p>
            </div>

            <a href="{{ $docsUrl }}" style="display:inline-block; padding:14px 22px; border-radius:999px; background:#0f2f57; color:#ffffff; text-decoration:none; font-size:14px; font-weight:700;">Ouvrir la documentation</a>

            <p style="margin:24px 0 0; font-size:14px; line-height:1.7; color:#49617d;">Si vous avez besoin d'aide pour l'activation SMTP, les webhooks ou les tests de paiement, repondez a cet email ou contactez {{ $supportEmail }}.</p>
        </div>
    </div>
</body>
</html>