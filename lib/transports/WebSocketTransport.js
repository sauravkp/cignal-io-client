const io = require("socket.io-client");
const { sleep } = require("../utils");
const Logger = require("../Logger");
const EnhancedEventEmitter = require("../EnhancedEventEmitter");
const Message = require("../Message");

const logger = new Logger("WebSocketTransport");

class WebSocketTransport extends EnhancedEventEmitter {
  /**
   * @param {String} url - WebSocket URL.
   * @param {Object} [options] - Options for WebSocket-Node.W3CWebSocket and retry.
   */
  constructor(url, params) {
    super(logger);

    logger.debug("constructor() [url:%s, options:%o]", url, params);

    // Closed flag.
    // @type {Boolean}
    this._closed = false;

    // WebSocket URL.
    // @type {String}
    this._url = url;
    this._connected = false;
    // Options.
    // @type {Object}
    this._params = params || {};

    // WebSocket instance.
    // @type {WebSocket}
    this._socket = null;

    // Run the WebSocket.
    this._createSocket();
  }

  get closed() {
    return this._closed;
  }

  close() {
    if (this._closed) return;

    logger.debug("close()");

    // Don't wait for the WebSocket 'close' event, do it now.
    this._closed = true;
    this.safeEmit("close");

    try {
      this._socket.disconnect();
    } catch (error) {
      logger.error("close() | error closing the WebSocket: %o", error);
    }
  }

  async send(message) {
    if (this._closed) throw new Error("transport closed");

    try {
      this._socket.send(JSON.stringify(message));
    } catch (error) {
      logger.warn("send() failed:%o", error);

      throw error;
    }
  }

  _createSocket() {
    if (!this._url)
      throw new Error("Cannot create socket without a valid connection url");
    // logger.debug("Going to create a socket with joinType:", this._joinType);
    const socket = io(this._url, {
      rejectUnauthorized: false,
    });
    socket.on("connect", () => {
      if (this._connected) {
        logger.debug("Socket already connected!");
      } else {
        logger.debug("connected to socket");
        this._connected = true;
        this.safeEmit("open");
      }
    });

    socket.on("disconnect", async () => {
      logger.error("socket disconnected!");
      this._connected = false;
      this.safeEmit("disconnected");
      if (this._closed) {
        logger.debug("No need to reconnect for roomClient close!");
      } else {
        if (this._reconnectionCounter > 240) {
          logger.debug(
            "Reconnection not needed if user disconnection for more than 2 minutes, reconnection counter:",
            this._reconnectionCounter
          );
          return;
        }

        this._socket.close();
        this._socket = null;
        this._createSocket();
        this._reconnectionCounter += 1;
        await sleep(500);
      }
    });

    socket.on("reconnect", () => {
      logger.debug("socket reconnected after disconnect");
      this.safeEmit("reconnect");
    });

    socket.on("connect_error", (err) => {
      logger.error("socket connect error", err);
      this._connected = false;
    });

    socket.on("error", (err) => {
      logger.error("Socket error", err);
      this._connected = false;
      this.safeEmit("failed");
    });

    socket.on("message", (msg) => {
      // logger.debug("Received message is ", msg);

      if (this._closed) return;

      const message = Message.parse(msg);
      // logger.debug("Received message after parsing is", message);
      if (!message) return;

      if (this.listenerCount("message") === 0) {
        logger.error(
          'no listeners for WebSocket "message" event, ignoring received message'
        );

        return;
      }

      // Emit 'message' event.
      this.safeEmit("message", message);
    });

    this._socket = socket;
  }
}

module.exports = WebSocketTransport;
