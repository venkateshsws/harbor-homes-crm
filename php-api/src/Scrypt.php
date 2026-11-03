<?php

declare(strict_types=1);

namespace YahooCrm;

/**
 * RFC 7914 scrypt. The Windows PHP build used for this project does not
 * expose hash('scrypt'), and existing accounts were hashed by Node.js crypto.scrypt.
 */
final class Scrypt
{
    private const MAX_MEMORY = 67108864;

    private static ?\FFI $crypto = null;

    private static bool $cryptoUnavailable = false;

    public static function derive(string $password, string $salt, int $n, int $r, int $p, int $length): string
    {
        if ($n < 2 || ($n & ($n - 1)) !== 0) {
            throw new \RuntimeException('scrypt cost must be a power of two.');
        }
        if ($r < 1 || $p < 1 || $length < 1) {
            throw new \RuntimeException('Invalid scrypt parameters.');
        }

        $native = self::openSsl($password, $salt, $n, $r, $p, $length);
        if ($native !== null) {
            return $native;
        }

        $block = 128 * $r;
        $mixed = hash_pbkdf2('sha256', $password, $salt, 1, $p * $block, true);
        if ($mixed === false || strlen($mixed) !== $p * $block) {
            throw new \RuntimeException('PBKDF2 could not prepare the scrypt blocks.');
        }

        $output = '';
        for ($i = 0; $i < $p; $i++) {
            $output .= self::roMix(substr($mixed, $i * $block, $block), $n, $r);
        }

        $derived = hash_pbkdf2('sha256', $password, $output, 1, $length, true);
        if ($derived === false) {
            throw new \RuntimeException('PBKDF2 could not finish the scrypt key.');
        }
        return $derived;
    }

    private static function openSsl(string $password, string $salt, int $n, int $r, int $p, int $length): ?string
    {
        $ffi = self::crypto();
        if ($ffi === null) {
            return null;
        }

        try {
            $pass = $ffi->new('char[' . (strlen($password) + 1) . ']');
            \FFI::memcpy($pass, $password, strlen($password));
            $saltBuf = $ffi->new('unsigned char[' . strlen($salt) . ']');
            \FFI::memcpy($saltBuf, $salt, strlen($salt));
            $key = $ffi->new("unsigned char[$length]");
            $ok = $ffi->EVP_PBE_scrypt(
                $pass,
                strlen($password),
                $saltBuf,
                strlen($salt),
                $n,
                $r,
                $p,
                self::MAX_MEMORY,
                $key,
                $length
            );
        } catch (\Throwable) {
            return null;
        }

        if ($ok !== 1) {
            return null;
        }

        return \FFI::string($key, $length);
    }

    private static function crypto(): ?\FFI
    {
        if (self::$crypto instanceof \FFI) {
            return self::$crypto;
        }
        if (self::$cryptoUnavailable || !extension_loaded('ffi')) {
            return null;
        }

        $library = self::libraryPath();
        if ($library === null) {
            self::$cryptoUnavailable = true;
            return null;
        }

        try {
            self::$crypto = \FFI::cdef(
                'int EVP_PBE_scrypt(const char *pass, size_t passlen, const unsigned char *salt, size_t saltlen, uint64_t N, uint64_t r, uint64_t p, uint64_t maxmem, unsigned char *key, size_t keylen);',
                $library
            );
        } catch (\Throwable) {
            self::$cryptoUnavailable = true;
            return null;
        }

        return self::$crypto;
    }

    private static function libraryPath(): ?string
    {
        $names = PHP_OS_FAMILY === 'Windows'
            ? ['libcrypto-3-x64.dll', 'libcrypto-3.dll', 'libcrypto.dll']
            : ['libcrypto.so.3', 'libcrypto.so.1.1', 'libcrypto.so'];
        $directory = dirname(PHP_BINARY);
        foreach ($names as $name) {
            $path = $directory . DIRECTORY_SEPARATOR . $name;
            if (is_file($path)) {
                return $path;
            }
        }

        return PHP_OS_FAMILY === 'Windows' ? null : $names[0];
    }

    private static function roMix(string $block, int $n, int $r): string
    {
        $v = [];
        $x = $block;
        for ($i = 0; $i < $n; $i++) {
            $v[$i] = $x;
            $x = self::blockMix($x, $r);
        }
        $mask = $n - 1;
        for ($i = 0; $i < $n; $i++) {
            $j = self::integerify($x) & $mask;
            $x = self::blockMix($x ^ $v[$j], $r);
        }
        return $x;
    }

    private static function blockMix(string $block, int $r): string
    {
        $x = substr($block, ($r * 2 - 1) * 64, 64);
        $y = [];
        for ($i = 0, $count = $r * 2; $i < $count; $i++) {
            $x = self::salsa20_8($x ^ substr($block, $i * 64, 64));
            $y[$i] = $x;
        }
        $out = '';
        for ($i = 0; $i < $r; $i++) {
            $out .= $y[$i * 2];
        }
        for ($i = 0; $i < $r; $i++) {
            $out .= $y[$i * 2 + 1];
        }
        return $out;
    }

    private static function salsa20_8(string $block): string
    {
        $words = unpack('V16', $block);
        if ($words === false) {
            throw new \RuntimeException('scrypt block was not 64 bytes.');
        }
        $b = array_values($words);
        $x = $b;
        for ($i = 0; $i < 8; $i += 2) {
            $x[4]  ^= self::rot(self::add($x[0], $x[12]), 7);
            $x[8]  ^= self::rot(self::add($x[4], $x[0]), 9);
            $x[12] ^= self::rot(self::add($x[8], $x[4]), 13);
            $x[0]  ^= self::rot(self::add($x[12], $x[8]), 18);

            $x[9]  ^= self::rot(self::add($x[5], $x[1]), 7);
            $x[13] ^= self::rot(self::add($x[9], $x[5]), 9);
            $x[1]  ^= self::rot(self::add($x[13], $x[9]), 13);
            $x[5]  ^= self::rot(self::add($x[1], $x[13]), 18);

            $x[14] ^= self::rot(self::add($x[10], $x[6]), 7);
            $x[2]  ^= self::rot(self::add($x[14], $x[10]), 9);
            $x[6]  ^= self::rot(self::add($x[2], $x[14]), 13);
            $x[10] ^= self::rot(self::add($x[6], $x[2]), 18);

            $x[3]  ^= self::rot(self::add($x[15], $x[11]), 7);
            $x[7]  ^= self::rot(self::add($x[3], $x[15]), 9);
            $x[11] ^= self::rot(self::add($x[7], $x[3]), 13);
            $x[15] ^= self::rot(self::add($x[11], $x[7]), 18);

            $x[1]  ^= self::rot(self::add($x[0], $x[3]), 7);
            $x[2]  ^= self::rot(self::add($x[1], $x[0]), 9);
            $x[3]  ^= self::rot(self::add($x[2], $x[1]), 13);
            $x[0]  ^= self::rot(self::add($x[3], $x[2]), 18);

            $x[6]  ^= self::rot(self::add($x[5], $x[4]), 7);
            $x[7]  ^= self::rot(self::add($x[6], $x[5]), 9);
            $x[4]  ^= self::rot(self::add($x[7], $x[6]), 13);
            $x[5]  ^= self::rot(self::add($x[4], $x[7]), 18);

            $x[11] ^= self::rot(self::add($x[10], $x[9]), 7);
            $x[8]  ^= self::rot(self::add($x[11], $x[10]), 9);
            $x[9]  ^= self::rot(self::add($x[8], $x[11]), 13);
            $x[10] ^= self::rot(self::add($x[9], $x[8]), 18);

            $x[12] ^= self::rot(self::add($x[15], $x[14]), 7);
            $x[13] ^= self::rot(self::add($x[12], $x[15]), 9);
            $x[14] ^= self::rot(self::add($x[13], $x[12]), 13);
            $x[15] ^= self::rot(self::add($x[14], $x[13]), 18);
        }
        for ($i = 0; $i < 16; $i++) {
            $b[$i] = self::add($b[$i], $x[$i]);
        }
        return pack('V16', ...$b);
    }

    private static function integerify(string $block): int
    {
        $words = unpack('V', substr($block, -64, 4));
        return $words[1];
    }

    private static function add(int $a, int $b): int
    {
        return ($a + $b) & 0xFFFFFFFF;
    }

    private static function rot(int $value, int $bits): int
    {
        $value &= 0xFFFFFFFF;
        return (($value << $bits) | ($value >> (32 - $bits))) & 0xFFFFFFFF;
    }
}
