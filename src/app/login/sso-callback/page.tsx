import { AuthRedirectCallback } from "@/components/auth-redirect-callback";

export default function LoginSsoCallbackPage() {
  return (
    <AuthRedirectCallback
      title="Connexion en cours"
      description="AfriPay finalise votre connexion securisee. Vous allez etre redirige vers votre espace dans un instant."
    />
  );
}
