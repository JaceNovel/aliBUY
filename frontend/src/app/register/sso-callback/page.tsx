import { AuthRedirectCallback } from "@/components/auth-redirect-callback";

export default function RegisterSsoCallbackPage() {
  return (
    <AuthRedirectCallback
      title="Creation du compte en cours"
      description="AfriPay finalise votre inscription securisee. Vous allez etre redirige vers votre espace dans un instant."
    />
  );
}
