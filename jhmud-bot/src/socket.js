'use strict';
const WebSocket = require('ws');
const { EventEmitter } = require('events');
const iconv = require('iconv-lite');
const json5 = require('json5');
const Cmd = require('./cmd');

/** 一行字（带 <hic> 这类颜色标签），剥掉标签后就是纯文本 */
const stripTag = (s) => String(s).replace(/<[^<>]{1,8}>/g, '').replace(/\s+/g, ' ').trim();

class Socket extends EventEmitter {
  constructor(cfg) {
    super();
    this.cfg = cfg;
    this.ws = null;
    this.buf = '';
    this.connected = false;
    this.logged = false;
    this.key = '';
    this.cmd = null;
  }

  connect(url, key) {
    this.key = key;
    this.ws = new WebSocket(url, { perMessageDeflate: false });
    this.cmd = new Cmd(this);

    this.ws.on('open', () => {
      this.connected = true;
      this.emit('OPEN');          // 注意：这时候还不能发 login，要等服务器提示
    });

    this.ws.on('close', () => {
      this.connected = false;
      this.emit('CLOSE');
    });

    this.ws.on('error', (e) => this.emit('ERROR', e.message));

    // 服务器发的是 GB2312 二进制帧
    this.ws.on('message', (data, isBinary) => {
      const text = isBinary || Buffer.isBuffer(data)
        ? iconv.decode(data, 'gb18030')
        : String(data);
      this.#feed(text);
    });
  }

  #feed(text) {
    // 首帧是协议前言（乱码）+ "登录信息确认："，收到它才回 login
    if (!this.logged && text.includes('登录信息确认')) {
      this.ws.send(`login ${this.key}\n`);
      this.logged = true;
      this.emit('LOGIN_SENT');
    }

    this.buf += text;
    if (this.buf.includes('^^')) {
      const parts = this.buf.split('^^');
      this.buf = parts.pop() || '';
      parts.forEach((p) => this.#emitSegment(p));
      return;
    }
    // 没有分隔符：可能是被切开的 JSON，留着；否则直接当文本
    if (this.buf.trimStart().startsWith('{')) return;
    const rest = this.buf;
    this.buf = '';
    this.#emitSegment(rest);
  }

  #emitSegment(raw) {
    const seg = raw.trim();
    if (!seg) return;

    if (seg[0] === '{' && seg[seg.length - 1] === '}') {
      let data;
      try {
        data = json5.parse(seg);           // key 没引号，不是严格 JSON
      } catch {
        this.emit('RAW', seg);
        return;
      }
      this.emit('frame', data);
      this.emit(data.type, data);
      return;
    }
    // 前言那种乱码丢掉
    if (/[\uFFFD]/.test(seg) && !/[\u4e00-\u9fa5]/.test(seg)) return;
    this.emit('tip', stripTag(seg));
    this.emit('raw', seg);
  }

  send(cmd, wait = true) {
    if (this.cmd) this.cmd.send(cmd, wait);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

module.exports = Socket;
module.exports.stripTag = stripTag;
