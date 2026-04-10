<?php

namespace App\Mail;

use App\Models\ApiPartner;
use App\Models\ApiPartnerRequest;
use App\Support\PartnerApprovalGuidePdf;
use App\Support\PartnerCharterPdf;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

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
        $guidePdf = new PartnerApprovalGuidePdf($this->partner, $this->partnerRequest);
        $charterPdf = new PartnerCharterPdf($this->partner, $this->partnerRequest);

        return [
            Attachment::fromData(fn () => $guidePdf->output(), $guidePdf->filename())
                ->withMime('application/pdf'),
            Attachment::fromData(fn () => $charterPdf->output(), $charterPdf->filename())
                ->withMime('application/pdf'),
        ];
    }

    public function backoff(): array
    {
        return [60, 300, 900];
    }

    protected function viewData(): array
    {
        return (new PartnerApprovalGuidePdf($this->partner, $this->partnerRequest))->viewData();
    }
}