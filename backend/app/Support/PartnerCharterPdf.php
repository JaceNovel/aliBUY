<?php

namespace App\Support;

use App\Models\ApiPartner;
use App\Models\ApiPartnerRequest;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

class PartnerCharterPdf
{
    public function __construct(
        protected ApiPartner $partner,
        protected ApiPartnerRequest $partnerRequest,
    ) {
    }

    public function viewData(): array
    {
        return [
            'companyName' => $this->partner->company_name,
            'contactEmail' => $this->partner->email,
            'website' => $this->partnerRequest->website,
            'description' => $this->partnerRequest->description,
            'appKey' => $this->partner->app_key,
            'webhookUrl' => $this->partner->webhook_url,
            'supportEmail' => (string) config('mail.from.address'),
            'date' => now()->format('d/m/Y'),
        ];
    }

    public function output(): string
    {
        return Pdf::loadView('pdf.partner-charter', $this->viewData())
            ->setPaper('a4')
            ->output();
    }

    public function filename(): string
    {
        $slug = Str::slug($this->partner->company_name ?: 'partner');

        return 'afripay-charte-partenaire-'.($slug !== '' ? $slug : 'partner').'.pdf';
    }

    public function downloadResponse(): Response
    {
        return response($this->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => sprintf('attachment; filename="%s"', $this->filename()),
            'Cache-Control' => 'private, no-store, max-age=0',
        ]);
    }
}