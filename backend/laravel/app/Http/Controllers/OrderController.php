<?php

namespace App\Http\Controllers;

use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class OrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $email = trim((string) $request->query('email', ''));
        $orders = Order::query()
            ->with('payments')
            ->when($email !== '', fn ($builder) => $builder->where('customer_email', $email))
            ->latest()
            ->paginate(min(max((int) $request->integer('limit', 20), 1), 50));

        return response()->json([
            'items' => collect($orders->items())->map(fn (Order $order) => $this->transformOrder($order))->values(),
            'page' => $orders->currentPage(),
            'nextPage' => $orders->hasMorePages() ? $orders->currentPage() + 1 : null,
            'hasMore' => $orders->hasMorePages(),
            'pageSize' => $orders->perPage(),
        ]);
    }

    public function show(Order $order): JsonResponse
    {
        $order->load('payments');

        return response()->json([
            'order' => $this->transformOrder($order),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customerName' => ['required', 'string', 'max:255'],
            'customerEmail' => ['required', 'email', 'max:255'],
            'customerPhone' => ['required', 'string', 'max:50'],
            'shippingMethod' => ['required', 'in:air,sea,freight'],
            'countryCode' => ['required', 'string', 'size:2'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.slug' => ['required', 'string'],
            'items.*.title' => ['nullable', 'string'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.image' => ['nullable', 'string'],
            'promoCode' => ['nullable', 'string', 'max:60'],
        ]);

        $totalPrice = collect($request->input('items', []))
            ->sum(fn (array $item) => (float) ($item['finalLinePriceFcfa'] ?? 0));

        $order = Order::create([
            'order_number' => 'AFR-' . strtoupper(Str::random(10)),
            'customer_email' => $validated['customerEmail'],
            'user_info' => [
                'customerName' => $validated['customerName'],
                'customerEmail' => $validated['customerEmail'],
                'customerPhone' => $validated['customerPhone'],
                'countryCode' => $validated['countryCode'],
                'items' => $request->input('items', []),
            ],
            'total_price' => $totalPrice,
            'status' => 'checkout_created',
            'payment_status' => 'unpaid',
            'payment_currency' => 'XOF',
            'shipping_method' => $validated['shippingMethod'],
            'meta' => [
                'promo' => $validated['promoCode']
                    ? [
                        'code' => strtoupper($validated['promoCode']),
                        'discountFcfa' => 0,
                        'baseTotalFcfa' => $totalPrice,
                        'finalTotalFcfa' => $totalPrice,
                    ]
                    : null,
            ],
        ]);

        return response()->json([
            'order' => $this->transformOrder($order),
        ], 201);
    }

    public function applyPromo(Order $order, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:60'],
        ]);

        $baseTotal = (float) $order->total_price;
        $discount = 0.0;
        $finalTotal = $baseTotal;
        $code = strtoupper($validated['code']);

        $order->meta = array_merge($order->meta ?? [], [
            'promo' => [
                'code' => $code,
                'discountFcfa' => $discount,
                'baseTotalFcfa' => $baseTotal,
                'finalTotalFcfa' => $finalTotal,
            ],
        ]);
        $order->save();

        return response()->json([
            'order' => $this->transformOrder($order),
            'promoCode' => $code,
            'promoDiscountLabel' => number_format($discount, 0, ',', ' ') . ' FCFA',
            'originalTotal' => number_format($baseTotal, 0, ',', ' ') . ' FCFA',
            'total' => number_format($finalTotal, 0, ',', ' ') . ' FCFA',
        ]);
    }

    protected function transformOrder(Order $order): array
    {
        $payment = $order->payments()->latest()->first();
        $userInfo = $order->user_info ?? [];

        return [
            'id' => (string) $order->id,
            'orderNumber' => (string) $order->order_number,
            'userId' => $userInfo['userId'] ?? null,
            'customerEmail' => (string) $order->customer_email,
            'customerName' => (string) ($userInfo['customerName'] ?? ''),
            'customerPhone' => (string) ($userInfo['customerPhone'] ?? ''),
            'shippingMethod' => (string) $order->shipping_method,
            'totalPriceFcfa' => (int) round((float) $order->total_price),
            'paymentStatus' => (string) $order->payment_status,
            'paymentCurrency' => (string) ($order->payment_currency ?? 'XOF'),
            'monerooPaymentId' => $payment?->transaction_id,
            'monerooCheckoutUrl' => $payment?->checkout_url,
            'monerooPaymentStatus' => $payment?->status,
            'createdAt' => optional($order->created_at)->toIso8601String(),
            'items' => collect($userInfo['items'] ?? [])->map(fn (array $item) => [
                'title' => $item['title'] ?? $item['productName'] ?? 'Produit',
                'productName' => $item['productName'] ?? $item['title'] ?? 'Produit',
                'image' => $item['image'] ?? '/globe.svg',
                'quantity' => (int) ($item['quantity'] ?? 1),
            ])->values(),
            'meta' => $order->meta,
        ];
    }
}
