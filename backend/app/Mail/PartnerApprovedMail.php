<?php

namespace App\Mail;

use App\Models\ApiPartner;
use App\Models\ApiPartnerRequest;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;

class PartnerApprovedMail extends Mailable implements ShouldQueue
{
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public int $timeout = 120;

    public function __construct(
        public ApiPartner $partner,
        public ApiPartnerRequest $partnerRequest,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'AfriPay API - votre acces partenaire est approuve',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.partner-approved',
            with: $this->viewData(),
        );
    }

    public function attachments(): array
    {
        return [
            Attachment::fromData(fn () => $this->buildGuidePdf(), $this->pdfFilename())
                ->withMime('application/pdf'),
        ];
    }

    public function backoff(): array
    {
        return [60, 300, 900];
    }

    protected function viewData(): array
    {
        return [
            'companyName' => $this->partner->company_name,
            'contactEmail' => $this->partner->email,
            'appKey' => $this->partner->app_key,
            'webhookUrl' => $this->partner->webhook_url,
            'website' => $this->partnerRequest->website,
            'description' => $this->partnerRequest->description,
            'docsUrl' => $this->docsUrl(),
            'supportEmail' => (string) config('mail.from.address'),
        ];
    }

    protected function buildGuidePdf(): string
    {
        return Pdf::loadView('pdf.partner-approval-guide', $this->viewData())
            ->setPaper('a4')
            ->output();
    }

    protected function pdfFilename(): string
    {
        $slug = Str::slug($this->partner->company_name ?: 'partner');

        return 'afripay-onboarding-'.($slug !== '' ? $slug : 'partner').'.pdf';
    }

    protected function docsUrl(): string
    {
        $baseUrl = rtrim((string) config('app.url'), '/');

        return $baseUrl !== '' ? $baseUrl.'/api/docs' : '/api/docs';
    }
}