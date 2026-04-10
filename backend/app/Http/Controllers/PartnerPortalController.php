<?php

namespace App\Http\Controllers;

use App\Models\ApiPartner;
use App\Models\ApiPartnerRequest;
use App\Support\PartnerCharterPdf;
use App\Models\PartnerOrder;
use App\Models\PartnerTransaction;
use App\Support\PartnerApprovalGuidePdf;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class PartnerPortalController extends Controller
{
    public function access(Request $request): JsonResponse
    {
        $email = $this->authorizePortalRequest($request);
        $latestRequest = ApiPartnerRequest::query()
            ->where('email', $email)
            ->latest()
            ->first();
        $partner = ApiPartner::query()
            ->with('wallet')
            ->where('email', $email)
            ->latest()
            ->first();

        $status = $partner && $partner->is_active
            ? 'approved'
            : ($latestRequest?->status ?? 'none');

        return response()->json([
            'status' => $status,
            'hasDashboardAccess' => $status === 'approved',
            'request' => $latestRequest ? [
                'companyName' => $latestRequest->company_name,
                'website' => $latestRequest->website,
                'description' => $latestRequest->description,
                'createdAt' => optional($latestRequest->created_at)->toIso8601String(),
            ] : null,
            'partner' => $partner ? [
                'id' => (string) $partner->id,
                'companyName' => $partner->company_name,
                'email' => $partner->email,
                'webhookUrl' => $partner->webhook_url,
                'isActive' => (bool) $partner->is_active,
                'walletBalance' => $partner->wallet ? (float) $partner->wallet->balance : 0.0,
                'createdAt' => optional($partner->created_at)->toIso8601String(),
            ] : null,
        ]);
    }

    public function stats(Request $request): JsonResponse
    {
        $partner = $this->resolveApprovedPartner($request);
        $today = CarbonImmutable::now()->startOfDay();
        $series = [];

        for ($offset = 6; $offset >= 0; $offset--) {
            $day = $today->subDays($offset);
            $amount = (float) PartnerTransaction::query()
                ->where('partner_id', $partner->id)
                ->where('type', 'credit')
                ->whereBetween('created_at', [$day, $day->endOfDay()])
                ->sum('amount');

            if ($amount <= 0) {
                $amount = (float) PartnerOrder::query()
                    ->where('partner_id', $partner->id)
                    ->whereBetween('created_at', [$day, $day->endOfDay()])
                    ->sum('margin');
            }

            $series[] = [
                'day' => $day->locale('fr')->isoFormat('ddd'),
                'amount' => (int) round($amount),
            ];
        }

        $revenueToday = (int) round((float) PartnerTransaction::query()
            ->where('partner_id', $partner->id)
            ->where('type', 'credit')
            ->whereBetween('created_at', [$today, $today->endOfDay()])
            ->sum('amount'));

        if ($revenueToday <= 0) {
            $revenueToday = (int) round((float) PartnerOrder::query()
                ->where('partner_id', $partner->id)
                ->whereBetween('created_at', [$today, $today->endOfDay()])
                ->sum('margin'));
        }

        return response()->json([
            'balance' => (float) ($partner->wallet?->balance ?? 0),
            'revenueToday' => $revenueToday,
            'ordersCount' => PartnerOrder::query()->where('partner_id', $partner->id)->count(),
            'revenueSeries' => $series,
            'companyName' => $partner->company_name,
        ]);
    }

    public function orders(Request $request): JsonResponse
    {
        $partner = $this->resolveApprovedPartner($request);
        $page = max(1, (int) $request->integer('page', 1));
        $perPage = 12;
        $paginator = PartnerOrder::query()
            ->with('order')
            ->where('partner_id', $partner->id)
            ->latest()
            ->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'items' => $paginator->getCollection()->map(function (PartnerOrder $partnerOrder) {
                $order = $partnerOrder->order;
                $firstItem = is_array($order?->items) ? ($order->items[0] ?? null) : null;
                $productName = is_array($firstItem)
                    ? (string) ($firstItem['title_snapshot'] ?? $firstItem['title'] ?? $firstItem['name'] ?? 'Commande partenaire')
                    : 'Commande partenaire';
                $status = in_array((string) ($order?->payment_status ?? $partnerOrder->status), ['paid', 'processing', 'shipped', 'delivered'], true)
                    ? 'paid'
                    : 'pending';

                return [
                    'id' => (string) $partnerOrder->id,
                    'product' => $productName,
                    'price' => (float) $partnerOrder->selling_price,
                    'margin' => (float) $partnerOrder->margin,
                    'status' => $status,
                    'createdAt' => optional($partnerOrder->created_at)->toIso8601String(),
                ];
            })->values()->all(),
            'pagination' => [
                'currentPage' => $paginator->currentPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'lastPage' => $paginator->lastPage(),
            ],
        ]);
    }

    public function wallet(Request $request): JsonResponse
    {
        $partner = $this->resolveApprovedPartner($request);

        return response()->json([
            'partnerId' => (string) $partner->id,
            'balance' => (float) ($partner->wallet?->balance ?? 0),
            'transactions' => $partner->transactions()
                ->latest()
                ->limit(20)
                ->get()
                ->map(fn (PartnerTransaction $transaction) => [
                    'id' => (string) $transaction->id,
                    'amount' => (float) $transaction->amount,
                    'type' => $transaction->type === 'debit' ? 'debit' : 'credit',
                    'description' => $transaction->description,
                    'createdAt' => optional($transaction->created_at)->toIso8601String(),
                ])
                ->values()
                ->all(),
        ]);
    }

    public function keys(Request $request): JsonResponse
    {
        $partner = $this->resolveApprovedPartner($request);
        $maskedSuffix = substr($partner->app_key, -6);

        return response()->json([
            'appKey' => $partner->app_key,
            'maskedSecret' => sprintf('%s%s', str_repeat('*', 24), $maskedSuffix),
            'webhookUrl' => $partner->webhook_url ?? '',
        ]);
    }

    public function approvalGuide(Request $request): Response
    {
        $partner = $this->resolveApprovedPartner($request);
        $partnerRequest = ApiPartnerRequest::query()
            ->where('email', $partner->email)
            ->latest()
            ->first();

        if (! $partnerRequest) {
            abort(404, 'Dossier partenaire introuvable pour ce compte.');
        }

        return (new PartnerApprovalGuidePdf($partner, $partnerRequest))->downloadResponse();
    }

    public function charter(Request $request): Response
    {
        $partner = $this->resolveApprovedPartner($request);
        $partnerRequest = ApiPartnerRequest::query()
            ->where('email', $partner->email)
            ->latest()
            ->first();

        if (! $partnerRequest) {
            abort(404, 'Dossier partenaire introuvable pour ce compte.');
        }

        return (new PartnerCharterPdf($partner, $partnerRequest))->downloadResponse();
    }

    protected function resolveApprovedPartner(Request $request): ApiPartner
    {
        $email = $this->authorizePortalRequest($request);
        $partner = ApiPartner::query()
            ->with(['wallet', 'transactions'])
            ->where('email', $email)
            ->where('is_active', true)
            ->latest()
            ->first();

        if (! $partner) {
            throw new AuthorizationException('Acces dashboard partenaire indisponible pour ce compte.');
        }

        return $partner;
    }

    protected function authorizePortalRequest(Request $request): string
    {
        $sharedSecret = trim((string) env('PARTNER_PORTAL_SHARED_SECRET', ''));
        if ($sharedSecret === '') {
            abort(503, 'PARTNER_PORTAL_SHARED_SECRET manquant.');
        }

        $email = strtolower(trim((string) $request->header('X-Partner-Portal-Email', '')));
        $timestamp = trim((string) $request->header('X-Partner-Portal-Timestamp', ''));
        $signature = trim((string) $request->header('X-Partner-Portal-Signature', ''));

        if ($email === '' || $timestamp === '' || $signature === '') {
            throw new AuthorizationException('Headers partner portal manquants.');
        }

        if (! ctype_digit($timestamp)) {
            throw new AuthorizationException('Timestamp partner portal invalide.');
        }

        if (abs(time() - (int) $timestamp) > 300) {
            throw new AuthorizationException('Signature partner portal expiree.');
        }

        $expected = hash_hmac('sha256', sprintf('%s.%s', $email, $timestamp), $sharedSecret);
        if (! hash_equals($expected, $signature)) {
            throw new AuthorizationException('Signature partner portal invalide.');
        }

        return $email;
    }
}