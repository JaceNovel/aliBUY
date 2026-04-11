<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountSettingsController extends Controller
{
    protected function serializeSettings($user): array
    {
        return array_merge($user->settings ?? [], [
            'phone' => $user->phone,
            'updatedAt' => optional($user->updated_at)->toIso8601String(),
        ]);
    }

    public function show(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');

        return response()->json([
            'user' => [
                'id' => (string) $user->id,
                'email' => $user->email,
                'displayName' => $user->name,
                'phone' => $user->phone,
                'firstName' => str($user->name)->before(' ')->value(),
                'createdAt' => optional($user->created_at)->toIso8601String(),
            ],
            'settings' => $this->serializeSettings($user),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        $validated = $request->validate([
            'displayName' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'profilePhotoUrl' => ['nullable', 'string'],
            'bio' => ['nullable', 'string'],
            'memberRole' => ['nullable', 'string', 'max:255'],
            'companyName' => ['nullable', 'string', 'max:255'],
            'activitySummary' => ['nullable', 'string'],
            'connectedGoogleEmail' => ['nullable', 'string', 'max:255'],
            'connectedAppleEmail' => ['nullable', 'string', 'max:255'],
            'connectedWhatsapp' => ['nullable', 'string', 'max:50'],
            'manychatSubscriberId' => ['nullable', 'string', 'max:255'],
            'manychatFlowId' => ['nullable', 'string', 'max:255'],
            'manychatPaidTagId' => ['nullable', 'string', 'max:255'],
            'taxId' => ['nullable', 'string', 'max:255'],
            'businessId' => ['nullable', 'string', 'max:255'],
            'billingAddress' => ['nullable', 'string'],
            'twoFactorEnabled' => ['nullable', 'boolean'],
            'twoFactorPhone' => ['nullable', 'string', 'max:50'],
            'smsSecurityAlerts' => ['nullable', 'boolean'],
            'smsOrderUpdates' => ['nullable', 'boolean'],
            'smsLogisticsReminders' => ['nullable', 'boolean'],
            'privacyProfileVisible' => ['nullable', 'boolean'],
            'privacyActivityVisible' => ['nullable', 'boolean'],
            'privacyPersonalizedData' => ['nullable', 'boolean'],
            'emailOrderUpdates' => ['nullable', 'boolean'],
            'emailMarketing' => ['nullable', 'boolean'],
            'emailWeeklyDigest' => ['nullable', 'boolean'],
            'adsPersonalized' => ['nullable', 'boolean'],
            'adsInterestBased' => ['nullable', 'boolean'],
            'adsCampaignFrequency' => ['nullable', 'in:faible,normale,elevee'],
        ]);

        if (! empty($validated['displayName'])) {
            $user->name = $validated['displayName'];
        }

        if (array_key_exists('phone', $validated)) {
            $user->phone = $validated['phone'];
        }

        $settings = array_merge($user->settings ?? [], collect($validated)->except(['displayName', 'phone'])->all());
        $user->settings = $settings;
        $user->save();

        return response()->json([
            'ok' => true,
            'settings' => $this->serializeSettings($user),
        ]);
    }
}