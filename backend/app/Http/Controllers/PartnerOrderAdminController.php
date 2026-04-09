<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Services\PartnerOrderService;
use App\Services\PartnerService;
use App\Services\PartnerSettlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PartnerOrderAdminController extends Controller
{
    public function __construct(
        protected PartnerOrderService $partnerOrders,
        protected PartnerService $partners,
        protected PartnerSettlementService $partnerSettlement,
    ) {
    }

    public function updateStatus(Order $order, Request $request): JsonResponse
    {
        $this->partners->assertAdmin($request->user('sanctum'));

        $validated = $request->validate([
            'status' => ['required', 'in:processing,shipped,delivered,cancelled'],
            'description' => ['required', 'string', 'max:255'],
            'tracking_reference' => ['nullable', 'string', 'max:255'],
        ]);

        $this->partnerOrders->recordTrackingUpdate(
            $order,
            $validated['status'],
            $validated['description'],
            $validated['tracking_reference'] ?? null,
        );

        $this->partnerSettlement->dispatchOrderUpdatedWebhook($order->fresh(['partnerOrder.partner', 'trackingEvents', 'payments']));

        return response()->json([
            'order' => $this->partnerOrders->transformPartnerOrderDetail($order->partnerOrder()->with(['order.trackingEvents', 'order.payments'])->firstOrFail()),
        ]);
    }
}