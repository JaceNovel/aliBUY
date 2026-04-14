<?php

namespace App\Http\Controllers;

use App\Models\CustomerAddress;
use App\Models\Order;
use App\Models\User;
use App\Services\OrderService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function __construct(
        protected OrderService $orders,
    ) {
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');

        return response()->json([
            'user' => [
                'id' => (string) $user->id,
                'email' => $user->email,
                'displayName' => $user->name,
                'firstName' => str($user->name)->before(' ')->value(),
                'createdAt' => optional($user->created_at)->toIso8601String(),
            ],
        ]);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        $admin = $request->user('sanctum');

        if (! $admin || ! $admin->hasAdminAccess()) {
            abort(403, 'Acces admin requis.');
        }

        $limit = min(max((int) $request->integer('limit', 200), 1), 500);
        $users = User::query()
            ->latest()
            ->limit($limit)
            ->get();

        $ordersByUser = $this->loadOrdersForUsers($users);
        $addressesByUser = CustomerAddress::query()
            ->whereIn('user_id', $users->pluck('id')->all())
            ->get()
            ->groupBy('user_id');

        return response()->json([
            'users' => $users->map(function (User $user) use ($ordersByUser, $addressesByUser) {
                $orders = $ordersByUser->get((string) $user->id, collect());
                $addresses = $addressesByUser->get($user->id, collect());

                return $this->transformAdminUser($user, $orders, $addresses);
            })->values()->all(),
        ]);
    }

    public function adminShow(User $user, Request $request): JsonResponse
    {
        $admin = $request->user('sanctum');

        if (! $admin || ! $admin->hasAdminAccess()) {
            abort(403, 'Acces admin requis.');
        }

        $orders = Order::query()
            ->with('payments')
            ->where(function ($query) use ($user) {
                $query->where('user_id', $user->id)
                    ->orWhereRaw('LOWER(customer_email) = ?', [strtolower((string) $user->email)]);
            })
            ->latest()
            ->get();

        $addresses = CustomerAddress::query()
            ->where('user_id', $user->id)
            ->orderByDesc('is_default')
            ->latest()
            ->get();

        return response()->json([
            'user' => $this->transformAdminUser($user, $orders, $addresses),
            'addresses' => $addresses->map(fn (CustomerAddress $address) => $this->transformAddress($address))->values()->all(),
            'orders' => $orders->map(fn (Order $order) => $this->orders->transformOrder($order))->values()->all(),
        ]);
    }

    protected function loadOrdersForUsers(Collection $users): Collection
    {
        if ($users->isEmpty()) {
            return collect();
        }

        $userIds = $users->pluck('id')->filter()->values()->all();
        $emails = $users->pluck('email')
            ->filter(fn ($email) => is_string($email) && trim($email) !== '')
            ->map(fn (string $email) => strtolower($email))
            ->values()
            ->all();

        $orders = Order::query()
            ->with('payments')
            ->where(function ($query) use ($userIds, $emails) {
                if ($userIds !== []) {
                    $query->whereIn('user_id', $userIds);
                }

                if ($emails !== []) {
                    $method = $userIds !== [] ? 'orWhereIn' : 'whereIn';
                    $query->{$method}(\Illuminate\Support\Facades\DB::raw('LOWER(customer_email)'), $emails);
                }
            })
            ->latest()
            ->get();

        return $users->mapWithKeys(function (User $user) use ($orders) {
            $userEmail = strtolower((string) $user->email);

            $matchedOrders = $orders->filter(function (Order $order) use ($user, $userEmail) {
                if ((string) $order->user_id === (string) $user->id) {
                    return true;
                }

                return $userEmail !== '' && strtolower((string) $order->customer_email) === $userEmail;
            })->values();

            return [(string) $user->id => $matchedOrders];
        });
    }

    protected function transformAdminUser(User $user, Collection $orders, Collection $addresses): array
    {
        $paidOrdersCount = $orders->filter(function (Order $order) {
            $status = strtolower((string) $order->payment_status);

            return in_array($status, ['paid', 'completed', 'successful', 'success'], true);
        })->count();

        return [
            'id' => (string) $user->id,
            'displayName' => (string) $user->name,
            'email' => (string) $user->email,
            'phone' => (string) ($user->phone ?? ''),
            'role' => $user->effective_role,
            'createdAt' => optional($user->created_at)->toIso8601String(),
            'ordersCount' => $orders->count(),
            'paidOrdersCount' => $paidOrdersCount,
            'addressesCount' => $addresses->count(),
            'quotesCount' => 0,
            'conversationsCount' => 0,
            'status' => $orders->isNotEmpty() || $addresses->isNotEmpty() ? 'Actif' : 'Nouveau',
        ];
    }

    protected function transformAddress(CustomerAddress $address): array
    {
        return [
            'id' => (string) $address->id,
            'label' => $address->label,
            'recipientName' => (string) ($address->contact_name ?? ''),
            'phone' => (string) ($address->phone ?? ''),
            'email' => (string) ($address->email ?? ''),
            'addressLine1' => (string) ($address->address_line1 ?? ''),
            'addressLine2' => (string) ($address->address_line2 ?? ''),
            'city' => (string) ($address->city ?? ''),
            'state' => (string) ($address->state ?? ''),
            'postalCode' => (string) ($address->postal_code ?? ''),
            'countryCode' => (string) ($address->country_code ?? ''),
            'isDefault' => (bool) $address->is_default,
            'createdAt' => optional($address->created_at)->toIso8601String(),
        ];
    }
}