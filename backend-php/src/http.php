<?php

declare(strict_types=1);

ini_set('display_errors', '0');

function respond(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function app_config(): array
{
    static $config = null;
    if (is_array($config)) {
        return $config;
    }

    $path = dirname(__DIR__) . '/config.php';
    if (!is_file($path)) {
        respond(500, ['error' => 'Backend is not configured. Create config.php.']);
    }

    $loaded = require $path;
    if (!is_array($loaded)) {
        respond(500, ['error' => 'Backend configuration is invalid.']);
    }

    $secret = (string) ($loaded['file_url_secret'] ?? '');
    if (strlen($secret) < 32 || str_contains($secret, 'CHANGE_ME')) {
        respond(500, ['error' => 'Set a strong file_url_secret in config.php.']);
    }

    return $config = $loaded;
}

function send_cors(array $allowedOrigins, string $methods = 'POST, OPTIONS'): void
{
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin === '' || !in_array($origin, $allowedOrigins, true)) {
        return;
    }

    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: ' . $methods);
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Access-Control-Max-Age: 86400');
}

function bearer_token(): string
{
    $header = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if ($header === '') {
        $header = (string) ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    }

    if ($header === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strcasecmp((string) $name, 'Authorization') === 0) {
                $header = (string) $value;
                break;
            }
        }
    }

    if ($header === '' && function_exists('apache_request_headers')) {
        foreach (apache_request_headers() as $name => $value) {
            if (strcasecmp((string) $name, 'Authorization') === 0) {
                $header = (string) $value;
                break;
            }
        }
    }

    if (preg_match('/^Bearer\s+(\S+)$/i', trim($header), $matches) !== 1) {
        return '';
    }

    return $matches[1];
}

function firebase_uid_from_token(array $config, string $idToken): ?string
{
    if ($idToken === '' || !function_exists('curl_init')) {
        return null;
    }

    $apiKey = (string) ($config['firebase_api_key'] ?? '');
    $lookupUrl = (string) ($config['auth_lookup_url'] ?? '');
    if ($apiKey === '' || $lookupUrl === '') {
        return null;
    }

    $separator = str_contains($lookupUrl, '?') ? '&' : '?';
    $url = $lookupUrl . $separator . 'key=' . rawurlencode($apiKey);

    $handle = curl_init($url);
    if ($handle === false) {
        return null;
    }

    curl_setopt_array($handle, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(['idToken' => $idToken]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_FOLLOWLOCATION => false
    ]);

    $body = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
    curl_close($handle);

    if (!is_string($body) || $status !== 200) {
        error_log('chat-api: Firebase token lookup failed with status ' . $status);
        return null;
    }

    $data = json_decode($body, true);
    $uid = $data['users'][0]['localId'] ?? null;

    return is_string($uid) && $uid !== '' ? $uid : null;
}

function storage_root(array $config, bool $requireWritable = true): string
{
    $root = realpath((string) ($config['storage_dir'] ?? ''));
    if ($root === false || !is_dir($root)) {
        respond(500, ['error' => 'Storage directory was not found.']);
    }
    if ($requireWritable && !is_writable($root)) {
        respond(500, ['error' => 'Storage directory is not writable.']);
    }

    return $root;
}

function signed_file_url(array $config, string $relativePath): string
{
    $base = rtrim((string) ($config['public_base_url'] ?? ''), '/');
    if ($base === '') {
        respond(500, ['error' => 'Set public_base_url in config.php.']);
    }

    $signature = hash_hmac('sha256', $relativePath, (string) $config['file_url_secret']);

    return $base . '/file.php?p=' . rawurlencode($relativePath) . '&s=' . $signature;
}
