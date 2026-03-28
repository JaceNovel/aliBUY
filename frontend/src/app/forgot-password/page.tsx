import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff8f2_0%,#f5f7fb_100%)] px-4 py-10 text-[#1d2738] sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[80vh] max-w-[1120px] items-center justify-center">
        <div className="grid w-full max-w-[980px] gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[32px] bg-[#111827] px-7 py-8 text-white shadow-[0_30px_80px_rgba(17,24,39,0.28)] sm:px-8 sm:py-10">
            <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#ffb48a]">AfriPay Compte</div>
            <h1 className="mt-4 text-[34px] font-black tracking-[-0.05em] sm:text-[46px]">Recuperer l&apos;acces a votre compte</h1>
            <p className="mt-4 max-w-[420px] text-[15px] leading-7 text-white/72">
              Cette page est prete pour accueillir la reinitialisation de mot de passe. Le lien est maintenant visible depuis la page de connexion.
            </p>
            <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 px-5 py-5 text-[14px] leading-7 text-white/82 backdrop-blur">
              <div className="font-semibold text-white">Etape suivante</div>
              <div className="mt-2">Nous pourrons brancher ici l&apos;envoi d&apos;un email ou d&apos;un code de verification quand vous serez pret.</div>
            </div>
          </section>

          <section className="rounded-[32px] border border-[#ebe4da] bg-white px-6 py-7 shadow-[0_24px_70px_rgba(17,24,39,0.08)] sm:px-8 sm:py-9">
            <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#ff6a00]">Mot de passe oublie</div>
            <h2 className="mt-3 text-[30px] font-black tracking-[-0.05em] text-[#111827]">Reinitialisation bientot disponible</h2>
            <p className="mt-3 text-[14px] leading-7 text-[#667085]">
              Le bouton est maintenant en place sur la page de connexion. La logique de reinitialisation pourra etre ajoutee dans cette page ensuite.
            </p>
            <div className="mt-6 space-y-3">
              <Link href="/login" className="inline-flex h-12 w-full items-center justify-center rounded-[16px] bg-[#ff6a00] px-5 text-[15px] font-semibold text-white transition hover:bg-[#eb6100]">
                Retour a la connexion
              </Link>
              <Link href="/register" className="inline-flex h-12 w-full items-center justify-center rounded-[16px] border border-[#d7dce5] px-5 text-[15px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
                Aller a l&apos;inscription
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}