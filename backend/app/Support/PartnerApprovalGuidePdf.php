<?php

namespace App\Support;

use App\Models\ApiPartner;
use App\Models\ApiPartnerRequest;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

class PartnerApprovalGuidePdf
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
            'appKey' => $this->partner->app_key,
            'webhookUrl' => $this->partner->webhook_url,
            'website' => $this->partnerRequest->website,
            'description' => $this->partnerRequest->description,
            'docsUrl' => $this->docsUrl(),
            'supportEmail' => 'support@afripay.space',
            'date' => now()->format('d/m/Y'),
        ];
    }

    public function output(): string
    {
        return Pdf::loadView('pdf.partner-approval-guide', $this->viewData())
            ->setPaper('a4')
            ->output();
    }

    public function filename(): string
    {
        $slug = Str::slug($this->partner->company_name ?: 'partner');

        return 'afripay-dropshipping-'.($slug !== '' ? $slug : 'partner').'.pdf';
    }

    public function downloadResponse(): Response
    {
        return response($this->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => sprintf('attachment; filename="%s"', $this->filename()),
            'Cache-Control' => 'private, no-store, max-age=0',
        ]);
    }

    protected function docsUrl(): string
    {
        $baseUrl = rtrim((string) config('app.url'), '/');

        return $baseUrl !== '' ? $baseUrl.'/api/docs' : '/api/docs';
    }
}
