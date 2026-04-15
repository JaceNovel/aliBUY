<?php

declare(strict_types=1);

use Dompdf\Dompdf;
use Dompdf\Options;

require __DIR__.'/../vendor/autoload.php';

$root = dirname(__DIR__, 2);
$sourcePath = $root.'/docs/generated/afripay-space-shein-api-profile.html';
$outputPath = $root.'/docs/generated/AfriPay_Space_SHEIN_API_Profile_2026-04-15.pdf';
if (! is_file($sourcePath)) {
    fwrite(STDERR, "Source HTML introuvable: {$sourcePath}\n");
    exit(1);
}

$html = file_get_contents($sourcePath);
if ($html === false) {
    fwrite(STDERR, "Impossible de lire la source HTML.\n");
    exit(1);
}

$options = new Options();
$options->set('isRemoteEnabled', false);
$options->set('isHtml5ParserEnabled', true);
$options->set('defaultFont', 'DejaVu Sans');

$dompdf = new Dompdf($options);
$dompdf->setPaper('A4');
$dompdf->loadHtml($html, 'UTF-8');
$dompdf->render();

file_put_contents($outputPath, $dompdf->output());

fwrite(STDOUT, "PDF genere: {$outputPath}\n");