'use strict';

import { ErrorCode } from 'nats';

/**
 * Credits to https://github.com/bjyoungblood/es6-error/blob/master/src/index.js
 */
class OrchastratorError extends Error {
	code:number = 500;
	type: string;
	data: any;
	retryable: boolean = false;

  constructor(message = '', code?: number, type?: string, data?: any) {
    super(message);

    Object.defineProperty(this, 'message', {
      configurable: true,
      enumerable : false,
      value : message,
      writable : true,
    });

    Object.defineProperty(this, 'name', {
      configurable: true,
      enumerable : false,
      value : this.constructor.name,
      writable : true,
    });

    if (Error.hasOwnProperty('captureStackTrace')) {
      Error.captureStackTrace(this, this.constructor);
      return;
    }

    Object.defineProperty(this, 'stack', {
      configurable: true,
      enumerable : false,
      value : (new Error(message)).stack,
      writable : true,
    });
  }
}

/**
 * Custom Orchastrator Error class for retryable errors.
 *
 * @class RetryableError
 * @extends {OrchastratorError}
 */
export class RetryableError extends OrchastratorError {
	constructor(message, code, type, data) {
		super(message, undefined, undefined, undefined);
		this.code = code || 500;
		this.type = type;
		this.data = data;
		this.retryable = true;
	}
}

export class NoRespondersError extends OrchastratorError {
	constructor(data) {
		super('Service did not respond', 404, 'NO_RESPONDER', data);
	}
}

/**
 * Orchastrator Error class for server error which is retryable.
 *
 * @class OrchastratorServerError
 * @extends {RetryableError}
 */
export class OrchastratorServerError extends RetryableError {
}

/**
 * Orchastrator Error class for client errors which is not retryable.
 *
 * @class OrchastratorClientError
 * @extends {OrchastratorError}
 */
export class OrchastratorClientError extends OrchastratorError {
	constructor(message, code, type, data) {
		super(message, code || 400, type, data);
	}
}


/**
 * 'Service not found' Error message
 *
 * @class ServiceNotFoundError
 * @extends {RetryableError}
 */
export class ServiceNotFoundError extends RetryableError {
	constructor(data = {}) {
		let msg;

		super('Service not found', 404, 'SERVICE_NOT_FOUND', data);
	}
}

/**
 * 'Service not available' Error message
 *
 * @class ServiceNotAvailableError
 * @extends {RetryableError}
 */
export class ServiceNotAvailableError extends RetryableError {
	constructor(data) {
		let msg;
		if (data.nodeID)
			msg = `Service '${data.action}' is not available on '${data.nodeID}' node.`;
		else
			msg = `Service '${data.action}' is not available.`;

		super(msg, 404, 'SERVICE_NOT_AVAILABLE', data);
	}
}

/**
 * 'Request timed out' Error message. Retryable.
 *
 * @class RequestTimeoutError
 * @extends {RetryableError}
 */
 export class RequestError extends RetryableError {
	constructor(data) {
		super(`Request .`, ErrorCode.RequestError, 'REQUEST_TIMEOUT', data);
	}
}

/**
 * 'Request timed out' Error message. Retryable.
 *
 * @class RequestTimeoutError
 * @extends {RetryableError}
 */
export class RequestTimeoutError extends RetryableError {
	constructor(data) {
		super(`Request timed out when calling '${data.action}' action on '${data.nodeID}' node.`, ErrorCode.Timeout, 'REQUEST_TIMEOUT', data);
	}
}

/**
 * 'Request skipped for timeout' Error message
 *
 * @class RequestSkippedError
 * @extends {OrchastratorError}
 */
export class RequestSkippedError extends OrchastratorError {
	constructor(data) {
		super(`Calling '${data.action}' is skipped because timeout reached on '${data.nodeID}' node.`, 514, 'REQUEST_SKIPPED', data);
		this.retryable = false;
	}
}

/**
 * 'Request rejected' Error message. Retryable.
 *
 * @class RequestRejectedError
 * @extends {RetryableError}
 */
export class RequestRejectedError extends RetryableError {
	constructor(data) {
		super(`Request is rejected when call '${data.action}' action on '${data.nodeID}' node.`, 503, 'REQUEST_REJECTED', data);
	}
}

/**
 * 'Parameters of action call validation error
 *
 * @class ValidationError
 * @extends {OrchastratorClientError}
 */
export class ValidationError extends OrchastratorClientError {
	constructor(message, type, data) {
		super(message, 422, type || 'VALIDATION_ERROR', data);
	}
}

/**
 * 'Max request call level!' Error message
 *
 * @class MaxCallLevelError
 * @extends {OrchastratorError}
 */
export class MaxCallLevelError extends OrchastratorError {
	constructor(data) {
		super(`Request level is reached the limit (${data.level}) on '${data.nodeID}' node.`, 500, 'MAX_CALL_LEVEL', data);
		this.retryable = false;
	}
}

/**
 * Custom Orchastrator Error class for broker option errors
 *
 * @class BrokerOptionsError
 * @extends {Error}
 */
export class OrchastratorOptionsError extends OrchastratorError {
	constructor(msg, data) {
		super(msg, 500, 'ORCHASTRATOR_OPTIONS_ERROR', data);
	}
}

/**
 * Custom Orchastrator Error class for Graceful stopping
 *
 * @class GracefulStopTimeoutError
 * @extends {Error}
 */
export class GracefulStopTimeoutError extends OrchastratorError {
	constructor(data) {
		if (data && data.service)  {
			super(`Unable to stop '${data.service.name}' service gracefully.`, 500, 'GRACEFUL_STOP_TIMEOUT', data && data.service ? {
				name: data.service.name,
				version: data.service.version
			} : null);
		} else {
			super('Unable to stop ServiceBroker gracefully.', 500, 'GRACEFUL_STOP_TIMEOUT', undefined);
		}
	}
}

/**
 * Protocol version is mismatch
 *
 * @class ProtocolVersionMismatchError
 * @extends {Error}
 */
export class ProtocolVersionMismatchError extends OrchastratorError {
	constructor(data) {
		super('Protocol version mismatch.', 500, 'PROTOCOL_VERSION_MISMATCH', data);
	}
}

/**
 * Recreate an error from a transferred payload `err`
 *
 * @param {Error} err
 * @returns {OrchastratorError}
 */
export function recreateError(err) {
	const Class = module.exports[err.name];
	if (Class) {
		switch(err.name) {
			case 'OrchastratorError': return new Class(err.message, err.code, err.type, err.data);
			case 'RetryableError': return new Class(err.message, err.code, err.type, err.data);
			case 'OrchastratorServerError': return new Class(err.message, err.code, err.type, err.data);
			case 'OrchastratorClientError': return new Class(err.message, err.code, err.type, err.data);

			case 'ValidationError': return new Class(err.message, err.type, err.data);

			case 'ServiceNotFoundError': return new Class(err.data);
			case 'ServiceNotAvailableError': return new Class(err.data);
			case 'RequestTimeoutError': return new Class(err.data);
			case 'RequestSkippedError': return new Class(err.data);
			case 'RequestRejectedError': return new Class(err.data);
			case 'QueueIsFullError': return new Class(err.data);
			case 'MaxCallLevelError': return new Class(err.data);
			case 'GracefulStopTimeoutError': return new Class(err.data);
			case 'ProtocolVersionMismatchError': return new Class(err.data);

			case 'ServiceSchemaError':
			case 'OrchastratorOptionsError': return new Class(err.message, err.data);
		}
	}
}