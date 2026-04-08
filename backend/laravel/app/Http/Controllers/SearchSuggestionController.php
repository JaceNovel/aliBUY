<?php

namespace App\Http\Controllers;

use App\Services\SearchSuggestionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchSuggestionController extends Controller
{
    public function __construct(
        protected SearchSuggestionService $searchSuggestions,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'suggestions' => $this->searchSuggestions->getSuggestions((string) $request->query('q', ''), (int) $request->integer('limit', 8)),
        ]);
    }
}