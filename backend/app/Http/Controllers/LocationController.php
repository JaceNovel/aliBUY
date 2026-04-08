<?php

namespace App\Http\Controllers;

use App\Services\LocationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LocationController extends Controller
{
    public function __construct(
        protected LocationService $locations,
    ) {
    }

    public function reverseGeocode(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        return response()->json($this->locations->reverseGeocode((float) $validated['latitude'], (float) $validated['longitude'], $request));
    }

    public function resolveMapsLink(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'url' => ['required', 'url'],
        ]);

        return response()->json($this->locations->resolveMapsLink($validated['url']));
    }
}