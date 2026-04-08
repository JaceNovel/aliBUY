<?php

namespace App\Http\Controllers;

use App\Services\ImageSearchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ImageSearchController extends Controller
{
    public function __construct(
        protected ImageSearchService $imageSearch,
    ) {
    }

    public function search(Request $request): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'file', 'image', 'max:8192'],
        ]);

        return response()->json($this->imageSearch->search($request));
    }
}