'use strict';

import { Orchastrator } from "./orchastrator";
import { isString, generateUUID, mergeObjects, isObject } from "./utils";

// const util = require('util');
// const { RequestSkippedError, MaxCallLevelError } = require('./errors');

/**
 * Merge metadata
 *
 * @param {Object} newMeta
 *
 * @private
 * @memberof Context
 */
function mergeMeta(ctx, newMeta) {
	if (newMeta) {
		Object.assign(ctx.meta, newMeta);
  }
	return ctx.meta;
}

export class Context {
  id: string;

  service = null;
  action = null;

  options = {
    timeout: null,
    retries: null,
  };

  parentID = null;
  caller = null;

  level = 1;

  params = null;
  meta = {};

  requestID: string;

  tracing = null;
  span = null;
  _spanStack = [];

  needAck = null;
  ackID = null;

	constructor(opts: any) {
		this.id = generateUUID();

		this.options = {
			timeout: null,
			retries: null,
		};

		this.parentID = null;
		this.caller = null;

		this.level = 1;

		this.params = opts.params || {};
		this.meta = opts.meta ?? {};

		// this.requestID = this.id;

		this.tracing = null;
		this.span = null;
		this._spanStack = [];
	}
}
