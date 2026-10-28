'use strict';
/** 指令队列：串行发送，默认间隔 500ms，避免刷屏被服务器挡 */
class Cmd {
  #socket;
  #list = [];
  #lastTime = 0;
  #timer = null;

  constructor(socket) {
    this.#socket = socket;
  }

  send(commandString, wait = true) {
    if (typeof commandString !== 'string' || !commandString.trim()) return;

    if (!wait) {
      for (const c of commandString.split(';')) {
        if (c.trim()) this.#socket.ws.send(c.trim() + "\n");
      }
      return;
    }
    this.#list.push(...commandString.split(';').filter((c) => c.trim()));
    this.#run();
  }

  clear() {
    this.#list = [];
  }

  get pending() {
    return this.#list.length;
  }

  #run() {
    if (this.#timer) return;
    if (!this.#list.length || !this.#socket.connected) return;

    const now = Date.now();
    const wait = Math.max(0, 500 - (now - this.#lastTime));
    this.#timer = setTimeout(() => {
      this.#timer = null;
      if (!this.#list.length || !this.#socket.connected) return;
      const cmd = this.#list.shift();
      this.#socket.ws.send(cmd + "\n");
      this.#lastTime = Date.now();
      this.#run();
    }, wait);
  }
}

module.exports = Cmd;
