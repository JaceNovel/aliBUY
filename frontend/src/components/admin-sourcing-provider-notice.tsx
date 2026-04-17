type AdminSourcingProviderNoticeProps = {
  provider: "alibaba" | "aliexpress";
};

export function AdminSourcingProviderNotice({ provider }: AdminSourcingProviderNoticeProps) {
  if (provider === "alibaba") {
    return (
      <div className="mb-5 rounded-[18px] border border-[#c7d7fe] bg-[#eef4ff] px-5 py-4 text-[13px] font-medium leading-6 text-[#1d4f91]">
        Le sourcing fournisseur est maintenant la seule filière active dans l'admin. Les écrans, lots d'achat et comptes partenaires sont alignés sur le flux buyer et le paiement fournisseur.
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-[18px] border border-[#fed7aa] bg-[#fff7ed] px-5 py-4 text-[13px] font-medium leading-6 text-[#9a3412]">
      Cette ancienne entrée a été désactivée. Utilisez désormais le sourcing fournisseur pour toutes les opérations d'import, d'achat et de paiement fournisseur.
    </div>
  );
}
