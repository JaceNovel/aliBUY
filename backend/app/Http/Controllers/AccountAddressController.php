<?php

namespace App\Http\Controllers;

use App\Models\CustomerAddress;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountAddressController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $addresses = CustomerAddress::query()
            ->where('user_id', $request->user('sanctum')->id)
            ->orderByDesc('is_default')
            ->latest()
            ->get()
            ->map(fn (CustomerAddress $address) => $this->transformAddress($address))
            ->values();

        return response()->json(['addresses' => $addresses]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validatePayload($request);
        $address = CustomerAddress::query()->create([
            ...$validated,
            'user_id' => $request->user('sanctum')->id,
        ]);

        if ($address->is_default) {
            CustomerAddress::query()
                ->where('user_id', $request->user('sanctum')->id)
                ->whereKeyNot($address->id)
                ->update(['is_default' => false]);
        }

        return response()->json(['address' => $this->transformAddress($address)], 201);
    }

    public function update(Request $request, CustomerAddress $address): JsonResponse
    {
        $this->assertOwnedByUser($request, $address);
        $validated = $this->validatePayload($request);
        $address->fill($validated)->save();

        if ($address->is_default) {
            CustomerAddress::query()
                ->where('user_id', $request->user('sanctum')->id)
                ->whereKeyNot($address->id)
                ->update(['is_default' => false]);
        }

        return response()->json(['address' => $this->transformAddress($address)]);
    }

    public function setDefault(Request $request, CustomerAddress $address): JsonResponse
    {
        $this->assertOwnedByUser($request, $address);
        $request->validate(['action' => ['required', 'in:set-default']]);

        CustomerAddress::query()->where('user_id', $request->user('sanctum')->id)->update(['is_default' => false]);
        $address->is_default = true;
        $address->save();

        return response()->json(['address' => $this->transformAddress($address)]);
    }

    public function destroy(Request $request, CustomerAddress $address): JsonResponse
    {
        $this->assertOwnedByUser($request, $address);
        $address->delete();

        return response()->json(['success' => true]);
    }

    protected function validatePayload(Request $request): array
    {
        $validated = $request->validate([
            'label' => ['required', 'string', 'max:255'],
            'recipientName' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'addressLine1' => ['required', 'string', 'max:255'],
            'addressLine2' => ['nullable', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:120'],
            'state' => ['required', 'string', 'max:120'],
            'postalCode' => ['nullable', 'string', 'max:40'],
            'countryCode' => ['required', 'string', 'size:2'],
            'isDefault' => ['nullable', 'boolean'],
        ]);

        return [
            'label' => $validated['label'],
            'contact_name' => $validated['recipientName'],
            'phone' => $validated['phone'],
            'email' => $validated['email'] ?? null,
            'address_line1' => $validated['addressLine1'],
            'address_line2' => $validated['addressLine2'] ?? null,
            'city' => $validated['city'],
            'state' => $validated['state'],
            'postal_code' => $validated['postalCode'] ?? null,
            'country_code' => strtoupper((string) $validated['countryCode']),
            'is_default' => (bool) ($validated['isDefault'] ?? false),
        ];
    }

    protected function assertOwnedByUser(Request $request, CustomerAddress $address): void
    {
        abort_unless($address->user_id === $request->user('sanctum')->id, 403, 'Acces refuse.');
    }

    protected function transformAddress(CustomerAddress $address): array
    {
        return [
            'id' => (string) $address->id,
            'label' => $address->label,
            'recipientName' => $address->contact_name,
            'phone' => $address->phone,
            'email' => $address->email,
            'addressLine1' => $address->address_line1,
            'addressLine2' => $address->address_line2,
            'city' => $address->city,
            'state' => $address->state,
            'postalCode' => $address->postal_code,
            'countryCode' => $address->country_code,
            'isDefault' => $address->is_default,
            'createdAt' => optional($address->created_at)->toIso8601String(),
            'updatedAt' => optional($address->updated_at)->toIso8601String(),
        ];
    }
}