<?php

namespace App\Erp\Exceptions;

use RuntimeException;

class ErpException extends RuntimeException
{
    public function __construct(
        public readonly string $errorCode,
        string $userMessage,
        public readonly int $httpStatus = 400,
        public readonly array $details = [],
    ) {
        parent::__construct($userMessage, $httpStatus);
    }
}
