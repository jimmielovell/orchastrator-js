import { ConnectionOptions, Msg, NatsConnection } from 'nats/lib/nats-base-client/types';
import { connect, ErrorCode, NatsError } from 'nats';
import { Encoder, Decoder } from './dede/index.js';
import { cloneObject, generateUUID, getNodeID, isString, logger } from './utils.js';
import * as Errors from './errors.js';

interface LoggerInterface {
  log: Function,
  info: Function,
  error: Function,
  warn: Function,
  assert: Function
}

interface BrokerOptions {
  logger: LoggerInterface,
  nodeID: any
}

export class Orchastrator {
  options: BrokerOptions
  logger: any;
  connection: NatsConnection | undefined;
  readonly connectionOptions: ConnectionOptions;
  closed: Promise<any> | undefined;
  private static actionList = {};
  private services: any = null;
  nodeID: any;
  instanceID: string;
  encoder: Encoder = new Encoder();
  decoder: Decoder = new Decoder();

  constructor(connectionOptions: ConnectionOptions, opts: BrokerOptions | undefined) {
    this.logger = (opts?.logger) || logger;
    this.logger.setPrefix('[ORCHASTRATOR]');
    this.logger.info(`Starting...`);

    try {
      this.options = Object.assign({}, opts);
      this.connectionOptions = connectionOptions;

      // Self nodeID
      this.nodeID = this.options.nodeID || getNodeID();

      // Instance ID
      this.instanceID = generateUUID();
    } catch (err) {
      this.logger.error(`Cannot start: ${err}`);
    }
  }

  /**
   * End connection to nats server
   */
  async stop() {
    // Close the connection
    await this.connection?.close();
    // Check if the close was OK
    const err = await this.closed;
    if (err) {
      console.log(`Error closing:`, err);
    }
  }

  async createService(ServiceConstructor) {
    const instanceID = generateUUID();
    const options = this.connectionOptions;
    options.name = instanceID;

    // Connect this service to a nats server
    let nc: NatsConnection;
    try {
      nc = await connect(options);
      // Indicates the client closed
      ServiceConstructor.prototype.__closed = nc.closed();
    } catch (err) {
      // Clear all the cache
      this.logger.error(`An error occured while creating service: ${err}`);
      return;
    }

    if (ServiceConstructor.prototype.logger === undefined) {
      ServiceConstructor.prototype.logger = cloneObject(this.logger);
    }

    ServiceConstructor.prototype.nodeID = this.nodeID;
    ServiceConstructor.prototype.instanceID = instanceID;
    ServiceConstructor.prototype.request = (actionName, params, opts) => {
      return this.request(actionName, nc, params, opts);
    }
    ServiceConstructor.prototype.publish = (actionName, params, opts) => {
      if (Array.isArray(opts) || isString(opts)) {
        opts = { groups: opts };
      } else if (opts === null) {
        opts = {};
      }

      if (opts.groups && !Array.isArray(opts.groups)) {
        opts.groups = [opts.groups];
      }

      opts.parentCtx = this;

      return this.publish(actionName, nc, params, opts);
    }

    const serviceInstance = new ServiceConstructor();
    const serviceName = serviceInstance.name;
    serviceInstance.logger.setPrefix(`[${serviceName.toUpperCase()}]`);

    const topics = serviceInstance.topics || [];
    for (let i = 0, len = topics.length; i < len; i++) {
      const topic = topics[i];
      const subject = `${serviceName.toLowerCase()}.${topic}`;
      nc.subscribe(subject, {
        queue: serviceName,
        callback: async (err: NatsError, msg: Msg) => {
          if (err) {
            // Handle the error
          }

          const { headers, data, sid, reply } = msg;
          const params = this.decoder.decode(Buffer.from(data));

          if (reply) {
            let resp;
            try {
              resp = await serviceInstance[topic].call(serviceInstance, {
                headers,
                params
              });
            } catch (err) {
              const {code, name, message, data} = err;
              resp = {
                code,
                name,
                message,
                data
              };
            }

            msg.respond(this.encoder.encode(resp));
          } else {
            try {
              await serviceInstance[topic].call(serviceInstance, params);
            } catch (err) {}
          }
        }
      });
    }

    this.logger.info(`Created '${serviceName}' service successfully`);
    serviceInstance.logger.info(`Connected to nats-server on ${nc.getServer()}`);

    if (serviceInstance.created) {
      try {
        serviceInstance.created.call(serviceInstance);
      } catch (err) {
        await nc.close();
        this.logger.error(`Stopping '${serviceName}' service. Error encountered: ${err}`);
        // process.exit(1);
      }
    }

    // this.services[serviceName] = {
    //   name: serviceName,
    //   instance: serviceInstance,
    //   actions,
    // }

    return serviceInstance;
  }

  getServices() {
    return this.services;
  }

  private async request(subject: string, nc: NatsConnection, params, opts: any) {
    opts = this.encoder.encode({ params, opts });
    try {
      const {data, headers} = await nc.request(subject, opts, { timeout: 1000 });
      return this.decoder.decode(Buffer.from(data));
    } catch (err) {
      switch (err.code) {
        case ErrorCode.NoResponders:
          throw new Errors.NoRespondersError(err.data);
        case ErrorCode.Timeout:
          throw new Errors.RequestTimeoutError(err.data);
        default:
          throw new Errors.RequestError(err.data);
      }
    }
  }

  /**
	 * Publish on a subject
	 *
	 * @param {string} eventName
	 * @param {any?} payload
	 * @param {Object?} opts
	 * @returns {void}
	 */
  private publish(subject: string, nc: NatsConnection, params, opts: any) {
    opts = this.encoder.encode({ params, opts });
    nc.publish(subject, opts);
  }
}
