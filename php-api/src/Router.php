<?php

declare(strict_types=1);

namespace YahooCrm;

final class Router
{
    /** @var list<array{method: string, regex: string, keys: list<string>, handler: callable}> */
    private array $routes = [];

    public function map(string $method, string $pattern, callable $handler): void
    {
        $keys = [];
        $regex = preg_replace_callback('/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/', static function (array $match) use (&$keys): string {
            $keys[] = $match[1];
            return '([^/]+)';
        }, $pattern);
        $this->routes[] = [
            'method' => strtoupper($method),
            'regex' => '#^' . $regex . '$#',
            'keys' => $keys,
            'handler' => $handler,
        ];
    }

    public function dispatch(Request $request): Response
    {
        foreach ($this->routes as $route) {
            if ($route['method'] !== $request->method) {
                continue;
            }
            if (!preg_match($route['regex'], $request->path, $matches)) {
                continue;
            }
            $params = [];
            foreach ($route['keys'] as $index => $key) {
                $params[$key] = rawurldecode($matches[$index + 1]);
            }
            $request->params = $params;
            $result = ($route['handler'])($request);
            if (!$result instanceof Response) {
                throw new \RuntimeException('Route did not return a response.');
            }
            return $result;
        }

        return Response::json(['success' => false, 'error' => 'Not found'], 404);
    }
}
