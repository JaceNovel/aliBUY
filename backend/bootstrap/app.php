<?php

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))

    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )

    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();

        $middleware->alias([
            'abilities' => \Laravel\Sanctum\Http\Middleware\CheckAbilities::class,
            'ability' => \Laravel\Sanctum\Http\Middleware\CheckForAnyAbility::class,
            'partner.auth' => \App\Http\Middleware\PartnerAuthMiddleware::class,
            'partner.api.log' => \App\Http\Middleware\PartnerApiLogMiddleware::class,
        ]);

        $middleware->prependToGroup('api', EnsureFrontendRequestsAreStateful::class);
    })

    ->withExceptions(function (Exceptions $exceptions): void {
        $jsonError = static function (Request $request, string $message, int $status, array $extra = []) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json(array_merge([
                'error' => true,
                'message' => $message,
            ], $extra), $status);
        };

        $exceptions->render(function (ValidationException $exception, Request $request) use ($jsonError) {
            return $jsonError(
                $request,
                $exception->validator->errors()->first() ?: 'Validation invalide.',
                422,
                ['errors' => $exception->errors()]
            );
        });

        $exceptions->render(function (AuthenticationException $exception, Request $request) use ($jsonError) {
            return $jsonError($request, $exception->getMessage() ?: 'Authentification requise.', 401);
        });

        $exceptions->render(function (AuthorizationException $exception, Request $request) use ($jsonError) {
            return $jsonError($request, $exception->getMessage() ?: 'Action non autorisee.', 403);
        });

        $exceptions->render(function (ModelNotFoundException $exception, Request $request) use ($jsonError) {
            return $jsonError($request, 'Ressource introuvable.', 404);
        });

        $exceptions->render(function (HttpExceptionInterface $exception, Request $request) use ($jsonError) {
            return $jsonError($request, $exception->getMessage() ?: 'Erreur HTTP.', $exception->getStatusCode());
        });

        $exceptions->render(function (\Throwable $exception, Request $request) use ($jsonError) {
            return $jsonError($request, 'Erreur interne du serveur.', 500);
        });
    })

    ->create();
