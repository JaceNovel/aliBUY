type AdminSourcingProviderNoticeProps = {
  provider: "alibaba" | "aliexpress";
};

export function AdminSourcingProviderNotice({ provider }: AdminSourcingProviderNoticeProps) {
  if (provider === "alibaba") {
    return (
      <div className="mb-5 rounded-[18px] border border-[#c7d7fe] bg-[#eef4ff] px-5 py-4 text-[13px] font-medium leading-6 text-[#1d4f91]">
        Alibaba Sourcing est ajouté dans l'admin. Les écrans sont prêts pour recevoir la documentation Alibaba; en attendant, ils réutilisent le moteur technique existant afin de garder les données et les lots visibles.
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-[18px] border border-[#fed7aa] bg-[#fff7ed] px-5 py-4 text-[13px] font-medium leading-6 text-[#9a3412]">
      AliExpress Sourcing est maintenant obsolète. Garde cette section uniquement pour transition ou vérification; les nouveaux travaux doivent partir de Alibaba Sourcing.
    </div>
  );
}
